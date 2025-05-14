package main

import (
	"net/http"
	"social_network/internal/handlers"
)

func main() {
	// User routes
	http.HandleFunc("/api/user", handlers.GetUser)
	http.HandleFunc("/api/user/update", handlers.UpdateUser)
	http.HandleFunc("/api/user/delete", handlers.DeleteUser)
	http.HandleFunc("/api/online-users", handlers.GetOnlineUsers)
	http.HandleFunc("/api/users", handlers.GetAllUsers)
	http.HandleFunc("/api/user/profile", handlers.GetUserProfile)
	http.HandleFunc("/api/user/posts", handlers.GetUserPosts)
	http.HandleFunc("/api/user/followers", handlers.GetUserFollowers)
	http.HandleFunc("/api/user/following", handlers.GetUserFollowing)
	http.HandleFunc("/api/user/follow", handlers.FollowUser)
	http.HandleFunc("/api/user/unfollow", handlers.UnfollowUser)
	http.HandleFunc("/api/user/privacy", handlers.UpdatePrivacySettings)

	// ... existing code ...
}
