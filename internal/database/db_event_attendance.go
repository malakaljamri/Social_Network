package database

import (
	"database/sql"
	"errors"
)

// GetUserEventAttendance returns the attendance status ("going" or "not going") for a user/event, or "not going" if not set.
func GetUserEventAttendance(db *sql.DB, eventID, userID int) (string, error) {
	var status string
	err := db.QueryRow(`SELECT status FROM event_attendance WHERE event_id = ? AND user_id = ?`, eventID, userID).Scan(&status)
	if err == sql.ErrNoRows {
		return "not going", nil // Default if not set
	}
	if err != nil {
		return "not going", err
	}
	return status, nil
}

// SetUserEventAttendance upserts the attendance status for a user/event.
func SetUserEventAttendance(db *sql.DB, eventID, userID int, status string) error {
	if status != "going" && status != "not going" {
		return errors.New("invalid status")
	}
	_, err := db.Exec(`INSERT INTO event_attendance (event_id, user_id, status) VALUES (?, ?, ?)
		ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`, eventID, userID, status)
	return err
}

// ListEventAttendees returns a list of usernames who are 'going' to the event
func ListEventAttendees(db *sql.DB, eventID int) ([]string, error) {
	rows, err := db.Query(`
		SELECT u.username FROM event_attendance ea
		JOIN users u ON ea.user_id = u.id
		WHERE ea.event_id = ? AND ea.status = 'going'
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var attendees []string
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			return nil, err
		}
		attendees = append(attendees, username)
	}
	return attendees, nil
}
