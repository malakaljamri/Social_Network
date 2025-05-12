package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"social_network/internal/database"
	"strconv"
)

func CreateGroupPostHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/posts/create")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("❌ Failed to get user ID from session: %v", err)
			http.Error(w, "Failed to get user ID from session", http.StatusUnauthorized)
			return
		}

		var post database.GroupPost
		err = json.NewDecoder(r.Body).Decode(&post)
		if err != nil {
			log.Printf("❌ Failed to decode request body: %v", err)
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		post.UserID = userID

		log.Printf("📦 Creating group post with data: %+v", post)

		err = database.CreateGroupPost(db, &post)
		if err != nil {
			log.Printf("❌ Failed to create group post: %v", err)
			http.Error(w, fmt.Sprintf("Failed to create group post: %v", err), http.StatusInternalServerError)
			return
		}

		log.Println("✅ Group post created successfully")

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"post_id": post.ID,
		})
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
