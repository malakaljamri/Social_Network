package database

import (
	"database/sql"
)

type Group struct {
	ID          int
	Name        string
	Description string
	IsPrivate   bool
	UserID      int
}

func CreateGroup(db *sql.DB, name, description string, isPrivate bool, userID int) error {
	_, err := db.Exec(`
		INSERT INTO groups (name, description, is_private, user_id)
		VALUES (?, ?, ?, ?)`,
		name, description, isPrivate, userID)
	return err
}

func GetAllGroups(db *sql.DB) ([]Group, error) {
	rows, err := db.Query(`
		SELECT id, name, description, is_private, user_id
		FROM groups
		ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.IsPrivate, &g.UserID); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}
