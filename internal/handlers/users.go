package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"
	"strconv"
)

func GetUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	user, err := database.GetUserByID(userID)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	// Remove sensitive information before sending
	user.Password = ""
	json.NewEncoder(w).Encode(user)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err = database.UpdateUser(user)
	if err != nil {
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User updated successfully"})
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	err = database.DeleteUser(userID)
	if err != nil {
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User deleted successfully"})
}

func GetOnlineUsers(w http.ResponseWriter, r *http.Request) {
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Error: Unauthorized",
			"error":   err.Error(),
		})
		return
	}
	onlineUserIDs := websocket.GetOnlineUsers()
	onlineUserIDs = slices.DeleteFunc(onlineUserIDs, func(id int) bool {
		return id == currentUserID
	})
	onlineUsers, err := database.GetOnlineUsersDetails(onlineUserIDs, currentUserID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, "Error fetching online users", http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Error fetching online users",
			"error":   err.Error(),
		})
		return
	}

	for i := range onlineUsers {
		onlineUsers[i].Password = ""
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"onlineUsers": onlineUsers,
	})
}

// New profile-related handlers

// GetUserProfile returns user profile with follower and following counts
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get target user ID from URL query
	targetUserIDStr := r.URL.Query().Get("id")
	filtersJSON := r.URL.Query().Get("filters")

	var targetUserID int
	var err error

	if targetUserIDStr == "" {
		// If no id provided, use current session user
		targetUserID, err = database.GetUserIDFromSession(r)
		if err != nil || targetUserID <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "No user ID provided and not logged in",
			})
			return
		}
	} else {
		targetUserID, err = strconv.Atoi(targetUserIDStr)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid user ID",
			})
			return
		}
	}

	// Get current logged-in user ID
	currentUserID, _ := database.GetUserIDFromSession(r)

	// Get user profile with follow counts
	profile, err := database.GetUserWithFollowCounts(targetUserID)
	if err != nil {
		log.Printf("Error fetching user profile for ID %d: %v", targetUserID, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Error fetching user profile",
		})
		return
	}

	// Initialize posts slice to prevent nil pointer issues
	profile.Posts = []models.Post{}

	if filtersJSON != "" {
		var filters map[string]interface{}
		if err := json.Unmarshal([]byte(filtersJSON), &filters); err == nil {
			// Use page 1 and a high limit to get all filtered posts for the profile view
			posts, _, err := database.GetFilteredPosts(1, 1000, filters, r)
			if err == nil {
				profile.Posts = posts
			} else {
				log.Printf("Error fetching filtered posts: %v", err)
			}
		}
	} else {
		// Fetch all posts by the user if no filters are applied
		posts, err := database.GetPostsByUserID(targetUserID)
		if err == nil {
			profile.Posts = posts
		} else {
			log.Printf("Error fetching user posts: %v", err)
		}
	}

	// If user is logged in, check if they follow the profile user
	if currentUserID > 0 && currentUserID != targetUserID {
		log.Printf("Checking follow status for currentUserID=%d, targetUserID=%d", currentUserID, targetUserID)

		isFollowing, err := database.IsFollowing(currentUserID, targetUserID)
		profile.IsFollowing = false // Always set the field, default to false
		if err == nil {
			profile.IsFollowing = isFollowing
			log.Printf("IsFollowing set to: %v", isFollowing)
		} else {
			log.Printf("ERROR: Failed to check IsFollowing: %v", err)
		}

		// Check if profile user follows current user
		isFollower, err := database.IsFollowing(targetUserID, currentUserID)
		profile.IsFollower = false // Always set the field, default to false
		if err == nil {
			profile.IsFollower = isFollower
			log.Printf("IsFollower set to: %v", isFollower)
		} else {
			log.Printf("ERROR: Failed to check IsFollower: %v", err)
		}

		// Check if there is a pending follow request
		isPending, err := database.IsPendingFollowRequest(currentUserID, targetUserID)
		if err == nil {
			profile.IsPending = isPending
			log.Printf("IsPending set to: %v", isPending)
		} else {
			log.Printf("ERROR: Failed to check IsPending: %v", err)
		}
	} else {
		log.Printf("Skipping follow status check - currentUserID=%d, targetUserID=%d", currentUserID, targetUserID)
	}

	// Remove sensitive information before sending
	profile.User.Password = ""

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(profile)
}

// GetUserPosts returns posts by a specific user
func GetUserPosts(w http.ResponseWriter, r *http.Request) {

	// Parse pagination parameters with defaults
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	page := 1
	limit := 10
	if pageVal, err := strconv.Atoi(pageStr); err == nil && pageVal > 0 {
		page = pageVal
	}
	if limitVal, err := strconv.Atoi(limitStr); err == nil && limitVal > 0 && limitVal <= 50 {
		limit = limitVal
	}

	// Get target user ID from URL query
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get current logged-in user ID
	currentUserID, _ := database.GetUserIDFromSession(r)

	// Get the target user's profile
	targetUser, err := database.GetUserByID(userID)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	// Check privacy settings
	canViewPosts := true
	if targetUser.IsPrivate && currentUserID != userID {
		// If profile is private, only followers can see posts
		isFollowing, err := database.IsFollowing(currentUserID, userID)
		if err != nil || !isFollowing {
			canViewPosts = false
		}
	}

	// If can't view posts due to privacy, return empty array
	if !canViewPosts {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]models.Post{})
		return
	}

	// Fetch posts by the user
	posts, err := database.GetPostsByUser(userID, page, limit)
	if err != nil {
		// log.Printf("Error fetching posts for user %d: %v", userID, err)
		http.Error(w, "Error fetching user posts", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if there are no posts
	if posts == nil {
		posts = []models.Post{}
	}

	// log.Printf("Returning %d posts for user %d", len(posts), userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// GetUserFollowers returns users following the specified user
func GetUserFollowers(w http.ResponseWriter, r *http.Request) {
	var userID int
	var err error

	// Get target user ID from URL query if it exists
	targetUserIDStr := r.URL.Query().Get("id")

	if targetUserIDStr != "" {
		// If an ID is provided in the URL, use it
		userID, err = strconv.Atoi(targetUserIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid user ID")
			return
		}
	} else {
		// Otherwise, default to the logged-in user's ID from the session
		userID, err = database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Error: Unauthorized")
			return
		}
	}

	// Fetch followers for the determined user ID
	followers, err := database.GetFollowers(userID)
	if err != nil {
		http.Error(w, "Error fetching followers", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if there are no followers
	if followers == nil {
		followers = []models.User{}
	}

	for i := range followers {
		followers[i].Password = ""
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(followers)
}

// GetUserFollowing returns users the specified user follows
func GetUserFollowing(w http.ResponseWriter, r *http.Request) {
	// Get target user ID from URL query
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Fetch following
	following, err := database.GetFollowing(userID)
	if err != nil {
		// log.Printf("Error fetching following for user %d: %v", userID, err)
		http.Error(w, "Error fetching following", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if the user is not following anyone
	if following == nil {
		following = []models.User{}
	}

	for i := range following {
		following[i].Password = ""
	}
	// log.Printf("Returning %d following for user %d", len(following), userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(following)
}

// FollowUser handles follow requests
func FollowUser(w http.ResponseWriter, r *http.Request) {
	log.Printf("=== FollowUser handler started ===")

	// Must be logged in
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		log.Printf("ERROR: Failed to get current user ID from session: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Printf("Current user ID: %d", currentUserID)

	// Parse request
	var followReq models.FollowRequest
	if err := json.NewDecoder(r.Body).Decode(&followReq); err != nil {
		log.Printf("ERROR: Failed to decode follow request: %v", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	log.Printf("Follow request - Target user ID: %d", followReq.UserID)

	// Prevent self-follow
	if currentUserID == followReq.UserID {
		log.Printf("ERROR: User %d attempted to follow themselves", currentUserID)
		http.Error(w, "Cannot follow yourself", http.StatusBadRequest)
		return
	}

	// Get target user to check privacy settings
	targetUser, err := database.GetUserByID(followReq.UserID)
	if err != nil {
		log.Printf("ERROR: Failed to get target user %d: %v", followReq.UserID, err)
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}
	log.Printf("Target user privacy setting: IsPrivate=%v", targetUser.IsPrivate)

	// Check current follow status before following
	isFollowingBefore, err := database.IsFollowing(currentUserID, followReq.UserID)
	if err != nil {
		log.Printf("WARNING: Failed to check if following before: %v", err)
	} else {
		log.Printf("Follow status before: IsFollowing=%v", isFollowingBefore)
	}

	isPendingBefore, err := database.IsPendingFollowRequest(currentUserID, followReq.UserID)
	if err != nil {
		log.Printf("WARNING: Failed to check if pending before: %v", err)
	} else {
		log.Printf("Pending status before: IsPending=%v", isPendingBefore)
	}

	// Follow user
	log.Printf("Calling database.FollowUser(%d, %d)", currentUserID, followReq.UserID)
	if err := database.FollowUser(currentUserID, followReq.UserID); err != nil {
		log.Printf("ERROR: Failed to follow user in database: %v", err)
		http.Error(w, "Error following user", http.StatusInternalServerError)
		return
	}
	log.Printf("SUCCESS: Database follow operation completed")

	// Create notifications based on privacy settings
	if targetUser.IsPrivate {
		// Send follow request notification to target user
		actionData := map[string]interface{}{
			"action":      "follow_response",
			"follower_id": currentUserID,
			"followed_id": followReq.UserID,
		}
		err = database.CreateNotification(
			followReq.UserID, // target user receives notification
			currentUserID,    // current user is sender
			0,                // no reference ID for follow requests
			"follow_request",
			true, // action required
			actionData,
			"wants to follow you",
		)
		if err != nil {
			log.Printf("WARNING: Failed to create follow request notification: %v", err)
		} else {
			// Send WebSocket notification
			go sendNewNotificationWebSocket(followReq.UserID, currentUserID, "follow_request", "wants to follow you")
		}
	} else {
		// Public profile - send notifications to both users
		// Notification to target user
		err = database.CreateNotification(
			followReq.UserID, // target user receives notification
			currentUserID,    // current user is sender
			0,                // no reference ID
			"follow_established",
			false, // no action required
			nil,
			"is now following you",
		)
		if err != nil {
			log.Printf("WARNING: Failed to create follow notification for target: %v", err)
		}

		// Notification to current user
		err = database.CreateNotification(
			currentUserID, // current user receives notification
			currentUserID, // current user is sender (self-notification)
			0,             // no reference ID
			"follow_established",
			false, // no action required
			nil,
			"you are now following",
		)
		if err != nil {
			log.Printf("WARNING: Failed to create follow notification for self: %v", err)
		}
	}

	// Check follow status after following
	isFollowingAfter, err := database.IsFollowing(currentUserID, followReq.UserID)
	if err != nil {
		log.Printf("WARNING: Failed to check if following after: %v", err)
	} else {
		log.Printf("Follow status after: IsFollowing=%v", isFollowingAfter)
	}

	isPendingAfter, err := database.IsPendingFollowRequest(currentUserID, followReq.UserID)
	if err != nil {
		log.Printf("WARNING: Failed to check if pending after: %v", err)
	} else {
		log.Printf("Pending status after: IsPending=%v", isPendingAfter)
	}

	// Provide appropriate response based on privacy settings
	var message string
	if targetUser.IsPrivate {
		message = "Follow request sent successfully"
		log.Printf("Response: Private profile - follow request sent")
	} else {
		message = "User followed successfully"
		log.Printf("Response: Public profile - user followed")
	}

	log.Printf("=== FollowUser handler completed - Message: %s ===", message)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// UnfollowUser handles unfollow requests
func UnfollowUser(w http.ResponseWriter, r *http.Request) {
	// Must be logged in
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request
	var followReq models.FollowRequest
	if err := json.NewDecoder(r.Body).Decode(&followReq); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// Unfollow user
	if err := database.UnfollowUser(currentUserID, followReq.UserID); err != nil {
		http.Error(w, "Error unfollowing user", http.StatusInternalServerError)
		return
	}

	// Broadcast follow-status-update to both users
	msg := websocket.Message{
		Type:    "follow-status-update",
		Content: map[string]interface{}{"follower_id": currentUserID, "followed_id": followReq.UserID},
	}
	if jsonMsg, err := json.Marshal(msg); err == nil {
		websocket.MainHub.Broadcast <- jsonMsg
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User unfollowed successfully"})
}

// UpdatePrivacySettings handles requests to update a user's privacy settings
func UpdatePrivacySettings(w http.ResponseWriter, r *http.Request) {
	// Must be logged in
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var request struct {
		IsPrivate bool `json:"is_private"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get current user
	user, err := database.GetUserByID(userID)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	// Update privacy setting
	user.IsPrivate = request.IsPrivate
	if err := database.UpdateUser(user); err != nil {
		http.Error(w, "Error updating privacy settings", http.StatusInternalServerError)
		return
	}

	// Return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":    "Privacy settings updated successfully",
		"is_private": request.IsPrivate,
	})
}

// Helper function for pagination
func getPaginationParams(r *http.Request) (page, limit int) {
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page = 1
	if pageVal, err := strconv.Atoi(pageStr); err == nil && pageVal > 0 {
		page = pageVal
	}

	limit = 10
	if limitVal, err := strconv.Atoi(limitStr); err == nil && limitVal > 0 && limitVal <= 50 {
		limit = limitVal
	}

	return page, limit
}

// GetCurrentUser returns the currently logged-in user or {isLoggedIn: false}
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"isLoggedIn": false,
		})
		return
	}
	user, err := database.GetUserByID(userID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"isLoggedIn": false,
		})
		return
	}
	user.Password = ""
	json.NewEncoder(w).Encode(map[string]interface{}{
		"isLoggedIn": true,
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
	})
}

func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Error: Unauthorized")
		return
	}

	users, err := database.GetAllUsers(currentUserID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching users")
		return
	}

	for i := range users {
		users[i].Password = ""
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// UpdateProfileImage handles profile image upload and update
func UpdateProfileImage(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from session
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse multipart form with 10MB max memory
	err = r.ParseMultipartForm(10 << 20)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Error parsing form")
		return
	}

	// Get file from form
	file, handler, err := r.FormFile("image")
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Error retrieving file")
		return
	}
	defer file.Close()

	// Validate file type
	if !utils.IsValidImageType(handler.Header.Get("Content-Type")) {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid file type. Only JPEG, PNG and GIF are allowed")
		return
	}

	// --- Path construction ---
	// Get the path of the currently running file to determine the project root
	_, b, _, _ := runtime.Caller(0)
	basepath := filepath.Dir(b)
	// Navigate up to the project root from 'internal/handlers'
	projectRoot := filepath.Join(basepath, "..", "..")

	// Define the relative path for database storage (using forward slashes for web)
	relativePathForDB := fmt.Sprintf("userID%d/avatar/%s", currentUserID, handler.Filename)

	// Create the absolute path for file system operations
	absoluteSaveDir := filepath.Join(projectRoot, "web", "uploads", fmt.Sprintf("userID%d", currentUserID), "avatar")

	// Create directories if they don't exist
	if err := os.MkdirAll(absoluteSaveDir, 0755); err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error creating directory")
		return
	}

	// Generate the full absolute path for the file
	fullPath := filepath.Join(absoluteSaveDir, handler.Filename)

	// Create destination file
	dst, err := os.Create(fullPath)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error creating file")
		return
	}
	defer dst.Close()

	// Copy file contents
	if _, err := io.Copy(dst, file); err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error saving file")
		return
	}

	// Update user's avatar in database with the web-friendly relative path
	err = database.UpdateUserAvatar(currentUserID, relativePathForDB)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error updating profile image")
		return
	}

	utils.WriteJSONResponse(w, http.StatusOK, map[string]string{
		"message": "Profile image updated successfully",
		"image":   relativePathForDB,
	})
}

// UpdateProfileInfo handles updating user profile information
func UpdateProfileInfo(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from session
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse request body
	var profileData struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Nickname  string `json:"nickname"`
		AboutMe   string `json:"about_me"`
		Gender    string `json:"gender"`
		BirthDate string `json:"birth_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&profileData); err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update user profile in database
	err = database.UpdateUserProfile(currentUserID, profileData)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error updating profile")
		return
	}

	utils.WriteJSONResponse(w, http.StatusOK, map[string]string{
		"message": "Profile updated successfully",
	})
}

// ToggleProfilePrivacy handles toggling profile privacy between public and private
func ToggleProfilePrivacy(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from session
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse request body
	var privacyData struct {
		IsPrivate bool `json:"is_private"`
	}

	if err := json.NewDecoder(r.Body).Decode(&privacyData); err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update privacy setting in database
	err = database.UpdateUserPrivacy(currentUserID, privacyData.IsPrivate)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error updating privacy settings")
		return
	}

	// Broadcast privacy change via WebSocket
	privacyMsg := websocket.Message{
		Type: "profile_privacy_update",
		Content: map[string]interface{}{
			"user_id":    currentUserID,
			"is_private": privacyData.IsPrivate,
		},
	}
	if jsonMsg, err := json.Marshal(privacyMsg); err == nil {
		websocket.MainHub.Broadcast <- jsonMsg
	}

	utils.WriteJSONResponse(w, http.StatusOK, map[string]string{
		"message": "Privacy settings updated successfully",
	})
}

// HandleFollowRequest handles accepting or declining follow requests
func HandleFollowRequest(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from session
	currentUserID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get follower ID from URL
	followerIDStr := r.URL.Query().Get("follower_id")
	followerID, err := strconv.Atoi(followerIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid follower ID")
		return
	}

	// Parse request body
	var requestData struct {
		Action string `json:"action"` // "accept" or "decline"
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Handle the follow request
	switch requestData.Action {
	case "accept":
		err = database.AcceptFollowRequest(followerID, currentUserID)
		if err == nil {
			// Send notifications to both users when follow request is accepted
			// Notification to follower (who requested)
			err = database.CreateNotification(
				followerID,    // follower receives notification
				currentUserID, // current user is sender
				0,             // no reference ID
				"follow_established",
				false, // no action required
				nil,
				"accepted your follow request",
			)
			if err != nil {
				log.Printf("WARNING: Failed to create follow acceptance notification for follower: %v", err)
			}

			// Notification to current user (who accepted)
			err = database.CreateNotification(
				currentUserID, // current user receives notification
				followerID,    // follower is sender
				0,             // no reference ID
				"follow_established",
				false, // no action required
				nil,
				"you are now following each other",
			)
			if err != nil {
				log.Printf("WARNING: Failed to create follow acceptance notification for current user: %v", err)
			}
		}
	case "decline":
		err = database.DeclineFollowRequest(followerID, currentUserID)
	default:
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid action")
		return
	}

	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error handling follow request")
		return
	}

	utils.WriteJSONResponse(w, http.StatusOK, map[string]string{
		"message": "Follow request handled successfully",
	})
}

// GetPendingFollowRequestsHandler returns all pending follow requests for the current user
func GetPendingFollowRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
		return
	}
	requests, err := database.GetPendingFollowRequests(userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch follow requests"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// ChangePasswordHandler allows a logged-in user to change their password
func ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.WriteJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := database.GetUserIDFromSession(r)
	if err != nil || userID <= 0 {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Unauthorized: not logged in")
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
		ConfirmPassword string `json:"confirm_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.NewPassword != req.ConfirmPassword {
		utils.WriteJSONError(w, http.StatusBadRequest, "New password and confirmation do not match")
		return
	}
	if len(req.NewPassword) < 6 {
		utils.WriteJSONError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	user, err := database.GetUserByID(userID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "User not found")
		return
	}

	err = utils.ComparePassword(user.Password, req.CurrentPassword)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}

	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error hashing new password")
		return
	}

	err = database.UpdateUserPassword(userID, hashedPassword)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"})
}
