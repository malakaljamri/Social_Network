package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social_network/internal/database"
	"strconv"
)

// GetNotificationsHandler handles GET requests to fetch user notifications
func GetNotificationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get current user from session
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Get notifications for the user
		notifications, err := database.GetUserNotifications(db, userID)
		if err != nil {
			http.Error(w, "Failed to fetch notifications", http.StatusInternalServerError)
			return
		}

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
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Get unread notification count
		count, err := database.GetUnreadNotificationCount(db, userID)
		if err != nil {
			http.Error(w, "Failed to get unread count", http.StatusInternalServerError)
			return
		}

		// Return count as JSON
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"count": count})
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
