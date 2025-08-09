package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/utils"
	"social_network/internal/websocket"
	"strconv"
)

func CreateGroupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/create")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var group database.Group
		err = json.NewDecoder(r.Body).Decode(&group)
		if err != nil {
			log.Printf("❌ Failed to decode request body: %v", err)
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		group.CreatorID = userID

		// Debug: Log the received privacy setting
		log.Printf("🔍 DEBUG: Received privacy_setting: '%s'", group.PrivacySetting)

		// Set default privacy setting if not provided
		if group.PrivacySetting == "" {
			group.PrivacySetting = "public"
			log.Printf("🔍 DEBUG: Privacy setting was empty, defaulting to 'public'")
		}

		log.Printf("📦 Creating group: %+v", group)

		err = database.CreateGroup(db, &group)
		if err != nil {
			log.Printf("❌ Failed to insert group: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create group: %v", err))
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
			}
		}

		// Get creator information
		var creatorUsername string
		err = db.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&creatorUsername)
		if err != nil {
			log.Printf("❌ Failed to get creator username: %v", err)
		}

		// Broadcast new group to all clients
		message := websocket.Message{
			Type: "new_group",
			Content: map[string]interface{}{
				"id":              group.ID,
				"name":            group.Name,
				"description":     group.Description,
				"created_at":      group.CreatedAt,
				"privacy_setting": group.PrivacySetting,
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
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
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

		// Get group creator ID to send notification
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", request.GroupID).Scan(&creatorID)
		if err != nil {
			log.Printf("WARNING: Failed to get group creator for notification: %v", err)
		} else {
			// Create notification for group creator
			err = database.CreateNotification(db, creatorID, "group_join_request", request.GroupID)
			if err != nil {
				log.Printf("WARNING: Failed to create group join request notification: %v", err)
			} else {
				log.Printf("SUCCESS: Created group join request notification for group creator %d", creatorID)
			}
		}

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

func GetGroupPostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			http.Error(w, "Group ID is required", http.StatusBadRequest)
			return
		}

		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			http.Error(w, "Invalid group ID", http.StatusBadRequest)
			return
		}

		posts, err := database.GetGroupPosts(db, groupID)
		if err != nil {
			http.Error(w, "Failed to fetch group posts", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(posts)
	}
}

func GetGroupMembersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/members")

		groupIDStr := r.URL.Query().Get("group_id")
		log.Printf("🔍 Group ID from query: %s", groupIDStr)

		if groupIDStr == "" {
			log.Println("❌ Group ID is missing")
			utils.WriteJSONError(w, http.StatusBadRequest, "Group ID is required")
			return
		}

		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			log.Printf("❌ Invalid group ID: %v", err)
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
			return
		}
		log.Printf("✅ Parsed group ID: %d", groupID)

		// Check if user has access to the group
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("❌ Failed to get user ID from session: %v", err)
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}
		log.Printf("✅ User ID from session: %d", userID)

		hasAccess, err := database.CheckUserGroupAccess(db, userID, groupID)
		if err != nil {
			log.Printf("❌ Failed to check group access: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group access")
			return
		}
		log.Printf("✅ Group access check result: %t", hasAccess)

		if !hasAccess {
			log.Println("❌ Access denied to group")
			utils.WriteJSONError(w, http.StatusForbidden, "Access denied to group")
			return
		}

		// Get group members
		log.Println("🔍 Fetching group members...")
		members, err := database.GetGroupMembers(db, groupID)
		if err != nil {
			log.Printf("❌ Failed to fetch group members: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch group members")
			return
		}
		log.Printf("✅ Retrieved %d group members", len(members))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(members)
		log.Println("✅ Successfully sent group members response")
	}
}

// Get pending join requests for a group (owner only)
func GetGroupJoinRequestsHandler(db *sql.DB) http.HandlerFunc {
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
		// Check if user is group owner
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusNotFound, "Group not found")
			return
		}
		if creatorID != userID {
			utils.WriteJSONError(w, http.StatusForbidden, "Only group owner can view join requests")
			return
		}
		requests, err := database.GetPendingGroupJoinRequests(db, groupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch join requests")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(requests)
	}
}

// Accept or decline a join request (owner only)
func HandleGroupJoinRequestHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/handle-join-request")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var request struct {
			GroupID int    `json:"group_id"`
			UserID  int    `json:"user_id"`
			Action  string `json:"action"`
		}

		err = json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		// Check if user is group owner
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", request.GroupID).Scan(&creatorID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusNotFound, "Group not found")
			return
		}
		if creatorID != userID {
			utils.WriteJSONError(w, http.StatusForbidden, "Only group owner can handle join requests")
			return
		}

		// Handle the join request
		err = database.HandleGroupJoinRequest(db, request.GroupID, request.UserID, request.Action)
		if err != nil {
			log.Printf("❌ Failed to handle join request: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to handle join request: %v", err))
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
		})
	}
}

// SendGroupInvitationHandler sends a group invitation to a user
func SendGroupInvitationHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invite")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var req struct {
			GroupID  int    `json:"group_id"`
			Username string `json:"username"`
		}
		err = json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		// Check if user has permission to invite (must be group owner or member)
		hasAccess, err := database.CheckUserGroupAccess(db, userID, req.GroupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group access")
			return
		}
		if !hasAccess {
			utils.WriteJSONError(w, http.StatusForbidden, "You don't have permission to invite users to this group")
			return
		}

		// Get invitee user ID by username
		var inviteeID int
		err = db.QueryRow("SELECT id FROM users WHERE username = ?", req.Username).Scan(&inviteeID)
		if err != nil {
			if err == sql.ErrNoRows {
				utils.WriteJSONError(w, http.StatusNotFound, "User not found")
			} else {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to find user")
			}
			return
		}

		// Check if user is already a member
		membershipStatus, err := database.CheckUserGroupMembership(db, inviteeID, req.GroupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check membership")
			return
		}
		if membershipStatus == "accepted" {
			utils.WriteJSONError(w, http.StatusBadRequest, "User is already a member of this group")
			return
		}

		// Check if group is private
		isPrivate, err := database.CheckIfGroupIsPrivate(db, req.GroupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check group privacy")
			return
		}

		// Check if user is group owner
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", req.GroupID).Scan(&creatorID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to get group creator")
			return
		}
		isOwner := creatorID == userID

		if isPrivate && !isOwner {
			// For private groups, non-owners need to create invitation requests

			// Check if invitation request already exists
			alreadyRequested, err := database.CheckIfInvitationRequestExists(db, req.GroupID, inviteeID)
			if err != nil {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check existing invitation requests")
				return
			}
			if alreadyRequested {
				utils.WriteJSONError(w, http.StatusBadRequest, "Invitation request already exists for this user")
				return
			}

			// Create invitation request
			err = database.CreateGroupInvitationRequest(db, req.GroupID, userID, inviteeID)
			if err != nil {
				log.Printf("❌ Failed to create group invitation request: %v", err)
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create invitation request")
				return
			}

			// Create notification for group owner
			err = database.CreateNotification(db, creatorID, "group_invitation_request", req.GroupID)
			if err != nil {
				log.Printf("⚠️ Failed to create invitation request notification: %v", err)
			} else {
				log.Printf("✅ Created invitation request notification for group owner %d", creatorID)
			}

			log.Printf("✅ Group invitation request created: groupID=%d, inviterID=%d, inviteeID=%d", req.GroupID, userID, inviteeID)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"status":  "success",
				"message": "Invitation request sent to group owner for approval",
			})
		} else {
			// For public groups or group owners, create invitation directly

			// Check if invitation already exists
			alreadyInvited, err := database.CheckIfUserInvited(db, req.GroupID, inviteeID)
			if err != nil {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to check existing invitations")
				return
			}
			if alreadyInvited {
				utils.WriteJSONError(w, http.StatusBadRequest, "User has already been invited to this group")
				return
			}

			// Create the invitation
			err = database.CreateGroupInvitation(db, req.GroupID, userID, inviteeID)
			if err != nil {
				log.Printf("❌ Failed to create group invitation: %v", err)
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create invitation")
				return
			}

			// Create notification for invitee
			err = database.CreateNotification(db, inviteeID, "group_invitation", req.GroupID)
			if err != nil {
				log.Printf("⚠️ Failed to create invitation notification: %v", err)
			} else {
				log.Printf("✅ Created group invitation notification for user %d", inviteeID)
			}

			log.Printf("✅ Group invitation sent successfully: groupID=%d, inviterID=%d, inviteeID=%d", req.GroupID, userID, inviteeID)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"status":  "success",
				"message": "Invitation sent successfully",
			})
		}
	}
}

// GetUserGroupInvitationsHandler gets all pending group invitations for the current user
func GetUserGroupInvitationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invitations")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		invitations, err := database.GetUserGroupInvitations(db, userID)
		if err != nil {
			log.Printf("❌ Failed to get user group invitations: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to get invitations")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(invitations)
	}
}

// GetGroupInvitationRequestsHandler gets pending invitation requests for a group (owner only)
func GetGroupInvitationRequestsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invitation-requests")

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

		// Check if user is group owner
		var creatorID int
		err = db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusNotFound, "Group not found")
			return
		}
		if creatorID != userID {
			utils.WriteJSONError(w, http.StatusForbidden, "Only group owner can view invitation requests")
			return
		}

		log.Printf("🔍 DEBUG: About to fetch pending invitation requests for groupID=%d", groupID)

		requests, err := database.GetPendingInvitationRequests(db, groupID)
		if err != nil {
			log.Printf("❌ Failed to fetch invitation requests: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch invitation requests")
			return
		}

		log.Printf("✅ Retrieved %d pending invitation requests for group %d", len(requests), groupID)
		log.Printf("🔍 DEBUG: Invitation requests details: %+v", requests)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(requests)
	}
}

// HandleGroupInvitationRequestHandler approves or rejects invitation requests (owner only)
func HandleGroupInvitationRequestHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invitation-requests/handle")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var req struct {
			RequestID int    `json:"request_id"`
			Action    string `json:"action"` // "approve" or "reject"
		}
		err = json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		if req.Action != "approve" && req.Action != "reject" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid action. Must be 'approve' or 'reject'")
			return
		}

		err = database.HandleInvitationRequest(db, req.RequestID, userID, req.Action)
		if err != nil {
			log.Printf("❌ Failed to handle invitation request: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		log.Printf("✅ Invitation request %s successfully: requestID=%d, userID=%d", req.Action, req.RequestID, userID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": fmt.Sprintf("Invitation request %s successfully", req.Action),
		})
	}
}

// HandleGroupInvitationHandler accepts or declines a group invitation
func HandleGroupInvitationHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invitations/handle")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		var req struct {
			InvitationID int    `json:"invitation_id"`
			Action       string `json:"action"` // "accept" or "decline"
		}
		err = json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		if req.Action != "accept" && req.Action != "decline" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid action. Must be 'accept' or 'decline'")
			return
		}

		groupID, err := database.HandleGroupInvitation(db, req.InvitationID, userID, req.Action)
		if err != nil {
			log.Printf("❌ Failed to handle group invitation: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		log.Printf("🔍 DEBUG: About to delete notification for userID=%d, groupID=%d", userID, groupID)

		// Delete the notification since it's no longer relevant
		err = database.MarkGroupInvitationNotificationAsRead(db, userID, groupID)
		if err != nil {
			log.Printf("⚠️ Failed to delete notification: %v", err)
			// Don't return error here as the main operation succeeded
		} else {
			log.Printf("✅ Successfully deleted group invitation notification for userID=%d, groupID=%d", userID, groupID)
		}

		log.Printf("✅ Group invitation %s successfully: invitationID=%d, userID=%d", req.Action, req.InvitationID, userID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": fmt.Sprintf("Invitation %s successfully", req.Action),
		})
	}
}

// GetGroupInvitationsHandler returns pending group invitations for the current user
func GetGroupInvitationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/invitations")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		invitations, err := database.GetPendingGroupInvitations(db, userID)
		if err != nil {
			log.Printf("❌ Failed to fetch group invitations: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch invitations")
			return
		}

		log.Printf("✅ Retrieved %d pending group invitations for user %d", len(invitations), userID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(invitations)
	}
}
