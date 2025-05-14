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

		log.Printf("📦 Creating group: %+v", group)

		err = database.CreateGroup(db, &group)
		if err != nil {
			log.Printf("❌ Failed to insert group: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create group: %v", err))
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
