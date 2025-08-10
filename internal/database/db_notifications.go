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
	RequesterID *int      `json:"requester_id,omitempty"` // Optional field for group join requests
	IsRead      bool      `json:"is_read"`
	CreatedAt   time.Time `json:"created_at"`
	Message     string    `json:"message"` // Computed field for display
}

// CreateNotification creates a new notification
func CreateNotification(db *sql.DB, userID int, notificationType string, referenceID int, requesterID ...int) error {
	var requesterIDValue *int
	if len(requesterID) > 0 {
		requesterIDValue = &requesterID[0]
	}

	query := `INSERT INTO notifications (user_id, type, reference_id, requester_id) VALUES (?, ?, ?, ?)`
	_, err := db.Exec(query, userID, notificationType, referenceID, requesterIDValue)
	if err != nil {
		log.Printf("❌ Failed to create notification: %v", err)
		return err
	}
	log.Printf("✅ Created notification: userID=%d, type=%s, referenceID=%d, requesterID=%v", userID, notificationType, referenceID, requesterIDValue)
	return nil
}

// GetUserNotifications retrieves all notifications for a user
func GetUserNotifications(db *sql.DB, userID int) ([]Notification, error) {
	query := `
		SELECT id, user_id, type, reference_id, requester_id, is_read, created_at 
		FROM notifications 
		WHERE user_id = ? 
		ORDER BY created_at DESC
	`
	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var notification Notification
		var requesterID sql.NullInt64
		err := rows.Scan(&notification.ID, &notification.UserID, &notification.Type, &notification.ReferenceID, &requesterID, &notification.IsRead, &notification.CreatedAt)
		if err != nil {
			log.Printf("❌ Error scanning notification: %v", err)
			continue
		}

		// Convert sql.NullInt64 to *int
		if requesterID.Valid {
			reqID := int(requesterID.Int64)
			notification.RequesterID = &reqID
		}

		// Generate message for the notification
		notification.Message = generateNotificationMessage(db, notification.Type, notification.ReferenceID, notification.RequesterID)
		notifications = append(notifications, notification)
	}

	log.Printf("✅ Retrieved %d notifications for user %d", len(notifications), userID)
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
func generateNotificationMessage(db *sql.DB, notificationType string, referenceID int, requesterID *int) string {
	log.Printf("DEBUG: Generating message for type: %s, reference_id: %d", notificationType, referenceID)

	switch notificationType {
	case "follow_request":
		// Get follower name
		var followerName string
		err := db.QueryRow("SELECT username FROM users WHERE id = ?", referenceID).Scan(&followerName)
		if err != nil {
			log.Printf("WARNING: Failed to get follower name for notification %d: %v", referenceID, err)
			return "Someone sent you a follow request"
		}
		message := followerName + " sent you a follow request"
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
		err := db.QueryRow("SELECT name FROM groups WHERE id = ?", referenceID).Scan(&groupName)
		if err != nil {
			log.Printf("WARNING: Failed to get group name for invitation %d: %v", referenceID, err)
			return "You received a group invitation"
		}
		message := "You were invited to join " + groupName
		log.Printf("DEBUG: Generated group invitation message: %s", message)
		return message

	case "group_invitation_request":
		// Get group name and inviter name
		var groupName, inviterName string
		query := `
			SELECT g.name, u.username 
			FROM groups g 
			JOIN group_invitation_requests gir ON g.id = gir.group_id 
			JOIN users u ON gir.inviter_id = u.id 
			WHERE g.id = ? AND gir.status = 'pending'
			LIMIT 1
		`
		err := db.QueryRow(query, referenceID).Scan(&groupName, &inviterName)
		if err != nil {
			log.Printf("WARNING: Failed to get group/inviter details for invitation request %d: %v", referenceID, err)
			return "Someone wants to invite a user to your group"
		}
		message := inviterName + " wants to invite a user to " + groupName
		log.Printf("DEBUG: Generated group invitation request message: %s", message)
		return message

	case "group_join_request":
		// Use the stored requester_id to get the correct user
		if requesterID == nil {
			log.Printf("WARNING: No requester_id provided for group join request notification %d", referenceID)
			return "Someone requested to join your group"
		}

		log.Printf("DEBUG: Generating group join request message for group %d, requester %d", referenceID, *requesterID)

		// Get group name and requester name using the stored requester_id
		var groupName, requesterName string
		query := `
			SELECT g.name, u.username 
			FROM groups g, users u 
			WHERE g.id = ? AND u.id = ?
		`
		err := db.QueryRow(query, referenceID, *requesterID).Scan(&groupName, &requesterName)
		if err != nil {
			log.Printf("WARNING: Failed to get group/requester details for join request %d: %v", referenceID, err)
			return "Someone requested to join your group"
		}
		message := requesterName + " requested to join " + groupName
		log.Printf("DEBUG: Generated group join request message: %s (group: %s, requester: %s)", message, groupName, requesterName)
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

// MarkGroupInvitationNotificationAsRead marks the notification for a group invitation as read
func MarkGroupInvitationNotificationAsRead(db *sql.DB, userID, groupID int) error {
	log.Printf("🔍 DEBUG: MarkGroupInvitationNotificationAsRead called with userID=%d, groupID=%d", userID, groupID)

	// Instead of marking as read, delete the notification since it's no longer relevant
	query := `DELETE FROM notifications WHERE user_id = ? AND type = 'group_invitation' AND reference_id = ?`
	result, err := db.Exec(query, userID, groupID)
	if err != nil {
		log.Printf("❌ Error deleting group invitation notification: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("🔍 DEBUG: MarkGroupInvitationNotificationAsRead deleted %d rows for userID=%d, groupID=%d", rowsAffected, userID, groupID)

	return nil
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
