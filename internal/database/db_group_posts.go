package database

import (
	"database/sql"
	"errors"
	"fmt"
)

type GroupPost struct {
	ID             int    `json:"id"`
	GroupID        int    `json:"group_id"`
	UserID         int    `json:"user_id"`
	Title          string `json:"title"`
	Content        string `json:"content"`
	PrivacySetting string `json:"privacy_setting"`
	CategoryID     *int   `json:"category_id"`
	FilePath       string `json:"file_path"`
	CreatedAt      string `json:"created_at"`
	Username       string `json:"username"`
}

type GroupEvent struct {
	ID          int    `json:"id"`
	GroupID     int    `json:"group_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	EventDate   string `json:"event_date"`
	CreatedBy   int    `json:"created_by"`
}

// CreateGroupPost creates a new post in a group using the main posts table
func CreateGroupPost(db *sql.DB, post *GroupPost) error {
	if post == nil {
		return errors.New("post cannot be nil")
	}

	// Validate required fields
	if post.GroupID <= 0 {
		return errors.New("invalid group ID")
	}
	if post.UserID <= 0 {
		return errors.New("invalid user ID")
	}
	if post.Title == "" {
		return errors.New("title is required")
	}
	if post.Content == "" {
		return errors.New("content is required")
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// Verify group exists
	var groupExists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE id = ?)", post.GroupID).Scan(&groupExists)
	if err != nil {
		return fmt.Errorf("failed to verify group existence: %v", err)
	}
	if !groupExists {
		return fmt.Errorf("group with ID %d does not exist", post.GroupID)
	}

	// Insert into posts table with group_id
	query := `
		INSERT INTO posts (user_id, title, content, privacy, image, group_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
	`
	result, err := tx.Exec(query, post.UserID, post.Title, post.Content, post.PrivacySetting, post.FilePath, post.GroupID)
	if err != nil {
		return fmt.Errorf("failed to insert post: %v", err)
	}

	// Get the last inserted ID
	postID, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert ID: %v", err)
	}

	// If there's a category, add it
	if post.CategoryID != nil {
		categoryQuery := `
			INSERT INTO post_categories (post_id, category_id)
			VALUES (?, ?)
		`
		_, err = tx.Exec(categoryQuery, postID, *post.CategoryID)
		if err != nil {
			return fmt.Errorf("failed to insert post category: %v", err)
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Update the post ID in the struct
	post.ID = int(postID)
	return nil
}

// GetGroupPosts retrieves all posts for a specific group from the main posts table
func GetGroupPosts(db *sql.DB, groupID int) ([]GroupPost, error) {
	query := `
		SELECT p.id, p.group_id, p.user_id, p.title, p.content, 
			   p.privacy, pc.category_id, p.image, p.created_at,
			   u.username
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_categories pc ON p.id = pc.post_id
		WHERE p.group_id = ?
		ORDER BY p.created_at DESC
	`

	rows, err := db.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []GroupPost
	for rows.Next() {
		var post GroupPost
		var categoryID sql.NullInt64
		err := rows.Scan(
			&post.ID,
			&post.GroupID,
			&post.UserID,
			&post.Title,
			&post.Content,
			&post.PrivacySetting,
			&categoryID,
			&post.FilePath,
			&post.CreatedAt,
			&post.Username,
		)
		if err != nil {
			return nil, err
		}
		if categoryID.Valid {
			catID := int(categoryID.Int64)
			post.CategoryID = &catID
		}
		posts = append(posts, post)
	}

	return posts, nil
}

// GetGroupEvents retrieves all events for a specific group
func GetGroupEvents(db *sql.DB, groupID int) ([]GroupEvent, error) {
	query := `
		SELECT id, group_id, title, description, event_date, created_by
		FROM events
		WHERE group_id = ?
		ORDER BY event_date ASC
	`
	rows, err := db.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []GroupEvent
	for rows.Next() {
		var event GroupEvent
		err := rows.Scan(
			&event.ID,
			&event.GroupID,
			&event.Title,
			&event.Description,
			&event.EventDate,
			&event.CreatedBy,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}
