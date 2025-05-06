package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/websocket"
	"strconv"
)

func CreateGroupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/create")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			http.Error(w, "Failed to get user ID from session", http.StatusUnauthorized)
			return
		}

		var group database.Group
		err = json.NewDecoder(r.Body).Decode(&group)
		if err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		group.CreatorID = userID

		log.Printf("📦 Creating group: %+v", group)

		err = database.CreateGroup(db, &group)
		if err != nil {
			log.Printf("❌ Failed to insert group: %v", err)
			http.Error(w, "Failed to create group", http.StatusInternalServerError)
			return
		}

		log.Println("✅ Group inserted into DB")

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
				"id":          group.ID,
				"name":        group.Name,
				"description": group.Description,
				"created_at":  group.CreatedAt,
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

func GetGroupPostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get group name from URL
		groupName := r.URL.Query().Get("name")
		if groupName == "" {
			http.Error(w, "Group name is required", http.StatusBadRequest)
			return
		}

		// Get pagination parameters
		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if err != nil || page < 1 {
			page = 1
		}
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil || limit < 1 {
			limit = 10
		}

		// Get posts for the group
		posts, totalCount, err := database.GetGroupPosts(db, groupName, page, limit)
		if err != nil {
			log.Printf("Error fetching group posts: %v", err)
			http.Error(w, "Failed to fetch group posts", http.StatusInternalServerError)
			return
		}

		// Calculate total pages
		totalPages := (totalCount + limit - 1) / limit

		// Set headers
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Total-Pages", strconv.Itoa(totalPages))

		// Return posts
		json.NewEncoder(w).Encode(map[string]interface{}{
			"posts": posts,
			"total": totalCount,
			"page":  page,
			"limit": limit,
		})
	}
}
