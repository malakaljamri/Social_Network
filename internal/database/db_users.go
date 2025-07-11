package database

import (
	"database/sql"
	"fmt"
	"social_network/internal/models"
	"time"
)

var OnlineUsers = make(map[int]bool)

func CreateUser(user *models.User) error {
	query := `INSERT INTO users (username, email, password, birthDate, gender, first_name, last_name, avatar, about_me) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := ExecuteQuery(query, user.Username, user.Email, user.Password, fmt.Sprint(user.BirthDate.Year(), "-", int(user.BirthDate.Month()), "-", user.BirthDate.Day()), user.Gender, user.FirstName, user.LastName, user.Avatar, user.AboutMe)
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

// GenerateUniqueUsername generates a username from first and last name and ensures it is unique in the database.
func GenerateUniqueUsername(first, last string) string {
	base := fmt.Sprintf("%s%s", first, last)
	username := base
	count := 1
	for {
		var exists int
		query := "SELECT COUNT(1) FROM users WHERE username = ?"
		err := db.QueryRow(query, username).Scan(&exists)
		if err != nil {
			return username // fallback
		}
		if exists == 0 {
			return username
		}
		username = fmt.Sprintf("%s%d", base, count)
		count++
	}
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
	query := `SELECT id, username, email, password, birthDate, gender, first_name, last_name, avatar, nickname, about_me, is_private FROM users WHERE id = ?`
	rows, err := FetchData(query, id)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()

	var user models.User
	var birthDate, gender, firstName, lastName, avatar, nickname, aboutMe sql.NullString

	if rows.Next() {
		err := rows.Scan(
			&user.ID, &user.Username, &user.Email, &user.Password,
			&birthDate, &gender, &firstName, &lastName, &avatar, &nickname, &aboutMe,
			&user.IsPrivate,
		)
		if err != nil {
			return models.User{}, err
		}
	} else {
		return models.User{}, sql.ErrNoRows
	}

	if birthDate.Valid {
		parsedDate, err := time.Parse("2006-01-02", birthDate.String)
		if err == nil {
			user.BirthDate = parsedDate
		}
	}

	user.Gender = gender.String
	user.FirstName = firstName.String
	user.LastName = lastName.String
	user.Avatar = avatar.String
	user.Nickname = nickname.String
	user.AboutMe = aboutMe.String

	return user, nil
}

func UpdateUser(user models.User) error {
	query := `UPDATE users SET username = ?, email = ?, password = ?, birthDate = ?, gender = ?, first_name = ?, last_name = ?, avatar = ?, nickname = ?, about_me = ?, is_private = ? WHERE id = ?`
	_, err := ExecuteQuery(query, user.Username, user.Email, user.Password, user.BirthDate, user.Gender, user.FirstName, user.LastName, user.Avatar, user.Nickname, user.AboutMe, user.IsPrivate, user.ID)
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
	// fmt.Println(users)
	return users, nil
}

func GetAllUsers(currentUserID int) ([]models.User, error) {
	//TODO: sometime user with no chat appears on top
	query := `
		SELECT 
			u.id, 
			u.username, 
			u.birthDate, 
			u.gender, 
			u.first_name, 
			u.last_name, 
			u.email,
			u.avatar,
			(SELECT MAX(timestamp) 
				FROM chat_messages 
				WHERE (sender_id = u.id and Receiver_id = ?) or (sender_id = ? AND Receiver_id = u.id)) as last_message_time
		FROM users u
		WHERE u.id != ?
		ORDER BY last_message_time DESC, u.username ASC;
	`

	rows, err := db.Query(query, currentUserID, currentUserID, currentUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var lastMessageTime sql.NullString
		var avatar sql.NullString
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.BirthDate,
			&user.Gender,
			&user.FirstName,
			&user.LastName,
			&user.Email,
			&avatar,
			&lastMessageTime,
		)
		if err != nil {
			return nil, err
		}
		user.Avatar = avatar.String
		user.LastMessageTime = lastMessageTime.String
		_, user.Online = OnlineUsers[user.ID]
		users = append(users, user)
	}
	return users, nil
}

/*func convertToInterface(ids []int) []interface{} {
	result := make([]interface{}, len(ids))
	for i, v := range ids {
		result[i] = v
	}
	return result
}*/

// UpdateUserAvatar updates the user's avatar filename in the database
func UpdateUserAvatar(userID int, avatarFilename string) error {
	query := `UPDATE users SET avatar = ? WHERE id = ?`
	_, err := ExecuteQuery(query, avatarFilename, userID)
	return err
}

// UpdateUserProfile updates the user's profile information
func UpdateUserProfile(userID int, profileData struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
	AboutMe   string `json:"about_me"`
	Gender    string `json:"gender"`
	BirthDate string `json:"birth_date"`
}) error {
	query := `
		UPDATE users 
		SET first_name = ?, 
			last_name = ?, 
			nickname = ?, 
			about_me = ?, 
			gender = ?, 
			birthDate = ?
		WHERE id = ?
	`
	_, err := ExecuteQuery(query,
		profileData.FirstName,
		profileData.LastName,
		profileData.Nickname,
		profileData.AboutMe,
		profileData.Gender,
		profileData.BirthDate,
		userID,
	)
	return err
}

// UpdateUserPrivacy updates the user's privacy settings
func UpdateUserPrivacy(userID int, isPrivate bool) error {
	query := `
		UPDATE users 
		SET is_private = ?
		WHERE id = ?
	`
	_, err := ExecuteQuery(query, isPrivate, userID)
	return err
}

// UpdateUserPassword updates the password for a user by user ID
func UpdateUserPassword(userID int, hashedPassword string) error {
	query := `UPDATE users SET password = ? WHERE id = ?`
	_, err := ExecuteQuery(query, hashedPassword, userID)
	return err
}
