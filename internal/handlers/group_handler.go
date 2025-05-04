package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social_network/internal/database"
	"log"
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

        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(map[string]string{
            "status": "success",
        })
    }
}



