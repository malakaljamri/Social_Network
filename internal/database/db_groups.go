package database

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
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
				WHEN COALESCE(g.privacy_setting, 'private') = 'custom' AND EXISTS (
					SELECT 1 FROM group_members 
					WHERE group_id = ? AND user_id = ? AND status = 'accepted'
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
	err := db.QueryRow(query, userID, userID, groupID, userID, groupID, userID, groupID).Scan(&hasAccess)
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

// AddSelectedUsersToCustomGroup adds selected users to a custom privacy group
func AddSelectedUsersToCustomGroup(db *sql.DB, groupID int, userIDs []int) error {
	if len(userIDs) == 0 {
		return nil
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// Prepare the insert statement
	query := `INSERT OR IGNORE INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`
	stmt, err := tx.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	// Insert each user
	for _, userID := range userIDs {
		_, err := stmt.Exec(groupID, userID)
		if err != nil {
			return fmt.Errorf("failed to add user %d to group: %v", userID, err)
		}
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	return nil
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
	query := `SELECT COUNT(*) FROM group_messages WHERE group_id = ? AND datetime(timestamp) > datetime(?)`
	var count int
	err = db.QueryRow(query, groupID, lastOpenTime).Scan(&count)
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
			err2 := db.QueryRow(`SELECT COUNT(*) FROM group_messages WHERE group_id = ? AND datetime(timestamp) > datetime(?)`, groupID, openTime).Scan(&count)
			if err2 == nil {
				counts[groupID] = count
			}
		}
	}
	return counts, nil
}

// GetGroupMembers returns all members of a group with their details, always including the group creator (admin)
func GetGroupMembers(db *sql.DB, groupID int) ([]map[string]interface{}, error) {
	// First, get the group creator
	var creatorID int
	var creatorUsername, creatorAvatar, creatorFirstName, creatorLastName string
	err := db.QueryRow(`SELECT g.creator_id, u.username, u.avatar, u.first_name, u.last_name FROM groups g JOIN users u ON g.creator_id = u.id WHERE g.id = ?`, groupID).Scan(&creatorID, &creatorUsername, &creatorAvatar, &creatorFirstName, &creatorLastName)
	if err != nil {
		return nil, err
	}

	// Get all accepted members (excluding the creator if present)
	query := `
		SELECT u.id, u.username, u.avatar, u.first_name, u.last_name, gm.status, gm.last_group_chat_open_time
		FROM group_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = ? AND gm.status = 'accepted' AND u.id != ?
		ORDER BY u.username ASC
	`
	rows, err := db.Query(query, groupID, creatorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []map[string]interface{}
	// Add the admin first
	admin := map[string]interface{}{
		"id":             creatorID,
		"username":       creatorUsername,
		"avatar":         creatorAvatar,
		"first_name":     creatorFirstName,
		"last_name":      creatorLastName,
		"status":         "admin",
		"last_chat_time": "",
	}
	members = append(members, admin)

	for rows.Next() {
		var member map[string]interface{} = make(map[string]interface{})
		var userID int
		var username, avatar, firstName, lastName, status, lastChatTime string

		err := rows.Scan(&userID, &username, &avatar, &firstName, &lastName, &status, &lastChatTime)
		if err != nil {
			continue
		}
		member["id"] = userID
		member["username"] = username
		member["avatar"] = avatar
		member["first_name"] = firstName
		member["last_name"] = lastName
		member["status"] = status
		member["last_chat_time"] = lastChatTime
		members = append(members, member)
	}
	return members, nil
}

// RequestGroupInvite creates a group invitation request that needs admin approval
func RequestGroupInvite(db *sql.DB, inviterID, inviteeID, groupID int) error {
	// First check if the inviter has access to the group
	hasAccess, err := CheckUserGroupAccess(db, inviterID, groupID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return errors.New("inviter does not have access to this group")
	}

	// Check if invitee is already a member
	membershipStatus, err := CheckUserGroupMembership(db, inviteeID, groupID)
	if err != nil {
		return err
	}
	if membershipStatus == "accepted" {
		return errors.New("user is already a member of this group")
	}

	// Get group creator/admin
	var creatorID int
	err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		return err
	}

	// Create notification for admin approval
	actionData := map[string]interface{}{
		"action":     "group_invite_response",
		"group_id":   groupID,
		"inviter_id": inviterID,
		"invitee_id": inviteeID,
	}

	err = CreateNotification(
		creatorID, // admin receives notification
		inviterID, // inviter is sender
		groupID,   // reference to the group
		"group_invite_request",
		true, // action required
		actionData,
		"would like to invite",
	)

	return err
}

// ApproveGroupInvite approves a group invitation and sends notification to invitee
func ApproveGroupInvite(db *sql.DB, adminID, inviterID, inviteeID, groupID int) error {
	// Verify admin is the group creator
	var creatorID int
	err := db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		return err
	}
	if adminID != creatorID {
		return errors.New("only group admin can approve invitations")
	}

	// Add invitee to group with accepted status
	query := `INSERT OR REPLACE INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`
	_, err = db.Exec(query, groupID, inviteeID)
	if err != nil {
		return err
	}

	// Send notification to invitee
	actionData := map[string]interface{}{
		"action":     "group_response",
		"group_id":   groupID,
		"inviter_id": inviterID,
	}

	err = CreateNotification(
		inviteeID, // invitee receives notification
		inviterID, // inviter is sender
		groupID,   // reference to the group
		"group_invitation",
		true, // action required
		actionData,
		"invites you to join",
	)

	return err
}

// DeclineGroupInvite declines a group invitation
func DeclineGroupInvite(db *sql.DB, adminID, inviterID, inviteeID, groupID int) error {
	// Verify admin is the group creator
	var creatorID int
	err := db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		return err
	}
	if adminID != creatorID {
		return errors.New("only group admin can decline invitations")
	}

	// Remove any pending membership
	query := `DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'pending'`
	_, err = db.Exec(query, groupID, inviteeID)

	return err
}

// GetGroupCreatorID returns the creator ID of a group
func GetGroupCreatorID(db *sql.DB, groupID int) (int, error) {
	var creatorID int
	err := db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	return creatorID, err
}
