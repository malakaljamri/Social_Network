package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"social_network/internal/database"
	"strconv"
)

// GetNotificationsHandler handles GET requests to fetch user notifications
func GetNotificationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("DEBUG: GetNotificationsHandler called")

		// Get current user from session
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("ERROR: Failed to get user ID from session: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		log.Printf("DEBUG: Getting notifications for user ID: %d", userID)

		// Get notifications for the user
		notifications, err := database.GetUserNotifications(db, userID)
		if err != nil {
			log.Printf("ERROR: Failed to fetch notifications for user %d: %v", userID, err)
			http.Error(w, "Failed to fetch notifications", http.StatusInternalServerError)
			return
		}
		log.Printf("DEBUG: Retrieved %d notifications for user %d", len(notifications), userID)

		// Return notifications as JSON
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notifications)
	}
}

// MarkNotificationAsReadHandler handles POST requests to mark notifications as read
func MarkNotificationAsReadHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse notification ID from request body
		var request struct {
			NotificationID int `json:"notification_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Mark notification as read
		if err := database.MarkNotificationAsRead(db, request.NotificationID); err != nil {
			http.Error(w, "Failed to mark notification as read", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

// GetUnreadNotificationCountHandler handles GET requests to get unread notification count
func GetUnreadNotificationCountHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get current user from session
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("ERROR: Failed to get user ID from session: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Get unread notification count
		count, err := database.GetUnreadNotificationCount(db, userID)
		if err != nil {
			log.Printf("ERROR: Failed to get unread count for user %d: %v", userID, err)
			http.Error(w, "Failed to get unread count", http.StatusInternalServerError)
			return
		}

		log.Printf("DEBUG: Unread notification count for user %d: %d", userID, count)

		// Return count as JSON
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"count": count})
	}
}

// DebugNotificationsHandler - temporary debug endpoint to check all notifications
func DebugNotificationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("DEBUG: DebugNotificationsHandler called")

		// Get current user from session
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("ERROR: Failed to get user ID from session: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Get all notifications for debugging
		query := `SELECT id, user_id, type, reference_id, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC`
		rows, err := db.Query(query, userID)
		if err != nil {
			log.Printf("ERROR: Failed to query notifications: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var debugNotifications []map[string]interface{}
		for rows.Next() {
			var id, userID, referenceID int
			var notificationType string
			var isRead bool
			var createdAt string

			err := rows.Scan(&id, &userID, &notificationType, &referenceID, &isRead, &createdAt)
			if err != nil {
				log.Printf("ERROR: Failed to scan notification: %v", err)
				continue
			}

			debugNotifications = append(debugNotifications, map[string]interface{}{
				"id":           id,
				"user_id":      userID,
				"type":         notificationType,
				"reference_id": referenceID,
				"is_read":      isRead,
				"created_at":   createdAt,
			})
		}

		log.Printf("DEBUG: Found %d raw notifications for user %d", len(debugNotifications), userID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user_id":       userID,
			"count":         len(debugNotifications),
			"notifications": debugNotifications,
		})
	}
}

// DeleteNotificationHandler handles DELETE requests to delete notifications
func DeleteNotificationHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Get notification ID from query parameter
		notificationIDStr := r.URL.Query().Get("id")
		if notificationIDStr == "" {
			http.Error(w, "Notification ID required", http.StatusBadRequest)
			return
		}

		notificationID, err := strconv.Atoi(notificationIDStr)
		if err != nil {
			http.Error(w, "Invalid notification ID", http.StatusBadRequest)
			return
		}

		// Delete notification
		err = database.DeleteNotification(db, notificationID)
		if err != nil {
			http.Error(w, "Failed to delete notification", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}
