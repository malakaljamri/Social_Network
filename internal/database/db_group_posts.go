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

// CreateGroupPost creates a new post in a group
func CreateGroupPost(db *sql.DB, post *GroupPost) error {
	if post == nil {
		return errors.New("post cannot be nil")
	}

	query := `
		INSERT INTO group_posts (group_id, user_id, title, content, privacy_setting, category_id, file_path)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.Exec(query, post.GroupID, post.UserID, post.Title, post.Content, post.PrivacySetting, post.CategoryID, post.FilePath)
	if err != nil {
		return fmt.Errorf("failed to insert group post: %v", err)
	}

	return nil
}

// GetGroupPosts retrieves all posts for a specific group
func GetGroupPosts(db *sql.DB, groupID int) ([]GroupPost, error) {
	query := `
		SELECT gp.id, gp.group_id, gp.user_id, gp.title, gp.content, 
			   gp.privacy_setting, gp.category_id, gp.file_path, gp.created_at,
			   u.username
		FROM group_posts gp
		JOIN users u ON gp.user_id = u.id
		WHERE gp.group_id = ?
		ORDER BY gp.created_at DESC
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
