package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social_network/internal/database"
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
			http.Error(w, "Group ID is required", http.StatusBadRequest)
			return
		}
		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			http.Error(w, "Invalid group ID", http.StatusBadRequest)
			return
		}
		events, err := database.GetGroupEvents(db, groupID)
		if err != nil {
			http.Error(w, "Failed to fetch group events", http.StatusInternalServerError)
			return
		}
		now := time.Now()
		var upcoming, past []database.GroupEvent
		for _, event := range events {
			eventTime, err := time.Parse("2006-01-02 15:04:05", event.EventDate)
			if err != nil {
				continue
			}
			if eventTime.After(now) || eventTime.Format("2006-01-02") == now.Format("2006-01-02") {
				upcoming = append(upcoming, event)
			} else {
				past = append(past, event)
			}
		}
		resp := GroupEventsResponse{
			Upcoming: upcoming,
			Past:     past,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
