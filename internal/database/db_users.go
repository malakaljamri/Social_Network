package database

import (
	"database/sql"
	"fmt"
	"social_network/internal/models"
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
	query := `SELECT id, username, email, password, is_private, 
              COALESCE(profile_privacy, 'public') as profile_privacy 
              FROM users WHERE id = ?`
	rows, err := FetchData(query, id)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()

	var user models.User
	var profilePrivacy string
	if rows.Next() {
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Password,
			&user.IsPrivate, &profilePrivacy)
		if err != nil {
			return models.User{}, err
		}
		// If profile is marked as private in either field, treat it as private
		if profilePrivacy == "private" && !user.IsPrivate {
			user.IsPrivate = true
		}
	} else {
		return models.User{}, sql.ErrNoRows
	}
	return user, nil
}

func UpdateUser(user models.User) error {
	// Update both privacy fields for consistency
	query := `UPDATE users SET username = ?, email = ?, password = ?, 
	          is_private = ?, profile_privacy = ? WHERE id = ?`
	profilePrivacy := "public"
	if user.IsPrivate {
		profilePrivacy = "private"
	}
	_, err := ExecuteQuery(query, user.Username, user.Email, user.Password,
		user.IsPrivate, profilePrivacy, user.ID)
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
		SET is_private = ?,
			profile_privacy = ?
		WHERE id = ?
	`
	privacy := "public"
	if isPrivate {
		privacy = "private"
	}
	_, err := ExecuteQuery(query, isPrivate, privacy, userID)
	return err
}
