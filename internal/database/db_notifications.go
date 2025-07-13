package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"social_network/internal/models"
)

// Notification represents a notification in the database
type Notification struct {
	ID             int    `json:"id"`
	UserID         int    `json:"user_id"`
	Type           string `json:"type"`
	ReferenceID    int    `json:"reference_id"`
	SenderID       int    `json:"sender_id"`
	ActionRequired bool   `json:"action_required"`
	ActionData     string `json:"action_data"`
	Message        string `json:"message"`
	IsRead         bool   `json:"is_read"`
	CreatedAt      string `json:"created_at"`
}

// CreateNotification creates a new notification
func CreateNotification(userID, senderID, referenceID int, notificationType string, actionRequired bool, actionData map[string]interface{}, message string) error {
	// Convert actionData to JSON string
	actionDataJSON := ""
	if actionData != nil {
		jsonData, err := json.Marshal(actionData)
		if err != nil {
			return fmt.Errorf("failed to marshal action data: %v", err)
		}
		actionDataJSON = string(jsonData)
	}

	query := `INSERT INTO notifications (user_id, sender_id, type, reference_id, action_required, action_data, message, is_read, created_at) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`

	_, err := ExecuteQuery(query, userID, senderID, notificationType, referenceID, actionRequired, actionDataJSON, message)
	if err != nil {
		return fmt.Errorf("failed to create notification: %v", err)
	}

	// Cleanup old notifications to maintain 30 limit
	err = cleanupOldNotifications(userID)
	if err != nil {
		log.Printf("Warning: failed to cleanup old notifications for user %d: %v", userID, err)
	}

	// Send WebSocket notification to the user (handled by handlers)
	// Note: WebSocket notification is sent from the handlers layer to avoid import cycles

	return nil
}

// GetUserNotifications retrieves notifications for a user
func GetUserNotifications(userID int, limit int) ([]Notification, error) {
	if limit <= 0 {
		limit = 30
	}

	query := `SELECT id, user_id, type, reference_id, sender_id, action_required, action_data, message, is_read, created_at
			  FROM notifications 
			  WHERE user_id = ? 
			  ORDER BY created_at DESC 
			  LIMIT ?`

	rows, err := FetchData(query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch notifications: %v", err)
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var notification Notification
		err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&notification.Type,
			&notification.ReferenceID,
			&notification.SenderID,
			&notification.ActionRequired,
			&notification.ActionData,
			&notification.Message,
			&notification.IsRead,
			&notification.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %v", err)
		}
		notifications = append(notifications, notification)
	}

	return notifications, nil
}

// GetUnreadNotificationCount returns the count of unread notifications for a user
func GetUnreadNotificationCount(userID int) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0`

	rows, err := FetchData(query, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %v", err)
	}
	defer rows.Close()

	var count int
	if rows.Next() {
		err := rows.Scan(&count)
		if err != nil {
			return 0, fmt.Errorf("failed to scan count: %v", err)
		}
	}

	return count, nil
}

// MarkNotificationAsRead marks a notification as read
func MarkNotificationAsRead(notificationID, userID int) error {
	query := `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`

	_, err := ExecuteQuery(query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %v", err)
	}

	return nil
}

// MarkAllNotificationsAsRead marks all notifications for a user as read
func MarkAllNotificationsAsRead(userID int) error {
	query := `UPDATE notifications SET is_read = 1 WHERE user_id = ?`

	_, err := ExecuteQuery(query, userID)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %v", err)
	}

	return nil
}

// DeleteNotification deletes a notification by ID and user ID
func DeleteNotification(notificationID, userID int) error {
	query := `DELETE FROM notifications WHERE id = ? AND user_id = ?`
	_, err := ExecuteQuery(query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %v", err)
	}
	return nil
}

// cleanupOldNotifications removes old notifications to maintain 30 notification limit
func cleanupOldNotifications(userID int) error {
	// Get count of notifications for user
	countQuery := `SELECT COUNT(*) FROM notifications WHERE user_id = ?`
	countRows, err := FetchData(countQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to count notifications: %v", err)
	}
	defer countRows.Close()

	var count int
	if countRows.Next() {
		err := countRows.Scan(&count)
		if err != nil {
			return fmt.Errorf("failed to scan count: %v", err)
		}
	}

	// If more than 30 notifications, delete the oldest ones
	if count > 30 {
		excessCount := count - 30
		deleteQuery := `DELETE FROM notifications 
						WHERE user_id = ? AND id IN (
							SELECT id FROM notifications 
							WHERE user_id = ? 
							ORDER BY created_at ASC 
							LIMIT ?
						)`

		_, err := ExecuteQuery(deleteQuery, userID, userID, excessCount)
		if err != nil {
			return fmt.Errorf("failed to cleanup old notifications: %v", err)
		}
	}

	return nil
}

// GetNotificationWithSenderInfo returns notification with sender information
func GetNotificationWithSenderInfo(notificationID int) (*Notification, *models.User, error) {
	query := `SELECT n.id, n.user_id, n.type, n.reference_id, n.sender_id, n.action_required, n.action_data, n.message, n.is_read, n.created_at,
			  u.id, u.username, u.email, u.avatar
			  FROM notifications n
			  JOIN users u ON n.sender_id = u.id
			  WHERE n.id = ?`

	rows, err := FetchData(query, notificationID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch notification with sender: %v", err)
	}
	defer rows.Close()

	if rows.Next() {
		var notification Notification
		var sender models.User
		var avatar sql.NullString
		err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&notification.Type,
			&notification.ReferenceID,
			&notification.SenderID,
			&notification.ActionRequired,
			&notification.ActionData,
			&notification.Message,
			&notification.IsRead,
			&notification.CreatedAt,
			&sender.ID,
			&sender.Username,
			&sender.Email,
			&avatar,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to scan notification with sender: %v", err)
		}
		if avatar.Valid {
			sender.Avatar = avatar.String
		} else {
			sender.Avatar = ""
		}
		return &notification, &sender, nil
	}

	return nil, nil, fmt.Errorf("notification not found")
}

// Note: WebSocket notification functionality moved to handlers layer to avoid import cycles
