package database

import (
	"social_network/internal/models"
)

func SaveChatMessage(message *models.ChatMessage) error {
	query := `INSERT INTO chat_messages (sender_id, Receiver_id, content, timestamp) 
              VALUES (?, ?, ?, ?)`
	_, err := db.Exec(query, message.SenderID, message.ReceiverID, message.Content, message.Timestamp)
	return err
}

func GetChatHistory(userID1, userID2 int, limit int, offset int) ([]*models.ChatMessage, error) {
	query := `SELECT sender_id, Receiver_id, content, timestamp 
              FROM chat_messages 
              WHERE (sender_id = ? AND Receiver_id = ?) OR (sender_id = ? AND Receiver_id = ?)
              ORDER BY timestamp DESC
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
