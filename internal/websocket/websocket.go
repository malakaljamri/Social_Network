package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"social_network/internal/database"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now, adjust in production
	},
}

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	UserID int
	Send   chan []byte
}

type Message struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
	UserID  int         `json:"user_id"`
}

var (
	maxMessageSize = int64(512)
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	writeWait      = 10 * time.Second
)

func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request, messageHandler func(*Client, []byte)) {
	log.Printf("New WebSocket connection received from client: 💻 %s", r.RemoteAddr)
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Websocket upgrade error: %v", err)
		return
	}

	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		log.Println(err)
		conn.Close()
		return
	}

	client := &Client{Hub: hub, Conn: conn, Send: make(chan []byte, 256), UserID: userID}
	log.Printf("Client connected with User 🆔: %d", userID)
	client.Hub.Register <- client

	// Send online status
	message := Message{
		Type: "user_status",
		Content: map[string]interface{}{
			"user_id":  userID,
			"username": "",
			"status":   "online",
		},
	}
	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage

	// Start the pump goroutines
	go client.WritePump()
	go client.ReadPump(messageHandler)

	// Handle disconnection
	defer func() {
		message := Message{
			Type: "user_status",
			Content: map[string]interface{}{
				"user_id":  userID,
				"username": "might_need_to_fetch_the_username",
				"status":   "offline",
			},
		}
		jsonMessage, _ := json.Marshal(message)
		hub.Broadcast <- jsonMessage
		conn.Close()
	}()
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Log the message being sent (for debugging)
			log.Printf("Sending message to client %d: %s", c.UserID, string(message))

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message: %v", err)
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
func (c *Client) ReadPump(messageHandler func(*Client, []byte)) {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		messageHandler(c, message)
		Print_userIDs("ReadPump")
	}
}

var (
	// OnlineUsers = make(map[int]bool)
	userMutex = &sync.Mutex{}
)

func UpdateUserStatus(hub *Hub, userID int, online bool) {
	userMutex.Lock()
	defer userMutex.Unlock()
	database.OnlineUsers[userID] = online
	if !online {
		delete(database.OnlineUsers, userID)
	}
	go BroadcastUserStatus(hub, userID, online) // Pass the hub to BroadcastUserStatus
}

func BroadcastUserStatus(hub *Hub, userID int, online bool) {
	status := "offline"
	if online {
		status = "online"
	}

	message := Message{
		Type: "user_status",
		Content: map[string]interface{}{
			"user_id": userID,
			"status":  status,
			// "username": username,
		},
		UserID: 0,
	}

	jsonMessage, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling user status message: %v", err)
		return
	}
	hub.Broadcast <- jsonMessage
}

func GetOnlineUsers() []int {
	userMutex.Lock()
	defer userMutex.Unlock()
	var users []int
	for userID, online := range database.OnlineUsers {
		if online || !online {
			users = append(users, userID)
		}
	}
	return users
}

func (c *Client) SetOnlineStatus(online bool) {
	UpdateUserStatus(c.Hub, c.UserID, online)
}

type Hub struct {
	clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.clients[client] = true
			client.SetOnlineStatus(true)
		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				client.SetOnlineStatus(false)
			}
		case message := <-h.Broadcast:
			log.Printf("Broadcasting message to %d clients", len(h.clients))
			for client := range h.clients {
				select {
				case client.Send <- message:
					log.Printf("Successfully sent message 📩 to client 👤 %d", client.UserID)
				default:
					log.Printf("Failed to send message 📩 to client 👤 %d, removing client", client.UserID)
					close(client.Send)
					delete(h.clients, client)
				}
			}
		}
		Print_userIDs("Run")
	}
}

func Print_userIDs(caller string) {
	userIDs := GetOnlineUsers()
	log.Printf("Online User 🆔s (%s): %v", caller, userIDs)
}

func SendPostsViaWebSocket(client *Client) {
	posts, _, err := database.GetPosts(1, 10) // Get the first 10 posts
	if err != nil {
		log.Printf("❌ Error fetching posts: %v", err)
		return
	}

	message := Message{
		Type:    "posts",
		Content: posts,
	}

	client.Send <- messageToJSON(message)
}

func messageToJSON(message Message) []byte {
	json, err := json.Marshal(message)
	if err != nil {
		log.Println("Error marshalling message:", err)
		return []byte{}
	}
	return json
}

func BroadcastTime(hub *Hub) { // This function is only for testing purposes
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		currentTime := time.Now().Format("15:04:05")
		message := Message{
			Type:    "time",
			Content: currentTime,
		}
		jsonMessage, err := json.Marshal(message)
		if err != nil {
			log.Printf("Error marshalling time message: %v", err)
			continue
		}
		hub.Broadcast <- jsonMessage
	}
}
