package database

import (
	"errors"
	"fmt"
	"net/http"
	"social_network/internal/models"
	"time"
)

func CreateSession(session *models.Session) error {
	query := `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
	_, err := ExecuteQuery(query, session.UserID, session.Token, session.ExpiresAt)
	return err
}

func GetSessionByToken(token string) (models.Session, error) {
	query := `SELECT id, user_id, token, expires_at FROM sessions WHERE token = ?`
	rows, err := FetchData(query, token)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()

	var session models.Session
	if rows.Next() {
		err := rows.Scan(&session.ID, &session.UserID, &session.Token, &session.ExpiresAt)
		if err != nil {
			return models.Session{}, err
		}
	} else {
		return models.Session{}, errors.New("session not found")
	}
	return session, nil
}

func DeleteSession(token string) error {
	query := `DELETE FROM sessions WHERE token = ?`
	_, err := ExecuteQuery(query, token)
	return err
}

func GetUserIDFromSession(r *http.Request) (int, error) {
	c, err := r.Cookie("session_token")
	if err != nil {
		if err == http.ErrNoCookie {
			return 0, fmt.Errorf("no session cookie present from client: 💻 %s", r.RemoteAddr)
		}
		return 0, err
	}
	sessionToken := c.Value

	session, err := GetSessionByToken(sessionToken)
	if err != nil {
		return 0, err
	}

	if time.Now().After(session.ExpiresAt) {
		DeleteSession(sessionToken)
		return 0, errors.New("session expired")
	}

	return session.UserID, nil
}

func DeleteSessionsByUserID(userID int) error {
	query := `DELETE FROM sessions WHERE user_id = ?`
	_, err := ExecuteQuery(query, userID)
	return err
}
