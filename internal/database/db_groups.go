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
	CreatedAt   string // or time.Time if you want to parse
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


