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
	"strings"
	"time"
)

var migrate = false

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	// Initialize the database
	db, err := database.InitializeDB()
	if err != nil {
		log.Fatal("Error initializing database:", err)
	}
	defer db.Close()

	if migrate {
		// Run followers table migration to fix schema
		log.Println("Waiting for database to be ready before migration...")
		time.Sleep(2 * time.Second) // Give database time to be ready

		if err := database.MigrateFollowersTable(); err != nil {
			log.Printf("WARNING: Failed to migrate followers table: %v", err)
			// Don't fatal here as the app can still work with the old schema
		} else {
			log.Println("Followers table migration completed successfully")
		}
	}

	go websocket.MainHub.Run() //Starts the WebSocket hub's main loop in a new goroutine.

	// go websocket.BroadcastTime(hub) // This function is only for testing purposes

	// handlers with hub
	authHandlers := auth.NewAuthHandlers(websocket.MainHub)
	chatHandlers := handlers.NewChatHandlers(websocket.MainHub)

	// Create a new ServeMux
	mux := http.NewServeMux() //multiplexer route incoming HTTP based on thier req url , method
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

	// User profile and follow routes (unified under /api/user/)
	mux.HandleFunc("/api/user/profile", handlers.GetUserProfile)
	mux.HandleFunc("/api/user/posts", handlers.GetUserPosts)
	mux.HandleFunc("/api/user/followers", handlers.GetUserFollowers)
	mux.HandleFunc("/api/user/following", handlers.GetUserFollowing)
	mux.HandleFunc("/api/user/follow", handlers.FollowUser)
	mux.HandleFunc("/api/user/unfollow", handlers.UnfollowUser)
	mux.HandleFunc("/api/user/privacy", handlers.UpdatePrivacySettings)
	mux.HandleFunc("/api/user/change_password", handlers.ChangePasswordHandler)
	mux.HandleFunc("/api/user/image", handlers.UpdateProfileImage)
	mux.HandleFunc("/api/user/info", handlers.UpdateProfileInfo)
	mux.HandleFunc("/api/user/follow-request", handlers.HandleFollowRequest)
	mux.HandleFunc("/api/user/follow-requests", handlers.GetPendingFollowRequestsHandler)

	// Category endpoints unified under /api/
	mux.HandleFunc("/api/categories", handlers.GetCategories)
	mux.HandleFunc("/api/category/create", handlers.CreateCategory)
	mux.HandleFunc("/api/category/delete", handlers.DeleteCategory)

	// Post endpoints unified under /api/
	mux.HandleFunc("/api/post", handlers.PostHandler)
	mux.HandleFunc("/api/post/create", handlers.CreatePost)
	mux.HandleFunc("/api/post/delete", handlers.DeletePost)
	mux.HandleFunc("/api/comments", handlers.GetComments)
	mux.HandleFunc("/api/comment/create", handlers.CreateComment)
	mux.HandleFunc("/api/comment/delete", handlers.DeleteComment)
	mux.HandleFunc("/api/post/like", handlers.LikePost)
	mux.HandleFunc("/api/post/dislike", handlers.DislikePost)

	// Remove/redirect legacy endpoints
	mux.HandleFunc("/posts", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/posts", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/post", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/post", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/post/create", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/post/create", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/post/delete", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/post/delete", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/category/create", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/category/create", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/category/delete", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/category/delete", http.StatusMovedPermanently)
	})

	// Group endpoints unified under /api/
	mux.HandleFunc("/api/groups/create", handlers.CreateGroupHandler(db))
	mux.HandleFunc("/api/groups", handlers.GetAllGroupsHandler(db))
	mux.HandleFunc("/api/groups/access", handlers.CheckGroupAccessHandler(db))
	mux.HandleFunc("/api/groups/join", handlers.RequestGroupJoinHandler(db))
	mux.HandleFunc("/api/groups/posts/create", handlers.CreateGroupPostHandler(db))
	mux.HandleFunc("/api/groups/posts", handlers.GetGroupPostsHandler(db))
	mux.HandleFunc("/api/groups/events", handlers.GetGroupEventsHandler(db))
	mux.HandleFunc("/api/groups/events/create", handlers.CreateGroupEventHandler(db))
	mux.HandleFunc("/api/groups/events/attendance", handlers.EventAttendanceHandler(db))
	mux.HandleFunc("/api/groups/events/attendance/list", handlers.ListEventAttendeesHandler(db))
	mux.HandleFunc("/api/groups/access/batch", handlers.BatchGroupAccessHandler(db))
	mux.HandleFunc("/api/groups/members", handlers.GetGroupMembersHandler(db))
	mux.HandleFunc("/api/groups/invite", handlers.RequestGroupInviteHandler(db))
	mux.HandleFunc("/api/groups/invite/action", handlers.HandleGroupInviteActionHandler(db))

	// Chat and WebSocket routes
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		chatHandlers.HandleChat(w, r)
	})
	mux.HandleFunc("/api/chat-history", handlers.GetChatHistory)
	mux.HandleFunc("/api/online-users", handlers.GetOnlineUsers)
	mux.HandleFunc("/api/search/users", handlers.SearchUsers)
	mux.HandleFunc("/api/user", handlers.GetCurrentUser)
	mux.HandleFunc("/api/users", handlers.GetAllUsers)
	mux.HandleFunc("/api/groups/chat-history", handlers.GetGroupChatHistory)
	mux.HandleFunc("/api/unread-counts", handlers.GetUnreadCounts)
	mux.HandleFunc("/api/unread-group-counts", handlers.GetUnreadGroupCountsHandler)

	// Notification routes
	mux.HandleFunc("/api/notifications", handlers.GetNotificationsHandler)
	mux.HandleFunc("/api/notifications/mark-read", handlers.MarkAsReadHandler)
	mux.HandleFunc("/api/notifications/action", handlers.HandleNotificationActionHandler)
	mux.HandleFunc("/api/notifications/count", handlers.GetUnreadNotificationCountHandler)

	// Group notification action routes
	// mux.HandleFunc("/api/groups/handle-invite", handlers.HandleGroupInviteAction(db))
	// mux.HandleFunc("/api/groups/handle-join-request", handlers.HandleGroupJoinRequestAction(db))

	// --- Static file handlers registered LAST ---
	// Custom file server to handle both avatar files and regular uploads
	mux.HandleFunc("/web/", func(w http.ResponseWriter, r *http.Request) {
		// Remove the /web/ prefix
		path := strings.TrimPrefix(r.URL.Path, "/web/")

		// If path starts with "uploads/", remove it for file system lookup
		// This handles files stored with /uploads/ prefix in database
		if after, ok := strings.CutPrefix(path, "uploads/"); ok {
			path = after
		}

		// Serve the file from web/uploads directory
		filePath := filepath.Join(dir, "..", "web", "uploads", path)
		http.ServeFile(w, r, filePath)
	})
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(dir, "..", "web", "static")))))
	mux.HandleFunc("/", handlers.IndexHandler(template.Must(template.ParseGlob(filepath.Join(dir, "..", "web", "*.html")))))

	// Start the server
	log.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe("localhost:8080", mux))
}
