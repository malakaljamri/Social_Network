package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"
)

type Group struct {
	ID             int
	Name           string
	Description    string
	CreatorID      int
	CreatedAt      string
	PrivacySetting string
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

// GroupMember represents a group member with user details
type GroupMember struct {
	ID       int    `json:"ID"`
	Username string `json:"Username"`
	Nickname string `json:"Nickname"`
	Avatar   string `json:"Avatar"`
	Online   bool   `json:"Online"`
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
				WHEN g.creator_id = ? THEN 1
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
	err := db.QueryRow(query, userID, groupID, userID, groupID).Scan(&hasAccess)
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

// UpdateLastGroupChatOpenTime updates the last_group_chat_open_time for a user in a group
func UpdateLastGroupChatOpenTime(groupID, userID int) error {
	query := `UPDATE group_members SET last_group_chat_open_time = ? WHERE group_id = ? AND user_id = ?`
	_, err := db.Exec(query, time.Now(), groupID, userID)
	return err
}

// CountUnreadGroupMessages returns the count of unread group messages for userID in groupID
func CountUnreadGroupMessages(groupID, userID int) int {
	var lastOpenTime string
	err := db.QueryRow(`SELECT last_group_chat_open_time FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, userID).Scan(&lastOpenTime)
	if err != nil || lastOpenTime == "" {
		lastOpenTime = "1970-01-01 00:00:00"
	}
	// Use a more explicit timestamp comparison to avoid precision issues
	// Exclude messages sent by the user themselves
	query := `SELECT COUNT(*) FROM group_messages WHERE group_id = ? AND datetime(timestamp) > datetime(?) AND sender_id != ?`
	var count int
	err = db.QueryRow(query, groupID, lastOpenTime, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// GetGroupMemberIDs returns a list of user IDs for all members of a group
func GetGroupMemberIDs(groupID int) []int {
	rows, err := db.Query(`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted'`, groupID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

// GetUnreadGroupCountsForUser returns a map of group_id to unread count for the given user
func GetUnreadGroupCountsForUser(userID int) (map[int]int, error) {
	rows, err := db.Query(`SELECT group_id, last_group_chat_open_time FROM group_members WHERE user_id = ? AND status = 'accepted'`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[int]int)
	for rows.Next() {
		var groupID int
		var lastOpenTime sql.NullString
		if err := rows.Scan(&groupID, &lastOpenTime); err == nil {
			openTime := "1970-01-01 00:00:00"
			if lastOpenTime.Valid && lastOpenTime.String != "" {
				openTime = lastOpenTime.String
			}
			var count int
			// Exclude messages sent by the user themselves
			err2 := db.QueryRow(`SELECT COUNT(*) FROM group_messages WHERE group_id = ? AND datetime(timestamp) > datetime(?) AND sender_id != ?`, groupID, openTime, userID).Scan(&count)
			if err2 == nil {
				counts[groupID] = count
			}
		}
	}
	return counts, nil
}

// GetGroupMembers returns all members of a group with their user details
func GetGroupMembers(db *sql.DB, groupID int) ([]GroupMember, error) {
	log.Printf("🔍 GetGroupMembers called with groupID: %d", groupID)

	query := `
		SELECT u.id, u.username, u.nickname, u.avatar, 0 as online
		FROM group_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = ? AND gm.status = 'accepted'
		ORDER BY u.username
	`

	log.Printf("🔍 Executing query: %s", query)
	rows, err := db.Query(query, groupID)
	if err != nil {
		log.Printf("❌ Database query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var members []GroupMember
	for rows.Next() {
		var member GroupMember
		var online int
		err := rows.Scan(&member.ID, &member.Username, &member.Nickname, &member.Avatar, &online)
		if err != nil {
			log.Printf("❌ Row scan error: %v", err)
			continue
		}
		member.Online = online == 1
		members = append(members, member)
		log.Printf("✅ Added member: %s (ID: %d, Online: %t)", member.Username, member.ID, member.Online)
	}

	log.Printf("✅ GetGroupMembers completed. Found %d members", len(members))
	return members, nil
}

// Fetch pending join requests for a group (with user details)
func GetPendingGroupJoinRequests(db *sql.DB, groupID int) ([]GroupMember, error) {
	query := `
		SELECT u.id, u.username, u.nickname, u.avatar, 0 as online
		FROM group_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = ? AND gm.status = 'pending'
		ORDER BY u.username
	`
	rows, err := db.Query(query, groupID)
	if err != nil {
		log.Printf("❌ Database query error (pending join requests): %v", err)
		return nil, err
	}
	defer rows.Close()

	var requests []GroupMember
	for rows.Next() {
		var member GroupMember
		var online int
		err := rows.Scan(&member.ID, &member.Username, &member.Nickname, &member.Avatar, &online)
		if err != nil {
			log.Printf("❌ Row scan error (pending join requests): %v", err)
			continue
		}
		member.Online = false
		requests = append(requests, member)
	}
	log.Printf("✅ GetPendingGroupJoinRequests completed. Found %d requests", len(requests))
	return requests, nil
}

// Accept or decline a group join request
func HandleGroupJoinRequest(db *sql.DB, groupID, userID int, action string) error {
	var status string
	switch action {
	case "accept":
		status = "accepted"
	case "decline":
		status = "declined"
	default:
		return errors.New("invalid action")
	}
	query := `UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ? AND status = 'pending'`
	res, err := db.Exec(query, status, groupID, userID)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("no pending request found")
	}
	log.Printf("✅ HandleGroupJoinRequest: %s request for user %d in group %d", status, userID, groupID)
	return nil
}
