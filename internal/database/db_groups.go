package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
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

// GroupMember represents a group member with user details
type GroupMember struct {
	ID       int     `json:"ID"`
	Username string  `json:"Username"`
	Nickname *string `json:"Nickname,omitempty"`
	Avatar   *string `json:"Avatar,omitempty"`
	Online   bool    `json:"Online"`
}

// GroupInvitation represents a group invitation
type GroupInvitation struct {
	ID              int    `json:"id"`
	GroupID         int    `json:"group_id"`
	GroupName       string `json:"group_name"`
	InviterID       int    `json:"inviter_id"`
	InviterUsername string `json:"inviter_username"`
	InviteeID       int    `json:"invitee_id"`
	Status          string `json:"status"` // "pending", "accepted", "declined"
	CreatedAt       string `json:"created_at"`
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
	log.Printf("🔍 RequestGroupJoin called: userID=%d, groupID=%d", userID, groupID)

	query := `
		INSERT OR REPLACE INTO group_members (group_id, user_id, status)
		VALUES (?, ?, 'pending')
	`

	log.Printf("🔍 Executing query: %s with userID=%d, groupID=%d", query, userID, groupID)

	result, err := db.Exec(query, groupID, userID)
	if err != nil {
		log.Printf("❌ Failed to insert join request: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✅ Join request inserted successfully. Rows affected: %d", rowsAffected)

	return nil
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

// GetGroupAccessAndMembership returns both access status and membership status for a user in a group
func GetGroupAccessAndMembership(db *sql.DB, userID, groupID int) (bool, string, error) {
	hasAccess, err := CheckUserGroupAccess(db, userID, groupID)
	if err != nil {
		return false, "", err
	}

	membershipStatus, err := CheckUserGroupMembership(db, userID, groupID)
	if err != nil {
		return false, "", err
	}

	return hasAccess, membershipStatus, nil
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
		var nickname, avatar sql.NullString
		err := rows.Scan(&member.ID, &member.Username, &nickname, &avatar, &online)
		if err != nil {
			log.Printf("❌ Row scan error: %v", err)
			continue
		}

		// Handle nullable strings
		if nickname.Valid {
			member.Nickname = &nickname.String
		}
		if avatar.Valid {
			member.Avatar = &avatar.String
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
	log.Printf("🔍 GetPendingGroupJoinRequests called for group ID: %d", groupID)

	query := `
		SELECT u.id, u.username, u.nickname, u.avatar, 0 as online
		FROM group_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = ? AND gm.status = 'pending'
		ORDER BY u.username
	`

	log.Printf("🔍 Executing query: %s with groupID: %d", query, groupID)

	rows, err := db.Query(query, groupID)
	if err != nil {
		log.Printf("❌ Database query error (pending join requests): %v", err)
		return make([]GroupMember, 0), err
	}
	defer rows.Close()

	var requests []GroupMember = make([]GroupMember, 0) // Initialize as empty slice, not nil
	for rows.Next() {
		var member GroupMember
		var online int
		var nickname, avatar sql.NullString
		err := rows.Scan(&member.ID, &member.Username, &nickname, &avatar, &online)
		if err != nil {
			log.Printf("❌ Row scan error (pending join requests): %v", err)
			continue
		}

		// Handle nullable strings
		if nickname.Valid {
			member.Nickname = &nickname.String
		}
		if avatar.Valid {
			member.Avatar = &avatar.String
		}

		member.Online = false
		requests = append(requests, member)
		log.Printf("🔍 Scanned member: ID=%d, Username=%s", member.ID, member.Username)
	}

	log.Printf("✅ GetPendingGroupJoinRequests completed. Found %d requests", len(requests))

	// Debug: Let's also check what's actually in the group_members table for this group
	var debugQuery = `SELECT user_id, status FROM group_members WHERE group_id = ?`
	debugRows, err := db.Query(debugQuery, groupID)
	if err != nil {
		log.Printf("⚠️ Debug query failed: %v", err)
	} else {
		defer debugRows.Close()
		log.Printf("🔍 Debug: All group_members for group %d:", groupID)
		for debugRows.Next() {
			var userID int
			var status string
			if err := debugRows.Scan(&userID, &status); err == nil {
				log.Printf("🔍 Debug: user_id=%d, status=%s", userID, status)
			}
		}
	}

	// Always return a slice, never nil
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

	// Automatically delete the notification for this join request since it's no longer pending
	err = DeleteGroupJoinRequestNotification(db, groupID, userID)
	if err != nil {
		log.Printf("⚠️ Warning: Failed to delete notification for handled join request: %v", err)
		// Don't return error here as the main operation (handling join request) was successful
	}

	return nil
}

// CreateGroupInvitation creates a new group invitation
func CreateGroupInvitation(db *sql.DB, groupID, inviterID, inviteeID int) error {
	log.Printf("🔍 Creating group invitation: groupID=%d, inviterID=%d, inviteeID=%d", groupID, inviterID, inviteeID)

	query := `
		INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status)
		VALUES (?, ?, ?, 'pending')
	`

	_, err := db.Exec(query, groupID, inviterID, inviteeID)
	if err != nil {
		log.Printf("❌ Error creating group invitation: %v", err)
		return err
	}

	log.Printf("✅ Group invitation created successfully")
	return nil
}

// GetPendingGroupInvitations returns all pending invitations for a user
func GetPendingGroupInvitations(db *sql.DB, userID int) ([]GroupInvitation, error) {
	log.Printf("🔍 Fetching pending group invitations for user: %d", userID)

	query := `
		SELECT gi.id, gi.group_id, g.name as group_name, gi.inviter_id, 
		       u.username as inviter_username, gi.invitee_id, gi.status, gi.created_at
		FROM group_invitations gi
		JOIN groups g ON gi.group_id = g.id
		JOIN users u ON gi.inviter_id = u.id
		WHERE gi.invitee_id = ? AND gi.status = 'pending'
		ORDER BY gi.created_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("❌ Error fetching group invitations: %v", err)
		return nil, err
	}
	defer rows.Close()

	var invitations []GroupInvitation = make([]GroupInvitation, 0)
	for rows.Next() {
		var inv GroupInvitation
		err := rows.Scan(&inv.ID, &inv.GroupID, &inv.GroupName, &inv.InviterID,
			&inv.InviterUsername, &inv.InviteeID, &inv.Status, &inv.CreatedAt)
		if err != nil {
			log.Printf("❌ Error scanning invitation: %v", err)
			continue
		}
		invitations = append(invitations, inv)
	}

	log.Printf("✅ Found %d pending group invitations", len(invitations))
	return invitations, nil
}

// HandleGroupInvitation accepts or declines a group invitation
func HandleGroupInvitation(db *sql.DB, invitationID, userID int, action string) (int, error) {
	log.Printf("🔍 Handling group invitation: invitationID=%d, userID=%d, action=%s", invitationID, userID, action)

	var status string
	switch action {
	case "accept":
		status = "accepted"
	case "decline":
		status = "declined"
	default:
		return 0, errors.New("invalid action")
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Update invitation status
	updateQuery := `UPDATE group_invitations SET status = ? WHERE id = ? AND invitee_id = ? AND status = 'pending'`
	res, err := tx.Exec(updateQuery, status, invitationID, userID)
	if err != nil {
		log.Printf("❌ Error updating invitation: %v", err)
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return 0, errors.New("no pending invitation found")
	}

	// Get group ID from invitation (needed for both accept and decline)
	var groupID int
	err = tx.QueryRow("SELECT group_id FROM group_invitations WHERE id = ?", invitationID).Scan(&groupID)
	if err != nil {
		log.Printf("❌ Error getting group ID from invitation: %v", err)
		return 0, err
	}

	// If accepting, add user to group
	if action == "accept" {
		// Add user to group_members
		memberQuery := `INSERT OR REPLACE INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`
		_, err = tx.Exec(memberQuery, groupID, userID)
		if err != nil {
			log.Printf("❌ Error adding user to group: %v", err)
			return 0, err
		}

		log.Printf("✅ User %d added to group %d", userID, groupID)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("❌ Error committing transaction: %v", err)
		return 0, err
	}

	log.Printf("✅ Group invitation %s successfully", action)
	return groupID, nil
}

// CheckIfUserInvited checks if a user has been invited to a group
func CheckIfUserInvited(db *sql.DB, groupID, userID int) (bool, error) {
	query := `SELECT COUNT(*) FROM group_invitations WHERE group_id = ? AND invitee_id = ? AND status = 'pending'`
	var count int
	err := db.QueryRow(query, groupID, userID).Scan(&count)
	return count > 0, err
}

// GetUserGroupInvitations gets all pending group invitations for a user
func GetUserGroupInvitations(db *sql.DB, userID int) ([]GroupInvitation, error) {
	query := `
		SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.status, gi.created_at,
		       g.name as group_name, u.username as inviter_name
		FROM group_invitations gi
		JOIN groups g ON gi.group_id = g.id
		JOIN users u ON gi.inviter_id = u.id
		WHERE gi.invitee_id = ? AND gi.status = 'pending'
		ORDER BY gi.created_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []GroupInvitation = make([]GroupInvitation, 0)
	for rows.Next() {
		var inv GroupInvitation
		err := rows.Scan(&inv.ID, &inv.GroupID, &inv.InviterID, &inv.InviteeID, &inv.Status, &inv.CreatedAt, &inv.GroupName, &inv.InviterUsername)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}

	return invitations, nil
}

// GetGroupInvitations gets all invitations for a specific group (for group owners)
func GetGroupInvitations(db *sql.DB, groupID, userID int) ([]GroupInvitation, error) {
	// Check if user is group owner
	var creatorID int
	err := db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		return nil, err
	}
	if creatorID != userID {
		return nil, fmt.Errorf("only group owner can view invitations")
	}

	query := `
		SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.status, gi.created_at,
		       g.name as group_name, u1.username as inviter_name, u2.username as invitee_name
		FROM group_invitations gi
		JOIN groups g ON gi.group_id = g.id
		JOIN users u1 ON gi.inviter_id = u1.id
		JOIN users u2 ON gi.invitee_id = u2.id
		WHERE gi.group_id = ?
		ORDER BY gi.created_at DESC
	`

	rows, err := db.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []GroupInvitation = make([]GroupInvitation, 0)
	for rows.Next() {
		var inv GroupInvitation
		err := rows.Scan(&inv.ID, &inv.GroupID, &inv.InviterID, &inv.InviteeID, &inv.Status, &inv.CreatedAt,
			&inv.GroupName, &inv.InviterUsername)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}

	return invitations, nil
}

// DeleteGroupInvitation deletes a group invitation
func DeleteGroupInvitation(db *sql.DB, invitationID int) error {
	_, err := db.Exec("DELETE FROM group_invitations WHERE id = ?", invitationID)
	return err
}

// GroupInvitationRequest represents a group invitation request that needs owner approval
type GroupInvitationRequest struct {
	ID              int    `json:"id"`
	GroupID         int    `json:"group_id"`
	GroupName       string `json:"group_name"`
	InviterID       int    `json:"inviter_id"`
	InviterUsername string `json:"inviter_username"`
	InviteeID       int    `json:"invitee_id"`
	InviteeUsername string `json:"invitee_username"`
	Status          string `json:"status"` // "pending", "approved", "rejected"
	CreatedAt       string `json:"created_at"`
}

// CreateGroupInvitationRequest creates a new invitation request for private groups
func CreateGroupInvitationRequest(db *sql.DB, groupID, inviterID, inviteeID int) error {
	query := `INSERT INTO group_invitation_requests (group_id, inviter_id, invitee_id) VALUES (?, ?, ?)`
	_, err := db.Exec(query, groupID, inviterID, inviteeID)
	if err != nil {
		log.Printf("❌ Failed to create group invitation request: %v", err)
		return err
	}
	log.Printf("✅ Created group invitation request: groupID=%d, inviterID=%d, inviteeID=%d", groupID, inviterID, inviteeID)
	return nil
}

// GetPendingInvitationRequests gets all pending invitation requests for a group owner
func GetPendingInvitationRequests(db *sql.DB, groupID int) ([]GroupInvitationRequest, error) {
	log.Printf("🔍 DEBUG: GetPendingInvitationRequests called for groupID=%d", groupID)

	query := `
		SELECT gir.id, gir.group_id, gir.inviter_id, gir.invitee_id, gir.status, gir.created_at,
		       g.name as group_name, u1.username as inviter_username, u2.username as invitee_username
		FROM group_invitation_requests gir
		JOIN groups g ON gir.group_id = g.id
		JOIN users u1 ON gir.inviter_id = u1.id
		JOIN users u2 ON gir.invitee_id = u2.id
		WHERE gir.group_id = ? AND gir.status = 'pending'
		ORDER BY gir.created_at DESC
	`

	log.Printf("🔍 DEBUG: Executing query: %s with groupID=%d", query, groupID)

	rows, err := db.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []GroupInvitationRequest = make([]GroupInvitationRequest, 0)
	for rows.Next() {
		var req GroupInvitationRequest
		err := rows.Scan(&req.ID, &req.GroupID, &req.InviterID, &req.InviteeID, &req.Status, &req.CreatedAt,
			&req.GroupName, &req.InviterUsername, &req.InviteeUsername)
		if err != nil {
			log.Printf("❌ Error scanning invitation request: %v", err)
			return nil, err
		}
		log.Printf("🔍 DEBUG: Found invitation request: ID=%d, GroupID=%d, Status=%s, Inviter=%s, Invitee=%s",
			req.ID, req.GroupID, req.Status, req.InviterUsername, req.InviteeUsername)
		requests = append(requests, req)
	}

	log.Printf("✅ DEBUG: Returning %d invitation requests for groupID=%d", len(requests), groupID)
	return requests, nil
}

// HandleInvitationRequest handles approval/rejection of invitation requests by group owner
func HandleInvitationRequest(db *sql.DB, requestID, ownerID int, action string) error {
	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Get the invitation request details
	var groupID, inviterID, inviteeID int
	err = tx.QueryRow(`
		SELECT gir.group_id, gir.inviter_id, gir.invitee_id 
		FROM group_invitation_requests gir
		JOIN groups g ON gir.group_id = g.id
		WHERE gir.id = ? AND g.creator_id = ?
	`, requestID, ownerID).Scan(&groupID, &inviterID, &inviteeID)
	if err != nil {
		return fmt.Errorf("invitation request not found or you're not the group owner")
	}

	if action == "approve" {
		// Update the request status to approved
		_, err = tx.Exec("UPDATE group_invitation_requests SET status = 'approved' WHERE id = ?", requestID)
		if err != nil {
			return err
		}

		// Create the actual invitation
		_, err = tx.Exec(`
			INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status) 
			VALUES (?, ?, ?, 'pending')
		`, groupID, inviterID, inviteeID)
		if err != nil {
			return err
		}

		// Create notification for invitee
		_, err = tx.Exec("INSERT INTO notifications (user_id, type, reference_id) VALUES (?, ?, ?)", inviteeID, "group_invitation", groupID)
		if err != nil {
			log.Printf("⚠️ Failed to create invitation notification: %v", err)
		}

		log.Printf("✅ Invitation request approved: requestID=%d, groupID=%d, inviteeID=%d", requestID, groupID, inviteeID)
	} else if action == "reject" {
		// Update the request status to rejected
		_, err = tx.Exec("UPDATE group_invitation_requests SET status = 'rejected' WHERE id = ?", requestID)
		if err != nil {
			return err
		}

		log.Printf("✅ Invitation request rejected: requestID=%d, groupID=%d, inviteeID=%d", requestID, groupID, inviteeID)
	} else {
		return fmt.Errorf("invalid action: %s", action)
	}

	// Delete the notification for the group owner (both approve and reject)
	_, err = tx.Exec("DELETE FROM notifications WHERE user_id = ? AND type = 'group_invitation_request' AND reference_id = ?", ownerID, groupID)
	if err != nil {
		log.Printf("⚠️ Failed to delete invitation request notification: %v", err)
	} else {
		log.Printf("✅ Deleted invitation request notification for owner %d, group %d", ownerID, groupID)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

// CheckIfGroupIsPrivate checks if a group is private
func CheckIfGroupIsPrivate(db *sql.DB, groupID int) (bool, error) {
	var privacySetting string
	err := db.QueryRow("SELECT privacy_setting FROM groups WHERE id = ?", groupID).Scan(&privacySetting)
	if err != nil {
		return false, err
	}
	return privacySetting == "private", nil
}

// CheckIfInvitationRequestExists checks if an invitation request already exists
func CheckIfInvitationRequestExists(db *sql.DB, groupID, inviteeID int) (bool, error) {
	query := `SELECT COUNT(*) FROM group_invitation_requests WHERE group_id = ? AND invitee_id = ? AND status = 'pending'`
	var count int
	err := db.QueryRow(query, groupID, inviteeID).Scan(&count)
	return count > 0, err
}
