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

// EventAttendanceHandler handles GET and POST for event attendance in one function
func EventAttendanceHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			// GET logic
			eventIDStr := r.URL.Query().Get("event_id")
			if eventIDStr == "" {
				utils.WriteJSONError(w, http.StatusBadRequest, "Event ID is required")
				return
			}
			eventID, err := strconv.Atoi(eventIDStr)
			if err != nil {
				utils.WriteJSONError(w, http.StatusBadRequest, "Invalid event ID")
				return
			}
			userID, err := database.GetUserIDFromSession(r)
			if err != nil {
				utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
				return
			}
			status, err := database.GetUserEventAttendance(db, eventID, userID)
			if err != nil {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch attendance status")
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": status})
		} else if r.Method == http.MethodPost {
			// POST logic
			userID, err := database.GetUserIDFromSession(r)
			if err != nil {
				utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
				return
			}
			var req struct {
				EventID int    `json:"event_id"`
				Status  string `json:"status"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				utils.WriteJSONError(w, http.StatusBadRequest, "Invalid request body")
				return
			}
			if req.EventID <= 0 || (req.Status != "going" && req.Status != "not going") {
				utils.WriteJSONError(w, http.StatusBadRequest, "Missing or invalid fields")
				return
			}
			err = database.SetUserEventAttendance(db, req.EventID, userID, req.Status)
			if err != nil {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to set attendance status")
				return
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": req.Status})
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// ListEventAttendeesHandler returns a list of users who are 'going' to a given event
func ListEventAttendeesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventIDStr := r.URL.Query().Get("event_id")
		if eventIDStr == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Event ID is required")
			return
		}
		eventID, err := strconv.Atoi(eventIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid event ID")
			return
		}
		attendees, err := database.ListEventAttendees(db, eventID)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to fetch attendees")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count":     len(attendees),
			"attendees": attendees,
		})
	}
}
