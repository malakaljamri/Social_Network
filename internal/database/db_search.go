package database

import (
	"strings"
)

type UserSearchResult struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

// SearchUsers returns users whose username, email, or nickname matches the query (case-insensitive, partial)
func SearchUsers(query string) ([]UserSearchResult, error) {
	likeQuery := "%" + strings.ToLower(query) + "%"
	rows, err := db.Query(`SELECT id, username, email, nickname, avatar FROM users WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(nickname) LIKE ? LIMIT 10`, likeQuery, likeQuery, likeQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []UserSearchResult
	for rows.Next() {
		var u UserSearchResult
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Nickname, &u.Avatar); err != nil {
			continue
		}
		results = append(results, u)
	}
	return results, nil
}
