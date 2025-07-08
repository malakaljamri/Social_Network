package database

import (
	"database/sql"
	"social_network/internal/models"
)

func SaveChatMessage(message *models.ChatMessage) error {
	query := `INSERT INTO chat_messages (sender_id, Receiver_id, content, timestamp, is_read) 
              VALUES (?, ?, ?, ?, ?)`
	_, err := db.Exec(query, message.SenderID, message.ReceiverID, message.Content, message.Timestamp, 0)
	return err
}

func GetChatHistory(userID1, userID2 int, limit int, offset int) ([]*models.ChatMessage, error) {
	query := `SELECT sender_id, Receiver_id, content, timestamp 
              FROM chat_messages 
              WHERE (sender_id = ? AND Receiver_id = ?) OR (sender_id = ? AND Receiver_id = ?)
              ORDER BY id DESC
              LIMIT ? OFFSET ?`

	rows, err := db.Query(query, userID1, userID2, userID2, userID1, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]*models.ChatMessage, 0, limit)
	for rows.Next() {
		msg := &models.ChatMessage{}
		err := rows.Scan(&msg.SenderID, &msg.ReceiverID, &msg.Content, &msg.Timestamp)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// Save a group chat message to the group_messages table
func SaveGroupChatMessage(message *models.GroupChatMessage) error {
	query := `INSERT INTO group_messages (group_id, sender_id, content, timestamp) VALUES (?, ?, ?, ?)`
	_, err := db.Exec(query, message.GroupID, message.SenderID, message.Content, message.Timestamp)
	return err
}

// Fetch all messages for a given group_id
func GetGroupChatHistory(groupID int, limit int, offset int) ([]*models.GroupChatMessage, error) {
	query := `SELECT gm.group_id, gm.sender_id, u.username, u.avatar, gm.content, gm.timestamp FROM group_messages gm JOIN users u ON gm.sender_id = u.id WHERE gm.group_id = ? ORDER BY gm.timestamp ASC LIMIT ? OFFSET ?`
	rows, err := db.Query(query, groupID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]*models.GroupChatMessage, 0, limit)
	for rows.Next() {
		msg := &models.GroupChatMessage{}
		var avatar sql.NullString
		err := rows.Scan(&msg.GroupID, &msg.SenderID, &msg.SenderUsername, &avatar, &msg.Content, &msg.Timestamp)
		if err != nil {
			return nil, err
		}
		if avatar.Valid {
			msg.SenderAvatar = avatar.String
		} else {
			msg.SenderAvatar = "/static/images/default-avatar.png"
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

// Mark all messages as read for a user in a chat
func MarkMessagesAsRead(userID, otherUserID int) error {
	query := `UPDATE chat_messages SET is_read = 1 WHERE Receiver_id = ? AND sender_id = ? AND is_read = 0`
	_, err := db.Exec(query, userID, otherUserID)
	return err
}

// CountUnreadMessages returns the count of unread private messages for userID from otherUserID
func CountUnreadMessages(userID, otherUserID int) int {
	query := `SELECT COUNT(*) FROM chat_messages WHERE Receiver_id = ? AND sender_id = ? AND is_read = 0`
	var count int
	err := db.QueryRow(query, userID, otherUserID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// GetUnreadCountsForUser returns a map of sender_id to unread count for the given user
func GetUnreadCountsForUser(userID int) (map[int]int, error) {
	rows, err := db.Query(`SELECT sender_id, COUNT(*) FROM chat_messages WHERE Receiver_id = ? AND is_read = 0 GROUP BY sender_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[int]int)
	for rows.Next() {
		var senderID, count int
		if err := rows.Scan(&senderID, &count); err == nil {
			counts[senderID] = count
		}
	}
	return counts, nil
}
