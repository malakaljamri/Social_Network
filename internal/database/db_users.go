package database

import (
	"database/sql"
	"fmt"
	"forum-project/internal/models"
)

var OnlineUsers = make(map[int]bool)

func CreateUser(user *models.User) error {
	query := `INSERT INTO users (username, email, password, birthDate, gender, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := ExecuteQuery(query, user.Username, user.Email, user.Password, fmt.Sprint(user.BirthDate.Year(), "-", int(user.BirthDate.Month()), "-", user.BirthDate.Day()), user.Gender, user.FirstName, user.LastName)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	user.ID = int(id)
	return nil
}

func GetUserByEmailOrNickname(userIdentifier string) (models.User, error) { // X email, ✔ indentifier
	query := `SELECT id, username, email, password FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`
	rows, err := FetchData(query, userIdentifier, userIdentifier)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()

	var user models.User
	if rows.Next() {
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Password)
		if err != nil {
			return models.User{}, err
		}
	} else {
		return models.User{}, sql.ErrNoRows
	}
	return user, nil
}

func GetUserByID(id int) (models.User, error) {
	query := `SELECT id, username, email, password FROM users WHERE id = ?`
	rows, err := FetchData(query, id)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()

	var user models.User
	if rows.Next() {
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Password)
		if err != nil {
			return models.User{}, err
		}
	} else {
		return models.User{}, sql.ErrNoRows
	}
	return user, nil
}

func UpdateUser(user models.User) error {
	query := `UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?`
	_, err := ExecuteQuery(query, user.Username, user.Email, user.Password, user.ID)
	return err
}

func DeleteUser(id int) error {
	query := `DELETE FROM users WHERE id = ?`
	_, err := ExecuteQuery(query, id)
	return err
}

func GetOnlineUsersDetails(userIDs []int, userID int) ([]models.User, error) {
	query := `
		SELECT 
			u.id, 
			u.username, 
			u.birthDate, 
			u.gender, 
			u.first_name, 
			u.last_name, 
			u.email,
			(SELECT MAX(timestamp) 
				FROM chat_messages 
				WHERE (sender_id = u.id and Receiver_id = ?) or (sender_id = ? AND Receiver_id = u.id)) as last_message_time
		FROM users u
		ORDER BY last_message_time DESC, u.username ASC;
	`

	// rows, err := db.Query(query, convertToInterface(userIDs)...)
	rows, err := db.Query(query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var lastMessageTime sql.NullString
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.BirthDate,
			&user.Gender,
			&user.FirstName,
			&user.LastName,
			&user.Email,
			&lastMessageTime,
		)
		if err != nil {
			return nil, err
		}
		user.LastMessageTime = lastMessageTime.String
		_, user.Online = OnlineUsers[user.ID]
		users = append(users, user)
	}
	fmt.Println(users)
	return users, nil
}

func convertToInterface(ids []int) []interface{} {
	result := make([]interface{}, len(ids))
	for i, v := range ids {
		result[i] = v
	}
	return result
}
