package database

import (
	"database/sql"
	"errors"
	"fmt"
	"social_network/internal/models"
)

type Group struct {
	ID          int
	Name        string
	Description string
	CreatorID   int
	CreatedAt   string
}

type GroupWithCreator struct {
	ID          int        `json:"ID"`
	Name        string     `json:"Name"`
	Description string     `json:"Description"`
	CreatedAt   string     `json:"CreatedAt"`
	Creator     UserDetail `json:"Creator"`
}

type UserDetail struct {
	Username string `json:"Username"`
}

func CreateGroup(db *sql.DB, group *Group) error {
	if group == nil {
		return errors.New("group cannot be nil")
	}

	query := `
		INSERT INTO groups (name, description, creator_id)
		VALUES (?, ?, ?)
	`
	_, err := db.Exec(query, group.Name, group.Description, group.CreatorID)
	if err != nil {
		return fmt.Errorf("failed to insert group: %v", err)
	}

	return nil
}

func GetAllGroups(db *sql.DB) ([]GroupWithCreator, error) {
	query := `
		SELECT g.id, g.name, g.description, g.created_at, u.username
		FROM groups g
		JOIN users u ON g.creator_id = u.id
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []GroupWithCreator
	for rows.Next() {
		var g GroupWithCreator
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.CreatedAt, &g.Creator.Username)
		if err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	return groups, nil
}

// GetGroupPosts retrieves posts for a specific group with pagination
func GetGroupPosts(db *sql.DB, groupName string, page, limit int) ([]models.Post, int, error) {
	// First get the group ID
	var groupID int
	err := db.QueryRow("SELECT id FROM groups WHERE name = ?", groupName).Scan(&groupID)
	if err != nil {
		return nil, 0, err
	}

	// Get total count
	var totalCount int
	err = db.QueryRow(`
		SELECT COUNT(*) 
		FROM posts p
		JOIN group_posts gp ON p.id = gp.post_id
		WHERE gp.group_id = ?
	`, groupID).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	// Get posts with pagination
	offset := (page - 1) * limit
	query := `
		SELECT p.id, p.title, p.content, p.user_id, p.created_at, u.username,
			(SELECT COUNT(*) FROM likes_dislikes WHERE post_id = p.id AND is_like = 1) as likes,
			(SELECT COUNT(*) FROM likes_dislikes WHERE post_id = p.id AND is_like = 0) as dislikes,
			GROUP_CONCAT(DISTINCT pc.category_id) as categories
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN group_posts gp ON p.id = gp.post_id
		LEFT JOIN post_categories pc ON p.id = pc.post_id
		WHERE gp.group_id = ?
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := db.Query(query, groupID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		var categoriesStr sql.NullString

		if err := rows.Scan(
			&post.ID,
			&post.Title,
			&post.Text,
			&post.UserID,
			&post.CreatedAt,
			&post.Author,
			&post.Likes,
			&post.Dislikes,
			&categoriesStr,
		); err != nil {
			return nil, 0, err
		}

		post.Categories = parseCategoriesFromString(categoriesStr.String)
		posts = append(posts, post)
	}

	return posts, totalCount, nil
}
