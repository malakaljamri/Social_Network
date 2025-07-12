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
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	conn, err := websocket.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Could not upgrade connection")
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
	// log.Printf("Received raw message (handleChatMessage): %s", string(message))
	var baseMessage struct {
		Type        string          `json:"type"`
		Content     json.RawMessage `json:"content"`
		Receiver_id int             `json:"Receiver_id"`
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
		log.Printf("Raw chat Receiver_id and content: %d %s", baseMessage.Receiver_id, string(baseMessage.Content))

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
			SenderID: client.UserID,
			// ReceiverID: chatContent.Receiver_id,
			ReceiverID: baseMessage.Receiver_id,
			Content:    chatContent.Content,
			Timestamp:  time.Now(),
		}

		// Save the message to the database
		// ENFORCE PRIVATE MESSAGE RULE
		canSend := false
		if chatMessage.SenderID != chatMessage.ReceiverID {
			isFollowing1, err1 := database.IsFollowing(chatMessage.SenderID, chatMessage.ReceiverID)
			isFollowing2, err2 := database.IsFollowing(chatMessage.ReceiverID, chatMessage.SenderID)
			if (err1 == nil && isFollowing1) || (err2 == nil && isFollowing2) {
				canSend = true
			}
		}
		if !canSend {
			errorMsg := websocket.Message{
				Type:    "error",
				Content: "You can only message users you follow or who follow you",
				UserID:  client.UserID,
			}
			client.Send <- messageToJSON(errorMsg)
			return
		}
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
		// END: ENFORCE PRIVATE MESSAGE RULE
		// Broadcast the message
		msg := websocket.Message{
			Type:    "chat",
			Content: chatMessage,
			UserID:  chatMessage.ReceiverID,
		}
		jsonMessage, _ := json.Marshal(msg)
		h.hub.Broadcast <- jsonMessage

		// Broadcast unread count to recipient
		unreadCount := database.CountUnreadMessages(chatMessage.ReceiverID, chatMessage.SenderID)
		unreadMsg := websocket.Message{
			Type:    "unread-count-update",
			Content: map[string]interface{}{"userId": chatMessage.SenderID, "count": unreadCount},
			UserID:  chatMessage.ReceiverID,
		}
		unreadJson, _ := json.Marshal(unreadMsg)
		h.hub.Broadcast <- unreadJson
	case "user_status":
		// managed by the hub
	case "typing_status":
		var typingStatus struct {
			Receiver_id int    `json:"Receiver_id"`
			IsTyping    bool   `json:"is_typing"`
			Username    string `json:"username"`
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
	case "group_chat":
		var groupChatContent struct {
			GroupID int    `json:"group_id"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal(baseMessage.Content, &groupChatContent); err != nil {
			log.Printf("Error parsing group chat content: %v", err)
			errorMsg := websocket.Message{
				Type:    "error",
				Content: "Failed to parse group chat content",
				UserID:  client.UserID,
			}
			client.Send <- messageToJSON(errorMsg)
			return
		}
		// Fetch sender's username
		user, err := database.GetUserByID(client.UserID)
		if err != nil {
			log.Printf("Error fetching sender username: %v", err)
			errorMsg := websocket.Message{
				Type:    "error",
				Content: "Failed to fetch sender username",
				UserID:  client.UserID,
			}
			client.Send <- messageToJSON(errorMsg)
			return
		}
		groupChatMessage := models.GroupChatMessage{
			GroupID:        groupChatContent.GroupID,
			SenderID:       client.UserID,
			SenderUsername: user.Username,
			SenderAvatar:   user.Avatar,
			Content:        groupChatContent.Content,
			Timestamp:      time.Now(),
		}
		if err := database.SaveGroupChatMessage(&groupChatMessage); err != nil {
			log.Printf("Error saving group chat message: %v", err)
			errorMsg := websocket.Message{
				Type:    "error",
				Content: "Failed to save group chat message",
				UserID:  client.UserID,
			}
			client.Send <- messageToJSON(errorMsg)
			return
		}
		msg := websocket.Message{
			Type:    "group_chat",
			Content: groupChatMessage,
			UserID:  groupChatMessage.SenderID,
		}
		jsonMessage, _ := json.Marshal(msg)
		h.hub.Broadcast <- jsonMessage

		// Broadcast unread count to all group members except sender
		memberIDs := database.GetGroupMemberIDs(groupChatMessage.GroupID)
		for _, memberID := range memberIDs {
			if memberID == client.UserID {
				continue
			}
			unreadCount := database.CountUnreadGroupMessages(groupChatMessage.GroupID, memberID)
			unreadMsg := websocket.Message{
				Type:    "unread-group-count-update",
				Content: map[string]interface{}{"groupId": groupChatMessage.GroupID, "count": unreadCount},
				UserID:  memberID,
			}
			unreadJson, _ := json.Marshal(unreadMsg)
			h.hub.Broadcast <- unreadJson
		}
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

	// Mark messages as read when user opens chat
	database.MarkMessagesAsRead(userID, otherUserIDInt)

	// Broadcast unread count to user
	unreadCount := database.CountUnreadMessages(userID, otherUserIDInt)
	unreadMsg := websocket.Message{
		Type:    "unread-count-update",
		Content: map[string]interface{}{"userId": otherUserIDInt, "count": unreadCount},
		UserID:  userID,
	}
	unreadJson, _ := json.Marshal(unreadMsg)
	if h, ok := w.(interface{ Hub() *websocket.Hub }); ok {
		h.Hub().Broadcast <- unreadJson
	}

	messages, err := database.GetChatHistory(userID, otherUserIDInt, limit, offset)
	if err != nil {
		http.Error(w, "Error fetching chat history", http.StatusInternalServerError)
		return
	}

	// Reverse messages to send oldest first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func GetGroupChatHistory(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	groupIDStr := r.URL.Query().Get("group_id")
	if groupIDStr == "" {
		http.Error(w, "Group ID is required", http.StatusBadRequest)
		return
	}
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}
	// Update last_group_chat_open_time
	database.UpdateLastGroupChatOpenTime(groupID, userID)
	// Broadcast unread count to user
	unreadCount := database.CountUnreadGroupMessages(groupID, userID)
	unreadMsg := websocket.Message{
		Type:    "unread-group-count-update",
		Content: map[string]interface{}{"groupId": groupID, "count": unreadCount},
		UserID:  userID,
	}
	unreadJson, _ := json.Marshal(unreadMsg)
	if h, ok := w.(interface{ Hub() *websocket.Hub }); ok {
		h.Hub().Broadcast <- unreadJson
	}
	limit := 50
	offset := 0
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		offset, _ = strconv.Atoi(offsetStr)
	}
	messages, err := database.GetGroupChatHistory(groupID, limit, offset)
	if err != nil {
		http.Error(w, "Error fetching group chat history", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// Handler to return unread counts for the current user
func GetUnreadCounts(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	counts, err := database.GetUnreadCountsForUser(userID)
	if err != nil {
		// Added detailed error logging
		log.Printf("[GetUnreadCounts] Error fetching unread counts for userID %d: %v", userID, err)
		http.Error(w, "Error fetching unread counts", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(counts)
}
