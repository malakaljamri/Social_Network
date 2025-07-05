package database

import (
	"database/sql"
	"log"
	"strings"
)

var enableLogging = false

type UserSearchResult struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

// SearchUsers returns users whose username, email, or nickname matches the query (case-insensitive, partial)
func SearchUsers(query string) ([]UserSearchResult, error) {
	if enableLogging {log.Printf("=== SearchUsers Debug Start ===")
					  log.Printf("Original query: '%s'", query)}

	// Trim whitespace and check if query is empty
	query = strings.TrimSpace(query)
	if query == "" {
		if enableLogging {
			log.Printf("Query is empty after trimming, returning empty results")
		}
		return []UserSearchResult{}, nil
	}

	likeQuery := "%" + strings.ToLower(query) + "%"
	if enableLogging {
		log.Printf("Processed likeQuery: '%s'", likeQuery)
	}

	// First, let's check what users exist in the database
	if enableLogging {
		log.Printf("Checking all users in database...")
	}
	allUsersQuery := `SELECT id, username, email, nickname FROM users ORDER BY id`
	allRows, err := db.Query(allUsersQuery)
	if err != nil {
		if enableLogging {
			log.Printf("ERROR: Failed to query all users: %v", err)
		}
	} else {
		defer allRows.Close()
		if enableLogging {
			log.Printf("All users in database:")
		}
		for allRows.Next() {
			var id int
			var username, email, nickname sql.NullString
			if err := allRows.Scan(&id, &username, &email, &nickname); err != nil {
				if enableLogging {
					log.Printf("ERROR scanning user row: %v", err)
				}
				continue
			}
			if enableLogging {
				log.Printf("  ID: %d, Username: '%s', Email: '%s', Nickname: '%s'",
					id,
					username.String,
					email.String,
					nickname.String)
			}
		}
	}

	// Now perform the actual search
	searchQuery := `SELECT id, username, email, nickname, avatar FROM users WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(nickname) LIKE ? LIMIT 10`
	if enableLogging {
		log.Printf("Executing search query: %s", searchQuery)
		log.Printf("With parameters: likeQuery='%s', likeQuery='%s', likeQuery='%s'", likeQuery, likeQuery, likeQuery)
	}

	rows, err := db.Query(searchQuery, likeQuery, likeQuery, likeQuery)
	if err != nil {
		if enableLogging {
			log.Printf("ERROR: Database query failed: %v", err)
		}
		return nil, err
	}
	defer rows.Close()

	var results []UserSearchResult
	if enableLogging {
		log.Printf("Processing search results...")
	}

	for rows.Next() {
		var u UserSearchResult
		var username, email, nickname, avatar sql.NullString

		if err := rows.Scan(&u.ID, &username, &email, &nickname, &avatar); err != nil {
			if enableLogging {
				log.Printf("ERROR scanning result row: %v", err)
			}
			continue
		}

		u.Username = username.String
		u.Email = email.String
		u.Nickname = nickname.String
		u.Avatar = avatar.String

		if enableLogging {
			log.Printf("Found match: ID=%d, Username='%s', Email='%s', Nickname='%s'",
				u.ID, u.Username, u.Email, u.Nickname)
		}

		results = append(results, u)
	}

	if enableLogging {
		log.Printf("Total results found: %d", len(results))
		log.Printf("=== SearchUsers Debug End ===")
	}

	return results, nil
}
