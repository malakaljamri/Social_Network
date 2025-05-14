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
