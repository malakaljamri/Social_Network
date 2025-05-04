package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social_network/internal/database"
)

func CreateGroupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			http.Error(w, "Failed to get user ID from session", http.StatusUnauthorized)
			return
		}

		var group database.Group
		if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if len(group.Name) < 3 || len(group.Description) < 10 {
			http.Error(w, "Invalid group data", http.StatusBadRequest)
			return
		}

		group.CreatorID = userID

		if err := database.CreateGroup(db, &group); err != nil {
			http.Error(w, "Failed to create group: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("Group created successfully"))
	}
}

