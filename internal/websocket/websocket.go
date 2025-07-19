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
	// New: Connection metadata
	ConnectedAt time.Time
	LastPing    time.Time
	IsAlive     bool
}

type Message struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
	UserID  int         `json:"user_id"`
	// New: Message metadata
	Timestamp time.Time `json:"timestamp,omitempty"`
	Priority  int       `json:"priority,omitempty"`
}

// New: Message types for better organization
const (
	MessageTypeChat                    = "chat"
	MessageTypeUserStatus              = "user_status"
	MessageTypeTyping                  = "typing"
	MessageTypeNotification            = "notification"
	MessageTypeNotificationCountUpdate = "notification_count_update"
	MessageTypeGroupChat               = "group_chat"
	MessageTypeGroupCreated            = "group_created"
	MessageTypeGroupUpdated            = "group_updated"
	MessageTypePing                    = "ping"
	MessageTypePong                    = "pong"
	MessageTypeError                   = "error"
)

// New: Message priorities
const (
	PriorityLow    = 1
	PriorityNormal = 2
	PriorityHigh   = 3
	PriorityUrgent = 4
)

var (
	maxMessageSize = int64(512)
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	writeWait      = 10 * time.Second
	// New: Connection management
	heartbeatInterval = 30 * time.Second
	maxIdleTime       = 5 * time.Minute
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

	client := &Client{
		Hub:         hub,
		Conn:        conn,
		Send:        make(chan []byte, 256),
		UserID:      userID,
		ConnectedAt: time.Now(),
		LastPing:    time.Now(),
		IsAlive:     true,
	}

	// Register client with the hub
	client.Hub.Register <- client

	// Send online status
	message := Message{
		Type: MessageTypeUserStatus,
		Content: map[string]interface{}{
			"user_id":  userID,
			"username": "",
			"status":   "online",
		},
		Timestamp: time.Now(),
		Priority:  PriorityHigh,
	}
	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage

	// Start the pump goroutines
	go client.WritePump()
	go client.ReadPump(messageHandler)
	go client.HeartbeatPump()

	// Handle disconnection
	defer func() {
		message := Message{
			Type: MessageTypeUserStatus,
			Content: map[string]interface{}{
				"user_id":  userID,
				"username": "might_need_to_fetch_the_username",
				"status":   "offline",
			},
			Timestamp: time.Now(),
			Priority:  PriorityHigh,
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
		c.LastPing = time.Now()
		c.IsAlive = true
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				if err.Error() != "websocket: close 1005 (no status)" {
					log.Printf("error: %v", err)
				}
			}
			break
		}

		// Update last ping time
		c.LastPing = time.Now()
		c.IsAlive = true

		messageHandler(c, message)
	}
}

// New: Heartbeat pump to monitor client health
func (c *Client) HeartbeatPump() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Check if client is still alive
			if time.Since(c.LastPing) > maxIdleTime {
				log.Printf("Client %d is idle for too long, disconnecting", c.UserID)
				c.Conn.Close()
				return
			}

			// Send heartbeat if needed
			if time.Since(c.LastPing) > heartbeatInterval {
				pingMessage := Message{
					Type:      MessageTypePing,
					Content:   map[string]interface{}{"timestamp": time.Now().Unix()},
					Timestamp: time.Now(),
					Priority:  PriorityLow,
				}
				jsonMessage, _ := json.Marshal(pingMessage)
				select {
				case c.Send <- jsonMessage:
					// Heartbeat sent successfully
				default:
					log.Printf("Failed to send heartbeat to client %d", c.UserID)
				}
			}
		}
	}
}

var (
	userMutex = &sync.Mutex{}
)

func UpdateUserStatus(hub *Hub, userID int, online bool) {
	userMutex.Lock()
	defer userMutex.Unlock()
	database.OnlineUsers[userID] = online
	if !online {
		delete(database.OnlineUsers, userID)
	}
	go BroadcastUserStatus(hub, userID, online)
}

func BroadcastUserStatus(hub *Hub, userID int, online bool) {
	status := "offline"
	if online {
		status = "online"
	}

	message := Message{
		Type: MessageTypeUserStatus,
		Content: map[string]interface{}{
			"user_id": userID,
			"status":  status,
		},
		Timestamp: time.Now(),
		Priority:  PriorityHigh,
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
		if online {
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
	// New: Hub metadata
	mutex sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Broadcast:  make(chan []byte, 100), // Increased buffer size
		Register:   make(chan *Client, 10),
		Unregister: make(chan *Client, 10),
		mutex:      sync.RWMutex{},
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			client.SetOnlineStatus(true)
			log.Printf("Client %d registered, total clients: %d", client.UserID, len(h.clients))

		case client := <-h.Unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				client.SetOnlineStatus(false)
			}
			h.mutex.Unlock()
			log.Printf("Client %d unregistered, total clients: %d", client.UserID, len(h.clients))

		case message := <-h.Broadcast:
			// Parse the message to get the target UserID and priority
			var msgData map[string]interface{}
			if err := json.Unmarshal(message, &msgData); err == nil {
				if userID, ok := msgData["user_id"].(float64); ok {
					// Send only to the specific user
					targetUserID := int(userID)
					h.mutex.RLock()
					for client := range h.clients {
						if client.UserID == targetUserID {
							select {
							case client.Send <- message:
								// Message sent successfully
							default:
								log.Printf("Failed to send message to client %d, removing client", client.UserID)
								h.mutex.RUnlock()
								h.mutex.Lock()
								delete(h.clients, client)
								close(client.Send)
								h.mutex.Unlock()
								h.mutex.RLock()
							}
						}
					}
					h.mutex.RUnlock()
				} else {
					// Broadcast to all clients
					h.mutex.RLock()
					for client := range h.clients {
						select {
						case client.Send <- message:
							// Message sent successfully
						default:
							log.Printf("Failed to send message to client %d, removing client", client.UserID)
							h.mutex.RUnlock()
							h.mutex.Lock()
							delete(h.clients, client)
							close(client.Send)
							h.mutex.Unlock()
							h.mutex.RLock()
						}
					}
					h.mutex.RUnlock()
				}
			} else {
				// Fallback: broadcast to all if message parsing fails
				h.mutex.RLock()
				for client := range h.clients {
					select {
					case client.Send <- message:
						// Message sent successfully
					default:
						log.Printf("Failed to send message to client %d, removing client", client.UserID)
						h.mutex.RUnlock()
						h.mutex.Lock()
						delete(h.clients, client)
						close(client.Send)
						h.mutex.Unlock()
						h.mutex.RLock()
					}
				}
				h.mutex.RUnlock()
			}
		}
	}
}

// New: Utility functions for sending specific message types
func SendNotification(hub *Hub, userID int, notificationType string, content map[string]interface{}) {
	message := Message{
		Type: MessageTypeNotification,
		Content: map[string]interface{}{
			"type":    notificationType,
			"content": content,
		},
		UserID:    userID,
		Timestamp: time.Now(),
		Priority:  PriorityHigh,
	}

	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage
}

func SendNotificationCountUpdate(hub *Hub, userID int, count int) {
	message := Message{
		Type: MessageTypeNotificationCountUpdate,
		Content: map[string]interface{}{
			"count": count,
		},
		UserID:    userID,
		Timestamp: time.Now(),
		Priority:  PriorityHigh,
	}

	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage
}

func SendGroupEvent(hub *Hub, groupID int, eventType string, content map[string]interface{}) {
	message := Message{
		Type: eventType,
		Content: map[string]interface{}{
			"group_id": groupID,
			"content":  content,
		},
		Timestamp: time.Now(),
		Priority:  PriorityNormal,
	}

	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage
}

func SendError(hub *Hub, userID int, errorMessage string) {
	message := Message{
		Type: MessageTypeError,
		Content: map[string]interface{}{
			"error": errorMessage,
		},
		UserID:    userID,
		Timestamp: time.Now(),
		Priority:  PriorityUrgent,
	}

	jsonMessage, _ := json.Marshal(message)
	hub.Broadcast <- jsonMessage
}

var MainHub = NewHub()
