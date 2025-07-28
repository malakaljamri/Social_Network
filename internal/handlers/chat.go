package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"
)

type ChatHandlers struct {
	hub *websocket.Hub
}

func NewChatHandlers(hub *websocket.Hub) *ChatHandlers {
	return &ChatHandlers{hub: hub}
}

func (h *ChatHandlers) HandleChat(w http.ResponseWriter, r *http.Request) {
	log.Printf("WebSocket connection attempt from: %s", r.RemoteAddr)
	log.Printf("WebSocket request headers: %v", r.Header)

	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		log.Printf("WebSocket authentication failed: %v", err)
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	log.Printf("WebSocket authentication successful for user: %d", userID)

	conn, err := websocket.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Could not upgrade connection")
		return
	}

	client := &websocket.Client{
		Hub:         h.hub,
		Conn:        conn,
		UserID:      userID,
		Send:        make(chan []byte, 256),
		ConnectedAt: time.Now(),
		LastPing:    time.Now(),
		IsAlive:     true,
	}

	// Register client directly with the hub
	client.Hub.Register <- client

	// Start pumps
	go client.WritePump()
	go client.ReadPump(h.handleChatMessage)
}

func (h *ChatHandlers) handleChatMessage(client *websocket.Client, message []byte) {
	var baseMessage struct {
		Type        string          `json:"type"`
		Content     json.RawMessage `json:"content"`
		Receiver_id int             `json:"Receiver_id"`
	}

	err := json.Unmarshal(message, &baseMessage)
	if err != nil {
		log.Printf("Error parsing message base: %v", err)
		websocket.SendError(h.hub, client.UserID, "Failed to parse message")
		return
	}

	switch baseMessage.Type {
	case websocket.MessageTypeChat:
		h.handleChatMessageContent(client, baseMessage)
	case websocket.MessageTypeUserStatus:
		// User status is managed by the hub
		log.Printf("User status message received from client %d", client.UserID)
	case websocket.MessageTypeTyping:
		h.handleTypingStatus(client, baseMessage)
	case websocket.MessageTypeGroupChat:
		h.handleGroupChatMessage(client, baseMessage)
	case websocket.MessageTypePing:
		h.handlePing(client, baseMessage)
	default:
		log.Printf("Unknown message type: %s from client %d", baseMessage.Type, client.UserID)
		websocket.SendError(h.hub, client.UserID, "Unknown message type")
	}
}

func (h *ChatHandlers) handleChatMessageContent(client *websocket.Client, baseMessage struct {
	Type        string          `json:"type"`
	Content     json.RawMessage `json:"content"`
	Receiver_id int             `json:"Receiver_id"`
}) {
	var chatContent struct {
		Receiver_id int    `json:"Receiver_id"`
		Content     string `json:"content"`
	}

	log.Printf("Processing chat message from client %d to %d", client.UserID, baseMessage.Receiver_id)

	if err := json.Unmarshal(baseMessage.Content, &chatContent); err != nil {
		// If direct parsing fails, try treating it as a string
		var contentStr string
		if strErr := json.Unmarshal(baseMessage.Content, &contentStr); strErr == nil {
			chatContent.Content = contentStr
		} else {
			log.Printf("Error parsing chat content: %v", err)
			websocket.SendError(h.hub, client.UserID, "Failed to parse chat content")
			return
		}
	}

	chatMessage := models.ChatMessage{
		SenderID:   client.UserID,
		ReceiverID: baseMessage.Receiver_id,
		Content:    chatContent.Content,
		Timestamp:  time.Now(),
	}

	// Validate message permissions
	if !h.validateChatPermission(chatMessage) {
		websocket.SendError(h.hub, client.UserID, "You can only message users you follow or who follow you")
		return
	}

	// Save the message to the database
	if err := database.SaveChatMessage(&chatMessage); err != nil {
		log.Printf("Error saving chat message: %v", err)
		websocket.SendError(h.hub, client.UserID, "Failed to save message")
		return
	}

	// Broadcast the message to both sender and receiver
	h.broadcastChatMessage(chatMessage)

	// Send unread count update to recipient
	h.sendUnreadCountUpdate(chatMessage.ReceiverID, chatMessage.SenderID)
}

func (h *ChatHandlers) handleTypingStatus(client *websocket.Client, baseMessage struct {
	Type        string          `json:"type"`
	Content     json.RawMessage `json:"content"`
	Receiver_id int             `json:"Receiver_id"`
}) {
	var typingStatus struct {
		Receiver_id int    `json:"Receiver_id"`
		IsTyping    bool   `json:"is_typing"`
		Username    string `json:"username"`
	}

	if err := json.Unmarshal(baseMessage.Content, &typingStatus); err != nil {
		log.Printf("Error parsing typing status: %v", err)
		return
	}

	// Validate typing permission
	if !h.validateChatPermission(models.ChatMessage{
		SenderID:   client.UserID,
		ReceiverID: typingStatus.Receiver_id,
	}) {
		return // Silently ignore typing from unauthorized users
	}

	// Broadcast the typing status
	msg := websocket.Message{
		Type: websocket.MessageTypeTyping,
		Content: map[string]interface{}{
			"sender_id":   client.UserID,
			"receiver_id": typingStatus.Receiver_id,
			"is_typing":   typingStatus.IsTyping,
			"username":    typingStatus.Username,
		},
		UserID:    typingStatus.Receiver_id,
		Timestamp: time.Now(),
		Priority:  websocket.PriorityLow,
	}
	jsonMessage, _ := json.Marshal(msg)
	h.hub.Broadcast <- jsonMessage
}

func (h *ChatHandlers) handleGroupChatMessage(client *websocket.Client, baseMessage struct {
	Type        string          `json:"type"`
	Content     json.RawMessage `json:"content"`
	Receiver_id int             `json:"Receiver_id"`
}) {
	var groupChatContent struct {
		GroupID int    `json:"group_id"`
		Content string `json:"content"`
	}

	if err := json.Unmarshal(baseMessage.Content, &groupChatContent); err != nil {
		log.Printf("Error parsing group chat content: %v", err)
		websocket.SendError(h.hub, client.UserID, "Failed to parse group chat content")
		return
	}

	// Validate group access
	hasAccess, err := database.CheckUserGroupAccess(nil, client.UserID, groupChatContent.GroupID)
	if err != nil || !hasAccess {
		log.Printf("User %d attempted to send message to group %d without access", client.UserID, groupChatContent.GroupID)
		websocket.SendError(h.hub, client.UserID, "You don't have access to this group")
		return
	}

	// Save group chat message
	groupMessage := models.GroupChatMessage{
		GroupID:        groupChatContent.GroupID,
		SenderID:       client.UserID,
		SenderUsername: "", // Will be filled by database
		Content:        groupChatContent.Content,
		Timestamp:      time.Now(),
	}

	if err := database.SaveGroupChatMessage(&groupMessage); err != nil {
		log.Printf("Error saving group chat message: %v", err)
		websocket.SendError(h.hub, client.UserID, "Failed to save group message")
		return
	}

	// Broadcast to all group members
	h.broadcastGroupChatMessage(groupMessage)
}

func (h *ChatHandlers) handlePing(client *websocket.Client, baseMessage struct {
	Type        string          `json:"type"`
	Content     json.RawMessage `json:"content"`
	Receiver_id int             `json:"Receiver_id"`
}) {
	// Respond with pong
	pongMessage := websocket.Message{
		Type: websocket.MessageTypePong,
		Content: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
		UserID:    client.UserID,
		Timestamp: time.Now(),
		Priority:  websocket.PriorityLow,
	}
	jsonMessage, _ := json.Marshal(pongMessage)
	client.Send <- jsonMessage
}

func (h *ChatHandlers) validateChatPermission(chatMessage models.ChatMessage) bool {
	// Cannot send message to yourself
	if chatMessage.SenderID == chatMessage.ReceiverID {
		log.Printf("User %d attempted to send message to themselves", chatMessage.SenderID)
		return false
	}

	// Check if either user follows the other
	isFollowing1, err1 := database.IsFollowing(chatMessage.SenderID, chatMessage.ReceiverID)
	isFollowing2, err2 := database.IsFollowing(chatMessage.ReceiverID, chatMessage.SenderID)

	log.Printf("Chat permission check - SenderID: %d, ReceiverID: %d", chatMessage.SenderID, chatMessage.ReceiverID)
	log.Printf("IsFollowing(Sender->Receiver): %v, error: %v", isFollowing1, err1)
	log.Printf("IsFollowing(Receiver->Sender): %v, error: %v", isFollowing2, err2)

	if (err1 == nil && isFollowing1) || (err2 == nil && isFollowing2) {
		log.Printf("✅ Chat permission granted")
		return true
	}

	log.Printf("❌ Chat permission denied")
	return false
}

func (h *ChatHandlers) broadcastChatMessage(chatMessage models.ChatMessage) {
	// Create standardized chat message
	msg := websocket.Message{
		Type: websocket.MessageTypeChat,
		Content: map[string]interface{}{
			"sender_id":   chatMessage.SenderID,
			"receiver_id": chatMessage.ReceiverID,
			"content":     chatMessage.Content,
			"timestamp":   chatMessage.Timestamp,
		},
		Timestamp: time.Now(),
		Priority:  websocket.PriorityNormal,
	}

	// Send to both sender and receiver
	for _, userID := range []int{chatMessage.SenderID, chatMessage.ReceiverID} {
		msg.UserID = userID
		jsonMessage, _ := json.Marshal(msg)
		h.hub.Broadcast <- jsonMessage
	}
}

func (h *ChatHandlers) broadcastGroupChatMessage(groupMessage models.GroupChatMessage) {
	// Get group members
	members, err := database.GetGroupMembers(nil, groupMessage.GroupID)
	if err != nil {
		log.Printf("Error getting group members for broadcast: %v", err)
		return
	}

	// Create group chat message
	msg := websocket.Message{
		Type: websocket.MessageTypeGroupChat,
		Content: map[string]interface{}{
			"group_id":        groupMessage.GroupID,
			"sender_id":       groupMessage.SenderID,
			"sender_username": groupMessage.SenderUsername,
			"content":         groupMessage.Content,
			"timestamp":       groupMessage.Timestamp,
		},
		Timestamp: time.Now(),
		Priority:  websocket.PriorityNormal,
	}

	// Send to all group members
	for _, member := range members {
		if memberID, ok := member["id"].(int); ok {
			msg.UserID = memberID
			jsonMessage, _ := json.Marshal(msg)
			h.hub.Broadcast <- jsonMessage
		}
	}
}

func (h *ChatHandlers) sendUnreadCountUpdate(receiverID, senderID int) {
	unreadCount := database.CountUnreadMessages(receiverID, senderID)
	unreadMsg := websocket.Message{
		Type: websocket.MessageTypeNotificationCountUpdate,
		Content: map[string]interface{}{
			"user_id": senderID,
			"count":   unreadCount,
		},
		UserID:    receiverID,
		Timestamp: time.Now(),
		Priority:  websocket.PriorityHigh,
	}
	jsonMessage, _ := json.Marshal(unreadMsg)
	h.hub.Broadcast <- jsonMessage
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
		utils.WriteJSONError(w, http.StatusUnauthorized, "You must be logged in to view chat history")
		return
	}

	otherUserIDStr := r.URL.Query().Get("user_id")
	otherUserID, err := strconv.Atoi(otherUserIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := 0
	if offsetStr != "" {
		offset, err = strconv.Atoi(offsetStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid offset")
			return
		}
	}

	// Note: Chat history is accessible regardless of follow relationship
	// Follow relationship is only checked when sending messages
	// This allows users to view historical conversations even if they unfollowed each other

	log.Printf("Fetching chat history: userID=%d, otherUserID=%d, offset=%d, limit=50", userID, otherUserID, offset)
	messages, err := database.GetChatHistory(userID, otherUserID, 50, offset)
	if err != nil {
		log.Printf("Error fetching chat history: %v", err)
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching chat history")
		return
	}
	log.Printf("Found %d chat messages", len(messages))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func GetGroupChatHistory(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "You must be logged in to view group chat history")
		return
	}

	groupIDStr := r.URL.Query().Get("group_id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	// Validate group access
	hasAccess, err := database.CheckUserGroupAccess(nil, userID, groupID)
	if err != nil || !hasAccess {
		utils.WriteJSONError(w, http.StatusForbidden, "You don't have access to this group")
		return
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := 0
	if offsetStr != "" {
		offset, err = strconv.Atoi(offsetStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid offset")
			return
		}
	}

	messages, err := database.GetGroupChatHistory(groupID, 50, offset)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching group chat history")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func GetUnreadCounts(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "You must be logged in to view unread counts")
		return
	}

	unreadCounts, err := database.GetUnreadCountsForUser(userID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching unread counts")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(unreadCounts)
}

func GetUnreadGroupCounts(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "You must be logged in to view unread group counts")
		return
	}

	unreadCounts, err := database.GetUnreadGroupCountsForUser(userID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching unread group counts")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(unreadCounts)
}
