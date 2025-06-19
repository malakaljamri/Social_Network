package main

import (
	"html/template"
	"log"
	"net/http"
	"path/filepath"
	"runtime"
	"social_network/internal/auth"
	"social_network/internal/database"
	"social_network/internal/handlers"
	"social_network/internal/websocket"
)

func main() {
	// Initialize the database
	db, err := database.InitializeDB()
	if err != nil {
		log.Fatal("Error initializing database:", err)
	}
	defer db.Close()

	go websocket.MainHub.Run()

	// go websocket.BroadcastTime(hub) // This function is only for testing purposes

	// handlers with hub
	authHandlers := auth.NewAuthHandlers(websocket.MainHub)
	chatHandlers := handlers.NewChatHandlers(websocket.MainHub)

	// Create a new ServeMux
	mux := http.NewServeMux()
	// Get the directory of the current file
	_, currentFile, _, _ := runtime.Caller(0)
	dir := filepath.Dir(currentFile)

	// --- API routes registered FIRST ---
	mux.HandleFunc("/api/logout", authHandlers.LogoutHandler)
	mux.HandleFunc("/api/login", authHandlers.LoginHandler)
	mux.HandleFunc("/api/user_status", authHandlers.UserStatusHandler)
	mux.HandleFunc("/api/register", authHandlers.RegisterHandler)
	mux.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handlers.CreatePost(w, r)
		} else if r.Method == http.MethodGet {
			handlers.GetPostsHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/oldest-post-date", handlers.GetOldestPostDate)
	mux.HandleFunc("/api/newest-post-date", handlers.GetNewestPostDate)

	// User profile and follow routes
	mux.HandleFunc("/api/user/profile", handlers.GetUserProfile)
	mux.HandleFunc("/api/user/posts", handlers.GetUserPosts)
	mux.HandleFunc("/api/user/followers", handlers.GetUserFollowers)
	mux.HandleFunc("/api/user/following", handlers.GetUserFollowing)
	mux.HandleFunc("/api/user/follow", handlers.FollowUser)
	mux.HandleFunc("/api/user/unfollow", handlers.UnfollowUser)
	mux.HandleFunc("/api/user/privacy", handlers.UpdatePrivacySettings)

	// New profile-related endpoints
	mux.HandleFunc("/api/profile/image", handlers.UpdateProfileImage)
	mux.HandleFunc("/api/profile/info", handlers.UpdateProfileInfo)
	mux.HandleFunc("/api/profile/privacy", handlers.ToggleProfilePrivacy)
	mux.HandleFunc("/api/profile/follow-request", handlers.HandleFollowRequest)
	mux.HandleFunc("/api/profile/follow-requests", handlers.GetPendingFollowRequestsHandler)

	// Other API routes
	mux.HandleFunc("/api/categories", handlers.GetCategories)
	mux.HandleFunc("/category/create", handlers.CreateCategory)
	mux.HandleFunc("/category/delete", handlers.DeleteCategory)
	mux.HandleFunc("/posts", handlers.GetPosts)
	mux.HandleFunc("/post", handlers.PostHandler)
	mux.HandleFunc("/post/create", handlers.CreatePost)
	mux.HandleFunc("/post/delete", handlers.DeletePost)
	mux.HandleFunc("/api/comments", handlers.GetComments)
	mux.HandleFunc("/api/comment/create", handlers.CreateComment)
	mux.HandleFunc("/api/comment/delete", handlers.DeleteComment)
	mux.HandleFunc("/post/like", handlers.LikePost)
	mux.HandleFunc("/post/dislike", handlers.DislikePost)
	mux.HandleFunc("/api/groups/create", handlers.CreateGroupHandler(db))
	mux.HandleFunc("/api/groups", handlers.GetAllGroupsHandler(db))
	mux.HandleFunc("/api/groups/posts/create", handlers.CreateGroupPostHandler(db))
	mux.HandleFunc("/api/groups/posts", handlers.GetGroupPostsHandler(db))
	mux.HandleFunc("/api/groups/events", handlers.GetGroupEventsHandler(db))
	mux.HandleFunc("/api/groups/events/create", handlers.CreateGroupEventHandler(db))
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		chatHandlers.HandleChat(w, r)
	})
	mux.HandleFunc("/api/chat-history", handlers.GetChatHistory)
	mux.HandleFunc("/api/online-users", handlers.GetOnlineUsers)
	mux.HandleFunc("/api/search/users", handlers.SearchUsers)
	mux.HandleFunc("/api/user", handlers.GetCurrentUser)
	mux.HandleFunc("/api/users", handlers.GetAllUsers)
	mux.HandleFunc("/api/groups/chat-history", handlers.GetGroupChatHistory)

	// --- Static file handlers registered LAST ---
	mux.Handle("/web/", http.StripPrefix("/web/uploads", http.FileServer(http.Dir(filepath.Join(dir, "..", "web", "uploads")))))
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(dir, "..", "web", "static")))))
	mux.HandleFunc("/", handlers.IndexHandler(template.Must(template.ParseGlob(filepath.Join(dir, "..", "web", "*.html")))))

	// Start the server
	log.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe("localhost:8080", mux))
}
