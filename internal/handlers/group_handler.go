package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"
	"strconv"
	"strings"
	"time"
)

func CreateGroupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/create")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		// Parse the request body
		var requestData struct {
			Name            string `json:"name"`
			Description     string `json:"description"`
			PrivacySetting  string `json:"privacy_setting"`
			SelectedUserIDs []int  `json:"selected_user_ids"`
		}

		err = json.NewDecoder(r.Body).Decode(&requestData)
		if err != nil {
			log.Printf("❌ Failed to decode request body: %v", err)
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		log.Printf("Received group creation request: %+v (privacy_setting: %s)", requestData, requestData.PrivacySetting)

		// Set default privacy setting if not provided
		if requestData.PrivacySetting == "" {
			requestData.PrivacySetting = "public"
		}

		// Validate custom privacy requires selected users
		if requestData.PrivacySetting == "custom" && len(requestData.SelectedUserIDs) == 0 {
			utils.WriteJSONError(w, http.StatusBadRequest, "Custom privacy requires at least one selected user")
			return
		}

		// Create group object
		// Handle 'custom' privacy setting by converting to 'private' for now
		privacySetting := requestData.PrivacySetting
		if privacySetting == "custom" {
			privacySetting = "private"
		}

		group := database.Group{
			Name:           requestData.Name,
			Description:    requestData.Description,
			PrivacySetting: privacySetting,
			CreatorID:      userID,
		}

		log.Printf("📦 Creating group: %+v", group)

		err = database.CreateGroup(db, &group)
		if err != nil {
			log.Printf("❌ Failed to insert group: %v", err)
			// Check if it's a unique constraint violation
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				utils.WriteJSONError(w, http.StatusConflict, "A group with this name already exists")
			} else {
				utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create group: %v", err))
			}
			return
		}

		log.Println("✅ Group inserted into DB")

		// If group is private, automatically add all followers of the creator
		if group.PrivacySetting == "private" {
			err = database.AddCreatorFollowersToPrivateGroup(db, group.ID, userID)
			if err != nil {
				log.Printf("⚠️ Failed to add creator followers to private group: %v", err)
			} else {
				log.Println("✅ Added creator followers to private group")

				// Send notifications to all followers
				followersQuery := `SELECT follower_id FROM followers WHERE followed_id = ? AND status = 'accepted'`
				followerRows, err := db.Query(followersQuery, userID)
				if err == nil {
					defer followerRows.Close()
					for followerRows.Next() {
						var followerID int
						if err := followerRows.Scan(&followerID); err == nil {
							actionData := map[string]interface{}{
								"action":     "group_response",
								"group_id":   group.ID,
								"inviter_id": userID,
							}
							err = database.CreateNotification(
								followerID, // follower receives notification
								userID,     // group creator is sender
								group.ID,   // reference to the group
								"group_invitation",
								true, // action required
								actionData,
								"invited you to join",
							)
							if err != nil {
								log.Printf("WARNING: Failed to create group invitation notification: %v", err)
							}
						}
					}
				}
			}
		}

		// If group was originally custom, add selected users (even though privacy setting is now private)
		if requestData.PrivacySetting == "custom" && len(requestData.SelectedUserIDs) > 0 {
			err = database.AddSelectedUsersToCustomGroup(db, group.ID, requestData.SelectedUserIDs)
			if err != nil {
				log.Printf("⚠️ Failed to add selected users to custom group: %v", err)
			} else {
				log.Printf("✅ Added %d selected users to custom group", len(requestData.SelectedUserIDs))

				// Send notifications to selected users
				for _, selectedUserID := range requestData.SelectedUserIDs {
					actionData := map[string]interface{}{
						"action":     "group_response",
						"group_id":   group.ID,
						"inviter_id": userID,
					}
					err = database.CreateNotification(
						selectedUserID, // selected user receives notification
						userID,         // group creator is sender
						group.ID,       // reference to the group
						"group_invitation",
						true, // action required
						actionData,
						"invited you to join",
					)
					if err != nil {
						log.Printf("WARNING: Failed to create group invitation notification: %v", err)
					}
				}
			}
		}

		// Get creator information
		var creatorUsername string
		err = db.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&creatorUsername)
		if err != nil {
			log.Printf("❌ Failed to get creator username: %v", err)
		}

		// Broadcast new group to all clients
		// Use original privacy setting for the broadcast
		broadcastPrivacySetting := requestData.PrivacySetting
		message := websocket.Message{
			Type: "group_created",
			Content: map[string]interface{}{
				"id":              group.ID,
				"name":            group.Name,
				"description":     group.Description,
				"created_at":      group.CreatedAt,
				"privacy_setting": broadcastPrivacySetting,
				"creator": map[string]interface{}{
					"username": creatorUsername,
				},
			},
		}
		jsonMessage, err := json.Marshal(message)
		if err == nil {
			websocket.MainHub.Broadcast <- jsonMessage
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":              group.ID,
			"name":            group.Name,
			"description":     group.Description,
			"created_at":      group.CreatedAt,
			"privacy_setting": broadcastPrivacySetting,
			"creator": map[string]interface{}{
				"username": creatorUsername,
			},
		})
	}
}

func GetAllGroupsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groups, err := database.GetAllGroups(db)
		if err != nil {
			http.Error(w, "Failed to fetch groups", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(groups)
	}
}

func CheckGroupAccessHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Group ID is required")
			return
		}

		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
			return
		}

		hasAccess, err := database.CheckUserGroupAccess(db, userID, groupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group access")
			return
		}

		membershipStatus, err := database.CheckUserGroupMembership(db, userID, groupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group membership")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"has_access":        hasAccess,
			"membership_status": membershipStatus,
		})
	}
}

func RequestGroupJoinHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var request struct {
			GroupID int `json:"group_id"`
		}
		err = json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		err = database.RequestGroupJoin(db, userID, request.GroupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to request group join")
			return
		}

		// Fetch group info to get owner
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", request.GroupID).Scan(&creatorID)
		if err == nil && creatorID != userID {
			actionData := map[string]interface{}{
				"action":       "group_join_response",
				"group_id":     request.GroupID,
				"requester_id": userID,
			}
			err = database.CreateNotification(
				creatorID,       // group owner receives notification
				userID,          // requester is sender
				request.GroupID, // reference to the group
				"group_join_request",
				true, // action required
				actionData,
				"requested to join your group",
			)

			// Send WebSocket notification count update to group owner
			if err == nil {
				// Import the notification handler's function
				sendNotificationCountUpdate(creatorID)
			}
		}

		BroadcastGroupMembershipChange(request.GroupID, userID, "added")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": "Join request submitted",
		})
	}
}

func BatchGroupAccessHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var req struct {
			GroupIDs []int `json:"group_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		result := make(map[int]map[string]interface{})
		for _, groupID := range req.GroupIDs {
			hasAccess, _ := database.CheckUserGroupAccess(db, userID, groupID)
			membershipStatus, _ := database.CheckUserGroupMembership(db, userID, groupID)
			result[groupID] = map[string]interface{}{
				"has_access":        hasAccess,
				"membership_status": membershipStatus,
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

// BroadcastGroupMembershipChange broadcasts when group membership changes
func BroadcastGroupMembershipChange(groupID int, userID int, action string) {
	message := websocket.Message{
		Type: "group_member_" + action,
		Content: map[string]interface{}{
			"group_id": groupID,
			"user_id":  userID,
			"action":   action,
		},
	}
	jsonMessage, err := json.Marshal(message)
	if err == nil {
		websocket.MainHub.Broadcast <- jsonMessage
	}
}

// BroadcastGroupMessage broadcasts when a message is sent in group chat
func BroadcastGroupMessage(groupID int, senderID int, content string) {
	message := websocket.Message{
		Type: "group_message",
		Content: map[string]interface{}{
			"group_id":  groupID,
			"sender_id": senderID,
			"content":   content,
			"timestamp": time.Now().Format(time.RFC3339),
		},
	}
	jsonMessage, err := json.Marshal(message)
	if err == nil {
		websocket.MainHub.Broadcast <- jsonMessage
	}
}

// GetGroupMembersHandler returns all members of a group
func GetGroupMembersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔍 GetGroupMembersHandler: Request received")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("🔍 GetGroupMembersHandler: Failed to get user ID from session: %v", err)
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}
		log.Printf("🔍 GetGroupMembersHandler: User ID = %d", userID)

		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			log.Printf("🔍 GetGroupMembersHandler: Group ID is missing from query")
			utils.WriteJSONError(w, http.StatusBadRequest, "Group ID is required")
			return
		}
		log.Printf("🔍 GetGroupMembersHandler: Group ID string = %s", groupIDStr)

		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			log.Printf("🔍 GetGroupMembersHandler: Invalid group ID: %v", err)
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
			return
		}
		log.Printf("🔍 GetGroupMembersHandler: Group ID = %d", groupID)

		// Check if user has access to the group
		hasAccess, err := database.CheckUserGroupAccess(db, userID, groupID)
		if err != nil {
			log.Printf("🔍 GetGroupMembersHandler: Failed to check group access: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group access")
			return
		}
		log.Printf("🔍 GetGroupMembersHandler: User has access = %v", hasAccess)

		if !hasAccess {
			log.Printf("🔍 GetGroupMembersHandler: User %d doesn't have access to group %d", userID, groupID)
			utils.WriteJSONError(w, http.StatusForbidden, "You don't have access to this group")
			return
		}

		members, err := database.GetGroupMembers(db, groupID)
		if err != nil {
			log.Printf("🔍 GetGroupMembersHandler: Failed to fetch group members: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch group members")
			return
		}
		log.Printf("🔍 GetGroupMembersHandler: Fetched %d members", len(members))

		w.Header().Set("Content-Type", "application/json")
		response := map[string]interface{}{
			"members": members,
		}
		log.Printf("🔍 GetGroupMembersHandler: Sending response: %+v", response)
		json.NewEncoder(w).Encode(response)
	}
}

// RequestGroupInviteHandler handles group invitation requests
func RequestGroupInviteHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var request struct {
			InviteeID int `json:"invitee_id"`
			GroupID   int `json:"group_id"`
		}
		err = json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		err = database.RequestGroupInvite(db, userID, request.InviteeID, request.GroupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		// Get group creator to send WebSocket notification
		creatorID, err := database.GetGroupCreatorID(db, request.GroupID)
		if err == nil {
			sendNotificationCountUpdate(creatorID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": "Invitation request sent to group admin",
		})
	}
}

// HandleGroupInviteActionHandler handles admin approval/decline of group invitations
func HandleGroupInviteActionHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var request struct {
			NotificationID int    `json:"notification_id"`
			Action         string `json:"action"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		// Get notification to verify ownership and get details
		notification, sender, err := database.GetNotificationWithSenderInfo(request.NotificationID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusNotFound, "Notification not found")
			return
		}

		// Verify notification belongs to current user
		if notification.UserID != userID {
			utils.WriteJSONError(w, http.StatusForbidden, "Not authorized to handle this notification")
			return
		}

		// Parse action data
		var actionData map[string]interface{}
		if notification.ActionData != "" {
			if err := json.Unmarshal([]byte(notification.ActionData), &actionData); err != nil {
				utils.WriteJSONError(w, http.StatusBadRequest, "Invalid notification data")
				return
			}
		}

		groupID, ok1 := actionData["group_id"].(float64)
		inviterID, ok2 := actionData["inviter_id"].(float64)
		inviteeID, ok3 := actionData["invitee_id"].(float64)
		if !ok1 || !ok2 || !ok3 {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid notification data")
			return
		}

		// Handle the action
		switch request.Action {
		case "accept":
			err = database.ApproveGroupInvite(db, userID, int(inviterID), int(inviteeID), int(groupID))
		case "decline":
			err = database.DeclineGroupInvite(db, userID, int(inviterID), int(inviteeID), int(groupID))
		default:
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid action")
			return
		}

		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to handle invitation action")
			return
		}

		// Replace notification with approval message
		err = replaceGroupInviteNotificationWithApproval(notification, request.Action, sender, int(inviterID), int(inviteeID))
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Action completed but failed to update notification")
			return
		}

		// Send WebSocket notifications
		sendNotificationCountUpdate(userID)
		if request.Action == "accept" {
			sendNotificationCountUpdate(int(inviteeID))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": "Invitation " + request.Action + "ed",
		})
	}
}

// replaceGroupInviteNotificationWithApproval replaces group invite notification with approval message
func replaceGroupInviteNotificationWithApproval(notification *database.Notification, action string, sender *models.User, inviterID, inviteeID int) error {
	var newMessage string
	var newType string
	var actionRequired bool
	var actionData map[string]interface{}

	// Get inviter and invitee usernames
	inviter, err := database.GetUserByID(inviterID)
	if err != nil {
		return err
	}
	invitee, err := database.GetUserByID(inviteeID)
	if err != nil {
		return err
	}

	if action == "accept" {
		newMessage = fmt.Sprintf("You approved %s's invitation for %s", inviter.Username, invitee.Username)
		newType = "group_invite_approved"
		actionRequired = false
		actionData = nil
	} else {
		newMessage = fmt.Sprintf("You declined %s's invitation for %s", inviter.Username, invitee.Username)
		newType = "group_invite_declined"
		actionRequired = false
		actionData = nil
	}

	// Update the notification
	query := `UPDATE notifications 
			  SET type = ?, message = ?, action_required = ?, action_data = ?, is_read = 0, created_at = CURRENT_TIMESTAMP 
			  WHERE id = ?`

	var actionDataJSON string
	if actionData != nil {
		jsonData, err := json.Marshal(actionData)
		if err != nil {
			return fmt.Errorf("failed to marshal action data: %v", err)
		}
		actionDataJSON = string(jsonData)
	}

	_, err = database.ExecuteQuery(query, newType, newMessage, actionRequired, actionDataJSON, notification.ID)
	if err != nil {
		return fmt.Errorf("failed to update notification: %v", err)
	}

	return nil
}
