package database

import (
	"database/sql"
	"errors"
)

type Group struct {
	ID          int
	Name        string
	Description string
	CreatorID   int
	CreatedAt   string // or time.Time if you want to parse
}

func CreateGroup(db *sql.DB, group *Group) error {
	if group == nil {
		return errors.New("group cannot be nil")
	}
	_, err := db.Exec(
		`INSERT INTO groups (name, description, creator_id) VALUES (?, ?, ?)`,
		group.Name, group.Description, group.CreatorID,
	)
	return err
}

