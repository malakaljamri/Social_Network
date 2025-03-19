package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"forum-project/internal/database"
	"forum-project/internal/models"
	"forum-project/internal/websocket"
)

type ChatHandlers struct {
	hub *websocket.Hub
}

func NewChatHandlers(hub *websocket.Hub) *ChatHandlers {
	return &ChatHandlers{hub: hub}
}

func (h *ChatHandlers) HandleChat(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not upgrade connection", http.StatusInternalServerError)
		return
	}

	client := &websocket.Client{
		Hub:    h.hub, // Set the hub
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	// Register client directly with the hub
	client.Hub.Register <- client

	// Start pumps
	go client.WritePump()
	go client.ReadPump(h.handleChatMessage)
}

func (h *ChatHandlers) handleChatMessage(client *websocket.Client, message []byte) {
	log.Printf("Received raw message (handleChatMessage): %s", string(message))
	var baseMessage struct {
		Type    string          `json:"type"`
		Content json.RawMessage `json:"content"`
        Receiver_id int         `json:"Receiver_id"`
	}

	err := json.Unmarshal(message, &baseMessage)
	if err != nil {
		log.Printf("Error parsing message base: %v", err)
		errorMsg := websocket.Message{
			Type:    "error",
			Content: "Failed to parse message base",
			UserID:  client.UserID,
		}
		client.Send <- messageToJSON(errorMsg)
		return
	}

	switch baseMessage.Type {
	case "chat":
		var chatContent struct {
			// Receiver_id int    `json:"Receiver_id"`
			Receiver_id int    `json:"Receiver_id"`
			Content     string `json:"content"`
		}
		log.Printf("Raw chat Receiver_id and content: %d %s",baseMessage.Receiver_id, string(baseMessage.Content))

		if err := json.Unmarshal(baseMessage.Content, &chatContent); err != nil {
			// If direct parsing fails, try treating it as a string
			var contentStr string
			if strErr := json.Unmarshal(baseMessage.Content, &contentStr); strErr == nil {
				chatContent.Content = contentStr
			} else {
				log.Printf("Error parsing chat content: %v", err)
				errorMsg := websocket.Message{
					Type:    "error",
					Content: "Failed to parse chat content",
					UserID:  client.UserID,
				}
				client.Send <- messageToJSON(errorMsg)
				return
			}
		}

		chatMessage := models.ChatMessage{
			SenderID:   client.UserID,
			// ReceiverID: chatContent.Receiver_id,
            ReceiverID: baseMessage.Receiver_id,
			Content:    chatContent.Content,
			Timestamp:  time.Now(),
		}

		// Save the message to the database
		if err := database.SaveChatMessage(&chatMessage); err != nil {
			log.Printf("Error saving chat message: %v", err)
			errorMsg := websocket.Message{
				Type:    "error",
				Content: "Failed to save message",
				UserID:  client.UserID,
			}
			client.Send <- messageToJSON(errorMsg)
			return
		}

		// Broadcast the message
		msg := websocket.Message{
			Type:    "chat",
			Content: chatMessage,
			UserID:  chatMessage.ReceiverID,
		}
		jsonMessage, _ := json.Marshal(msg)
		h.hub.Broadcast <- jsonMessage
	case "user_status":
		// managed by the hub
	case "typing_status":
		var typingStatus struct {
			Receiver_id int    `json:"Receiver_id"`
			IsTyping   bool    `json:"is_typing"`
			Username   string  `json:"username"`
		}
		
		if err := json.Unmarshal(baseMessage.Content, &typingStatus); err != nil {
			log.Printf("Error parsing typing status: %v", err)
			return
		}

		// Broadcast the typing status
		msg := websocket.Message{
			Type:    "typing_status",
			Content: typingStatus,
			UserID:  typingStatus.Receiver_id,
		}
		jsonMessage, _ := json.Marshal(msg)
		h.hub.Broadcast <- jsonMessage
	default:
		log.Printf("Unknown message type (handleChatMessage): %s", baseMessage.Type)
	}
}

func messageToJSON(message websocket.Message) []byte {
	json, err := json.Marshal(message)
	if err != nil {
		log.Println("Error marshalling message:", err)
		return []byte{}
	}
	return json
}

func GetChatHistory(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	otherUserID := r.URL.Query().Get("user_id")
	limit := 10 // Default limit
	offset := 0

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		offset, _ = strconv.Atoi(offsetStr)
	}

	otherUserIDInt, err := strconv.Atoi(otherUserID)
	if err != nil {
		http.Error(w, "Invalid user_id parameter", http.StatusBadRequest)
		return
	}

	messages, err := database.GetChatHistory(userID, otherUserIDInt, limit, offset)
	if err != nil {
		http.Error(w, "Error fetching chat history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
