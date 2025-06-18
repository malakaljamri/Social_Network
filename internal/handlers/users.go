package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"onlineUsers": onlineUsers,
	})
}

// New profile-related handlers

// GetUserProfile returns user profile with follower and following counts
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
	// Get target user ID from URL query
	targetUserIDStr := r.URL.Query().Get("id")
	targetUserID, err := strconv.Atoi(targetUserIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get current logged-in user ID
	currentUserID, _ := database.GetUserIDFromSession(r)

	// Get user profile with follow counts
	profile, err := database.GetUserWithFollowCounts(targetUserID)
	if err != nil {
		http.Error(w, "Error fetching user profile", http.StatusInternalServerError)
		return
	}

	// If user is logged in, check if they follow the profile user
	if currentUserID > 0 && currentUserID != targetUserID {
		isFollowing, err := database.IsFollowing(currentUserID, targetUserID)
		if err == nil {
			profile.IsFollowing = isFollowing
		}
		// Check if there is a pending follow request
		isPending, err := database.IsPendingFollowRequest(currentUserID, targetUserID)
		if err == nil {
			profile.IsPending = isPending
		}
	}

	w.Header().Set("Content-Type", "application/json")
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
	// Get current logged-in user ID from session
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Fetch followers
	followers, err := database.GetFollowers(userID)
	if err != nil {
		// log.Printf("Error fetching followers for user %d: %v", userID, err)
		http.Error(w, "Error fetching followers", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if there are no followers
	if followers == nil {
		followers = []models.User{}
	}

	// log.Printf("Returning %d followers for user %d", len(followers), userID)
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

	// log.Printf("Returning %d following for user %d", len(following), userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(following)
}

// FollowUser handles follow requests
func FollowUser(w http.ResponseWriter, r *http.Request) {
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

	// Prevent self-follow
	if currentUserID == followReq.UserID {
		http.Error(w, "Cannot follow yourself", http.StatusBadRequest)
		return
	}

	// Follow user
	if err := database.FollowUser(currentUserID, followReq.UserID); err != nil {
		http.Error(w, "Error following user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User followed successfully"})
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

	// Generate unique filename
	filename := fmt.Sprintf("profile_%d_%s", currentUserID, handler.Filename)
	filepath := filepath.Join("web/uploads", filename)

	// Create destination file
	dst, err := os.Create(filepath)
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

	// Update user's avatar in database
	err = database.UpdateUserAvatar(currentUserID, filename)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error updating profile image")
		return
	}

	utils.WriteJSONResponse(w, http.StatusOK, map[string]string{
		"message": "Profile image updated successfully",
		"image":   filename,
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
