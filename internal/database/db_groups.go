package database

import (
	"database/sql"
	"errors"
	"fmt"
)

type Group struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	CreatorID      int    `json:"creator_id"`
	CreatedAt      string `json:"created_at"`
	PrivacySetting string `json:"privacy_setting"`
}

type GroupWithCreator struct {
	ID             int        `json:"ID"`
	Name           string     `json:"Name"`
	Description    string     `json:"Description"`
	CreatedAt      string     `json:"CreatedAt"`
	PrivacySetting string     `json:"PrivacySetting"`
	Creator        UserDetail `json:"Creator"`
}

type UserDetail struct {
	Username string `json:"Username"`
}

func CreateGroup(db *sql.DB, group *Group) error {
	if group == nil {
		return errors.New("group cannot be nil")
	}

	query := `
		INSERT INTO groups (name, description, creator_id, privacy_setting)
		VALUES (?, ?, ?, ?)
	`
	_, err := db.Exec(query, group.Name, group.Description, group.CreatorID, group.PrivacySetting)
	if err != nil {
		return fmt.Errorf("failed to insert group: %v", err)
	}

	return nil
}

func GetAllGroups(db *sql.DB) ([]GroupWithCreator, error) {
	query := `
		SELECT g.id, g.name, g.description, g.created_at, 
			COALESCE(g.privacy_setting, 'private') as privacy_setting, u.username
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
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.CreatedAt, &g.PrivacySetting, &g.Creator.Username)
		if err != nil {
			return nil, err
		}
		if g.PrivacySetting == "" {
			g.PrivacySetting = "private"
		}
		groups = append(groups, g)
	}

	return groups, nil
}

// CheckUserGroupAccess checks if a user has access to a group
func CheckUserGroupAccess(db *sql.DB, userID, groupID int) (bool, error) {
	query := `
		SELECT 
			CASE 
				WHEN COALESCE(g.privacy_setting, 'private') = 'public' THEN 1
				WHEN g.creator_id = ? THEN 1
				WHEN COALESCE(g.privacy_setting, 'private') = 'private' AND EXISTS (
					SELECT 1 FROM followers 
					WHERE follower_id = ? AND followed_id = g.creator_id AND status = 'accepted'
				) THEN 1
				WHEN EXISTS (
					SELECT 1 FROM group_members 
					WHERE group_id = ? AND user_id = ? AND status = 'accepted'
				) THEN 1
				ELSE 0
			END as has_access
		FROM groups g
		WHERE g.id = ?
	`

	var hasAccess int
	err := db.QueryRow(query, userID, userID, groupID, userID, groupID).Scan(&hasAccess)
	if err != nil {
		return false, err
	}

	return hasAccess == 1, nil
}

// RequestGroupJoin adds a user to group_members with pending status
func RequestGroupJoin(db *sql.DB, userID, groupID int) error {
	query := `
		INSERT OR REPLACE INTO group_members (group_id, user_id, status)
		VALUES (?, ?, 'pending')
	`

	_, err := db.Exec(query, groupID, userID)
	return err
}

// CheckUserGroupMembership checks if user is a member of the group and returns status
func CheckUserGroupMembership(db *sql.DB, userID, groupID int) (string, error) {
	query := `
		SELECT status FROM group_members 
		WHERE group_id = ? AND user_id = ?
	`

	var status string
	err := db.QueryRow(query, groupID, userID).Scan(&status)
	if err == sql.ErrNoRows {
		return "", nil // User is not a member
	}
	if err != nil {
		return "", err
	}

	return status, nil
}

// AddCreatorFollowersToPrivateGroup adds all followers of the group creator to the group
func AddCreatorFollowersToPrivateGroup(db *sql.DB, groupID, creatorID int) error {
	query := `
		INSERT OR IGNORE INTO group_members (group_id, user_id, status)
		SELECT ?, follower_id, 'accepted'
		FROM followers 
		WHERE followed_id = ? AND status = 'accepted'
	`

	_, err := db.Exec(query, groupID, creatorID)
	return err
}
