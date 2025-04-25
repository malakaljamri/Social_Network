package database

import (
	"strings"
)

type UserSearchResult struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

// SearchUsersByUsername returns users whose username matches the query (case-insensitive, partial)
func SearchUsersByUsername(query string) ([]UserSearchResult, error) {
	likeQuery := "%" + strings.ToLower(query) + "%"
	rows, err := db.Query(`SELECT id, username FROM users WHERE LOWER(username) LIKE ? LIMIT 10`, likeQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []UserSearchResult
	for rows.Next() {
		var u UserSearchResult
		if err := rows.Scan(&u.ID, &u.Username); err != nil {
			continue
		}
		results = append(results, u)
	}
	return results, nil
}
