package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/utils"
	"strconv"
	"time"
)

type GroupEventsResponse struct {
	Upcoming []database.GroupEvent `json:"upcoming"`
	Past     []database.GroupEvent `json:"past"`
}

func GetGroupEventsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Group ID is required")
			return
		}
		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
			return
		}
		events, err := database.GetGroupEvents(db, groupID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch group events")
			return
		}
		resp := map[string]interface{}{
			"events": events,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func CreateGroupEventHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}
		var req struct {
			GroupID     int    `json:"group_id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			EventDate   string `json:"event_date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		if req.GroupID <= 0 || req.Title == "" || req.Description == "" || req.EventDate == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Missing required fields")
			return
		}
		// Validate date (must be today or future)
		eventDate, err := time.Parse("2006-01-02", req.EventDate)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid date format (expected YYYY-MM-DD)")
			return
		}
		today := time.Now().Truncate(24 * time.Hour)
		if eventDate.Before(today) {
			utils.WriteJSONError(w, http.StatusBadRequest, "Event date must be today or in the future")
			return
		}
		err = database.CreateGroupEvent(db, req.GroupID, req.Title, req.Description, req.EventDate, userID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create event")
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}
