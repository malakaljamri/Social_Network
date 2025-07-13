package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"
	"strconv"
)

// GetNotificationsHandler returns notifications for the current user
func GetNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get limit from query parameter, default to 30
	limitStr := r.URL.Query().Get("limit")
	limit := 30
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	notifications, err := database.GetUserNotifications(userID, limit)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch notifications")
		return
	}

	// Enrich notifications with sender information
	var enrichedNotifications []map[string]interface{}
	for _, notification := range notifications {
		enriched := map[string]interface{}{
			"id":              notification.ID,
			"user_id":         notification.UserID,
			"type":            notification.Type,
			"reference_id":    notification.ReferenceID,
			"sender_id":       notification.SenderID,
			"action_required": notification.ActionRequired,
			"action_data":     notification.ActionData,
			"message":         notification.Message,
			"is_read":         notification.IsRead,
			"created_at":      notification.CreatedAt,
		}

		// Get sender information
		if notification.SenderID > 0 {
			sender, err := database.GetUserByID(notification.SenderID)
			if err == nil {
				enriched["sender"] = map[string]interface{}{
					"id":       sender.ID,
					"username": sender.Username,
					"avatar":   sender.Avatar,
				}
			}
		}

		enrichedNotifications = append(enrichedNotifications, enriched)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"notifications": enrichedNotifications,
	})
}

// MarkAsReadHandler marks notifications as read
func MarkAsReadHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if r.Method == http.MethodPost {
		// Mark all notifications as read
		err = database.MarkAllNotificationsAsRead(userID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to mark notifications as read")
			return
		}
	} else {
		// Mark specific notification as read
		notificationIDStr := r.URL.Query().Get("id")
		if notificationIDStr == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Notification ID is required")
			return
		}

		notificationID, err := strconv.Atoi(notificationIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid notification ID")
			return
		}

		err = database.MarkNotificationAsRead(notificationID, userID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to mark notification as read")
			return
		}
	}

	// Send WebSocket notification to update notification count
	sendNotificationCountUpdate(userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Notifications marked as read",
	})
}

// HandleNotificationActionHandler handles notification actions (accept/decline)
func HandleNotificationActionHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var request struct {
		NotificationID int    `json:"notification_id"`
		Action         string `json:"action"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get notification to verify ownership and get details
	notification, sender, err := database.GetNotificationWithSenderInfo(request.NotificationID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusNotFound, "Notification not found")
		return
	}

	// Verify notification belongs to current user
	if notification.UserID != userID {
		utils.WriteJSONError(w, http.StatusForbidden, "Not authorized to handle this notification")
		return
	}

	// Handle different notification types
	switch notification.Type {
	case "follow_request":
		err = handleFollowRequestAction(notification, request.Action, sender)
	case "group_invitation":
		err = handleGroupInvitationAction(notification, request.Action, sender)
	case "group_join_request":
		err = handleGroupJoinRequestAction(notification, request.Action, sender)
	default:
		utils.WriteJSONError(w, http.StatusBadRequest, "Unsupported notification type")
		return
	}

	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to handle notification action")
		return
	}

	// Replace actionable notification with approval message instead of deleting
	err = replaceNotificationWithApproval(notification, request.Action, sender)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Action completed but failed to update notification")
		return
	}

	sendNotificationCountUpdate(userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Notification action completed successfully",
	})
}

// handleFollowRequestAction handles follow request accept/decline
func handleFollowRequestAction(notification *database.Notification, action string, sender *models.User) error {
	switch action {
	case "accept":
		err := database.AcceptFollowRequest(sender.ID, notification.UserID)
		if err == nil {
			// Broadcast follow status update for both users
			msg := websocket.Message{
				Type: "follow_status_update",
				Content: map[string]interface{}{
					"follower_id": sender.ID,
					"followed_id": notification.UserID,
				},
			}
			if jsonMsg, err := json.Marshal(msg); err == nil {
				websocket.MainHub.Broadcast <- jsonMsg
			}
		}
		return err
	case "decline":
		return database.DeclineFollowRequest(sender.ID, notification.UserID)
	default:
		return errors.New("Invalid action")
	}
}

// handleGroupInvitationAction handles group invitation accept/decline
func handleGroupInvitationAction(notification *database.Notification, action string, sender *models.User) error {
	// Parse action data to get group ID
	var actionData map[string]interface{}
	if notification.ActionData != "" {
		if err := json.Unmarshal([]byte(notification.ActionData), &actionData); err != nil {
			return err
		}
	}

	groupID, ok := actionData["group_id"].(float64)
	if !ok {
		return errors.New("Invalid group ID in notification")
	}

	switch action {
	case "accept":
		// Add user to group with accepted status
		query := `INSERT OR REPLACE INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`
		_, err := database.ExecuteQuery(query, int(groupID), notification.UserID)
		return err
	case "decline":
		// Remove user from group
		query := `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`
		_, err := database.ExecuteQuery(query, int(groupID), notification.UserID)
		return err
	default:
		return errors.New("Invalid action")
	}
}

// Add handler for group join request actions
func handleGroupJoinRequestAction(notification *database.Notification, action string, sender *models.User) error {
	// Parse action data to get group ID and requester ID
	var actionData map[string]interface{}
	if notification.ActionData != "" {
		if err := json.Unmarshal([]byte(notification.ActionData), &actionData); err != nil {
			return err
		}
	}
	groupID, ok1 := actionData["group_id"].(float64)
	requesterID, ok2 := actionData["requester_id"].(float64)
	if !ok1 || !ok2 {
		return errors.New("Invalid group join request action data")
	}

	switch action {
	case "accept":
		// Add user to group with accepted status
		query := `UPDATE group_members SET status = 'accepted' WHERE group_id = ? AND user_id = ?`
		_, err := database.ExecuteQuery(query, int(groupID), int(requesterID))
		return err
	case "decline":
		// Remove user from group
		query := `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`
		_, err := database.ExecuteQuery(query, int(groupID), int(requesterID))
		return err
	default:
		return errors.New("Invalid action")
	}
}

// replaceNotificationWithApproval replaces an actionable notification with an approval message
func replaceNotificationWithApproval(notification *database.Notification, action string, sender *models.User) error {
	var newMessage string
	var newType string
	var actionRequired bool
	var actionData map[string]interface{}

	switch notification.Type {
	case "follow_request":
		if action == "accept" {
			newMessage = "You are now following each other"
			newType = "follow_established"
			actionRequired = false
			actionData = nil
		} else {
			// For decline, we can either delete or show a declined message
			return database.DeleteNotification(notification.ID, notification.UserID)
		}
	case "group_invitation":
		if action == "accept" {
			newMessage = "You have joined the group"
			newType = "group_membership_confirmed"
			actionRequired = false
			actionData = nil
		} else {
			// For decline, we can either delete or show a declined message
			return database.DeleteNotification(notification.ID, notification.UserID)
		}
	case "group_join_request":
		if action == "accept" {
			newMessage = "User has been added to the group"
			newType = "group_membership_confirmed"
			actionRequired = false
			actionData = nil
		} else {
			// For decline, we can either delete or show a declined message
			return database.DeleteNotification(notification.ID, notification.UserID)
		}
	default:
		// For unsupported types, just delete the notification
		return database.DeleteNotification(notification.ID, notification.UserID)
	}

	// Update the notification with the new content
	query := `UPDATE notifications 
			  SET type = ?, message = ?, action_required = ?, action_data = ?, is_read = 0, created_at = CURRENT_TIMESTAMP 
			  WHERE id = ?`

	var actionDataJSON string
	if actionData != nil {
		jsonData, err := json.Marshal(actionData)
		if err != nil {
			return fmt.Errorf("failed to marshal action data: %v", err)
		}
		actionDataJSON = string(jsonData)
	}

	_, err := database.ExecuteQuery(query, newType, newMessage, actionRequired, actionDataJSON, notification.ID)
	if err != nil {
		return fmt.Errorf("failed to update notification: %v", err)
	}

	// Send WebSocket notification about the updated notification
	sendNotificationUpdate(notification.UserID, notification.ID, newType, newMessage, sender)

	return nil
}

// sendNotificationUpdate sends WebSocket notification about notification updates
func sendNotificationUpdate(userID, notificationID int, notificationType, message string, sender *models.User) {
	updateMsg := websocket.Message{
		Type: "notification_update",
		Content: map[string]interface{}{
			"user_id":         userID,
			"notification_id": notificationID,
			"type":            notificationType,
			"message":         message,
			"sender_name":     sender.Username,
			"sender_id":       sender.ID,
		},
	}

	jsonMessage, err := json.Marshal(updateMsg)
	if err == nil {
		websocket.MainHub.Broadcast <- jsonMessage
	}
}

// sendNewNotificationWebSocket sends a WebSocket notification when a new notification is created
func sendNewNotificationWebSocket(userID, senderID int, notificationType, message string) {
	// Get sender information
	sender, err := database.GetUserByID(senderID)
	if err != nil {
		log.Printf("Warning: failed to get sender info for WebSocket notification: %v", err)
		return
	}

	// Create WebSocket message
	wsMessage := websocket.Message{
		Type: "new_notification",
		Content: map[string]interface{}{
			"user_id":     userID,
			"type":        notificationType,
			"message":     message,
			"sender_id":   senderID,
			"sender_name": sender.Username,
		},
	}

	// Send via WebSocket
	jsonMessage, err := json.Marshal(wsMessage)
	if err != nil {
		log.Printf("Warning: failed to marshal WebSocket notification: %v", err)
		return
	}

	websocket.MainHub.Broadcast <- jsonMessage
}

// sendNotificationCountUpdate sends WebSocket notification to update notification count
func sendNotificationCountUpdate(userID int) {
	count, err := database.GetUnreadNotificationCount(userID)
	if err != nil {
		return // Don't fail if we can't get count
	}

	message := websocket.Message{
		Type: "notification_count_update",
		Content: map[string]interface{}{
			"user_id": userID,
			"count":   count,
		},
	}

	jsonMessage, err := json.Marshal(message)
	if err == nil {
		websocket.MainHub.Broadcast <- jsonMessage
	}
}

// GetUnreadNotificationCountHandler returns unread notification count
func GetUnreadNotificationCountHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	count, err := database.GetUnreadNotificationCount(userID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to get notification count")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}
