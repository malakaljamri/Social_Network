package handlers

import (
	"encoding/json"
	"net/http"

	db "social_network/internal/database"
	"social_network/internal/utils"
)

// SearchUsers handles /api/search/users?q= query for user search autocomplete
func SearchUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}
	users, err := db.SearchUsersByUsername(q)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Database error")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
