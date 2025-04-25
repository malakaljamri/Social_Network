package handlers

import (
	"encoding/json"
	"net/http"

	db "social_network/internal/database"
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
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
