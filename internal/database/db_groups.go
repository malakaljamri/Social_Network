package database

import (
	"database/sql"
	"errors"
	"fmt"
)

type Group struct {
	ID          int
	Name        string
	Description string
	CreatorID   int
	CreatedAt   string
}

type GroupWithCreator struct {
	ID          int        `json:"ID"`
	Name        string     `json:"Name"`
	Description string     `json:"Description"`
	CreatedAt   string     `json:"CreatedAt"`
	Creator     UserDetail `json:"Creator"`
}

type UserDetail struct {
	Username string `json:"Username"`
}

func CreateGroup(db *sql.DB, group *Group) error {
	if group == nil {
		return errors.New("group cannot be nil")
	}

	query := `
		INSERT INTO groups (name, description, creator_id)
		VALUES (?, ?, ?)
	`
	_, err := db.Exec(query, group.Name, group.Description, group.CreatorID)
	if err != nil {
		return fmt.Errorf("failed to insert group: %v", err)
	}

	return nil
}

func GetAllGroups(db *sql.DB) ([]GroupWithCreator, error) {
	query := `
		SELECT g.id, g.name, g.description, g.created_at, u.username
		FROM groups g
		JOIN users u ON g.creator_id = u.id
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []GroupWithCreator
	for rows.Next() {
		var g GroupWithCreator
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.CreatedAt, &g.Creator.Username)
		if err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	return groups, nil
}
