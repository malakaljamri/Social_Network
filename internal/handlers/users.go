package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"slices"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/websocket"
	"strconv"
)

func GetUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
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
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
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
		// http.Error(w, "Unauthorized", http.StatusUnauthorized)
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
		http.Error(w, "Error fetching online users", http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Error fetching online users",
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(onlineUsers)
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
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

// GetUserPosts returns posts by a specific user
func GetUserPosts(w http.ResponseWriter, r *http.Request) {
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

	// Get pagination parameters
	page, limit := getPaginationParams(r)

	// If can't view posts due to privacy, return empty array
	if !canViewPosts {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]models.Post{})
		return
	}

	// Fetch posts by the user
	posts, err := database.GetPostsByUser(userID, page, limit)
	if err != nil {
		log.Printf("Error fetching posts for user %d: %v", userID, err)
		http.Error(w, "Error fetching user posts", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if there are no posts
	if posts == nil {
		posts = []models.Post{}
	}

	log.Printf("Returning %d posts for user %d", len(posts), userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// GetUserFollowers returns users following the specified user
func GetUserFollowers(w http.ResponseWriter, r *http.Request) {
	// Get target user ID from URL query
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Fetch followers
	followers, err := database.GetFollowers(userID)
	if err != nil {
		log.Printf("Error fetching followers for user %d: %v", userID, err)
		http.Error(w, "Error fetching followers", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if there are no followers
	if followers == nil {
		followers = []models.User{}
	}

	log.Printf("Returning %d followers for user %d", len(followers), userID)
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
		log.Printf("Error fetching following for user %d: %v", userID, err)
		http.Error(w, "Error fetching following", http.StatusInternalServerError)
		return
	}

	// Ensure we always return an array, even if the user is not following anyone
	if following == nil {
		following = []models.User{}
	}

	log.Printf("Returning %d following for user %d", len(following), userID)
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
		"message": "Privacy settings updated successfully",
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
