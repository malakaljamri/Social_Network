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

	// Apply any pending database migrations
	if err := database.ApplyMigrations(); err != nil {
		log.Fatal("Error applying database migrations:", err)
	}

	hub := websocket.NewHub()
	go hub.Run()
	// go websocket.BroadcastTime(hub) // This function is only for testing purposes

	// handlers with hub
	authHandlers := auth.NewAuthHandlers(hub)
	chatHandlers := handlers.NewChatHandlers(hub)

	// Create a new ServeMux
	mux := http.NewServeMux()
	// Get the directory of the current file
	_, currentFile, _, _ := runtime.Caller(0)
	dir := filepath.Dir(currentFile)

	// Serve static files
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(dir, "..", "web", "static")))))
	// mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))
	mux.HandleFunc("/", handlers.IndexHandler(template.Must(template.ParseGlob(filepath.Join(dir, "..", "web", "*.html")))))

	// API routes
	mux.HandleFunc("/api/logout", authHandlers.LogoutHandler)
	mux.HandleFunc("/api/login", authHandlers.LoginHandler)
	mux.HandleFunc("/api/user_status", authHandlers.UserStatusHandler)
	mux.HandleFunc("/api/register", authHandlers.RegisterHandler)
	mux.HandleFunc("/api/posts", handlers.GetPostsHandler)
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

	// Other routes (to be implemented)
	mux.HandleFunc("/categories", handlers.GetCategories)
	mux.HandleFunc("/category/create", handlers.CreateCategory)
	mux.HandleFunc("/category/delete", handlers.DeleteCategory)
	mux.HandleFunc("/posts", handlers.GetPosts)
	mux.HandleFunc("/post", handlers.PostHandler)
	mux.HandleFunc("/post/create", handlers.CreatePost)
	mux.HandleFunc("/post/delete", handlers.DeletePost)
	mux.HandleFunc("/comments", handlers.GetComments)
	mux.HandleFunc("/comment/create", handlers.CreateComment)
	mux.HandleFunc("/comment/delete", handlers.DeleteComment)
	mux.HandleFunc("/post/like", handlers.LikePost)
	mux.HandleFunc("/post/dislike", handlers.DislikePost)
	// mux.HandleFunc("/comment/like", handlers.LikeComment)
	// mux.HandleFunc("/comment/dislike", handlers.DislikeComment)

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		chatHandlers.HandleChat(w, r)
	})

	mux.HandleFunc("/api/chat-history", handlers.GetChatHistory)
	mux.HandleFunc("/api/online-users", handlers.GetOnlineUsers)

	// Start the server
	log.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe("localhost:8080", mux))
}
