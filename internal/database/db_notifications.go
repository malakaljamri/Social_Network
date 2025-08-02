package database

import (
	"database/sql"
	"log"
	"time"
)

// Notification represents a notification in the database
type Notification struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Type        string    `json:"type"`
	ReferenceID int       `json:"reference_id"`
	IsRead      bool      `json:"is_read"`
	CreatedAt   time.Time `json:"created_at"`
	Message     string    `json:"message"` // Computed field for display
}

// CreateNotification creates a new notification
func CreateNotification(db *sql.DB, userID int, notificationType string, referenceID int) error {
	query := `INSERT INTO notifications (user_id, type, reference_id) VALUES (?, ?, ?)`
	_, err := db.Exec(query, userID, notificationType, referenceID)
	if err != nil {
		log.Printf("Error creating notification: %v", err)
		return err
	}
	return nil
}

// GetUserNotifications retrieves all notifications for a user
func GetUserNotifications(db *sql.DB, userID int) ([]Notification, error) {
	log.Printf("DEBUG: GetUserNotifications called for user ID: %d", userID)

	query := `
		SELECT n.id, n.user_id, n.type, n.reference_id, n.is_read, n.created_at
		FROM notifications n
		WHERE n.user_id = ?
		ORDER BY n.created_at DESC
		LIMIT 50
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("ERROR: Error getting user notifications: %v", err)
		return nil, err
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.ReferenceID, &n.IsRead, &n.CreatedAt)
		if err != nil {
			log.Printf("ERROR: Error scanning notification: %v", err)
			continue
		}

		log.Printf("DEBUG: Processing notification ID %d, type: %s, reference_id: %d", n.ID, n.Type, n.ReferenceID)

		// Generate message based on notification type
		n.Message = generateNotificationMessage(db, n.Type, n.ReferenceID)
		log.Printf("DEBUG: Generated message for notification %d: %s", n.ID, n.Message)

		notifications = append(notifications, n)
	}

	log.Printf("DEBUG: Returning %d notifications for user %d", len(notifications), userID)
	return notifications, nil
}

// MarkNotificationAsRead marks a notification as read
func MarkNotificationAsRead(db *sql.DB, notificationID int) error {
	query := `UPDATE notifications SET is_read = 1 WHERE id = ?`
	_, err := db.Exec(query, notificationID)
	if err != nil {
		log.Printf("Error marking notification as read: %v", err)
		return err
	}
	return nil
}

// GetUnreadNotificationCount gets the count of unread notifications for a user
func GetUnreadNotificationCount(db *sql.DB, userID int) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		log.Printf("Error getting unread notification count: %v", err)
		return 0, err
	}
	return count, nil
}

// generateNotificationMessage creates a human-readable message based on notification type
func generateNotificationMessage(db *sql.DB, notificationType string, referenceID int) string {
	log.Printf("DEBUG: Generating message for type: %s, reference_id: %d", notificationType, referenceID)

	switch notificationType {
	case "follow_request":
		// Get follower name
		var username string
		query := `SELECT username FROM users WHERE id = ?`
		err := db.QueryRow(query, referenceID).Scan(&username)
		if err != nil {
			log.Printf("WARNING: Failed to get username for follow request %d: %v", referenceID, err)
			return "Someone sent you a follow request"
		}
		message := username + " sent you a follow request"
		log.Printf("DEBUG: Generated follow request message: %s", message)
		return message

	case "follow_accepted":
		// Get followed user name (the one who accepted the request)
		var username string
		query := `SELECT username FROM users WHERE id = ?`
		err := db.QueryRow(query, referenceID).Scan(&username)
		if err != nil {
			log.Printf("WARNING: Failed to get username for follow accepted %d: %v", referenceID, err)
			return "Your follow request was accepted"
		}
		message := username + " accepted your follow request"
		log.Printf("DEBUG: Generated follow accepted message: %s", message)
		return message

	case "follow_declined":
		// Get followed user name (the one who declined the request)
		var username string
		query := `SELECT username FROM users WHERE id = ?`
		err := db.QueryRow(query, referenceID).Scan(&username)
		if err != nil {
			log.Printf("WARNING: Failed to get username for follow declined %d: %v", referenceID, err)
			return "Your follow request was declined"
		}
		message := username + " declined your follow request"
		log.Printf("DEBUG: Generated follow declined message: %s", message)
		return message

	case "new_follower":
		// Get follower name (the one who started following)
		var username string
		query := `SELECT username FROM users WHERE id = ?`
		err := db.QueryRow(query, referenceID).Scan(&username)
		if err != nil {
			log.Printf("WARNING: Failed to get username for new follower %d: %v", referenceID, err)
			return "Someone started following you"
		}
		message := username + " started following you"
		log.Printf("DEBUG: Generated new follower message: %s", message)
		return message

	case "group_invitation":
		// Get group name
		var groupName string
		query := `SELECT name FROM groups WHERE id = ?`
		err := db.QueryRow(query, referenceID).Scan(&groupName)
		if err != nil {
			log.Printf("WARNING: Failed to get group name for invitation %d: %v", referenceID, err)
			return "You received a group invitation"
		}
		message := "You were invited to join " + groupName
		log.Printf("DEBUG: Generated group invitation message: %s", message)
		return message

	case "group_join_request":
		// Get group name and requester name
		var groupName, requesterName string
		query := `
			SELECT g.name, u.username 
			FROM groups g 
			JOIN group_members gm ON g.id = gm.group_id 
			JOIN users u ON gm.user_id = u.id 
			WHERE g.id = ? AND gm.status = 'pending'
		`
		err := db.QueryRow(query, referenceID).Scan(&groupName, &requesterName)
		if err != nil {
			log.Printf("WARNING: Failed to get group/requester details for join request %d: %v", referenceID, err)
			return "Someone requested to join your group"
		}
		message := requesterName + " requested to join " + groupName
		log.Printf("DEBUG: Generated group join request message: %s", message)
		return message

	case "group_event":
		// OPTIMIZATION: Cache event data to avoid redundant queries
		// Get event title and group name in one query
		var eventTitle, groupName string
		query := `
			SELECT e.title, g.name 
			FROM events e 
			JOIN groups g ON e.group_id = g.id 
			WHERE e.id = ?
		`
		err := db.QueryRow(query, referenceID).Scan(&eventTitle, &groupName)
		if err != nil {
			log.Printf("WARNING: Failed to get event details for notification %d: %v", referenceID, err)
			return "A new event was created in your group"
		}
		message := "New event '" + eventTitle + "' created in " + groupName
		log.Printf("DEBUG: Generated group event message: %s", message)
		return message

	default:
		log.Printf("WARNING: Unknown notification type: %s", notificationType)
		return "You have a new notification"
	}
}

// DeleteNotification deletes a notification
func DeleteNotification(db *sql.DB, notificationID int) error {
	query := `DELETE FROM notifications WHERE id = ?`
	_, err := db.Exec(query, notificationID)
	if err != nil {
		log.Printf("Error deleting notification: %v", err)
		return err
	}
	return nil
}
