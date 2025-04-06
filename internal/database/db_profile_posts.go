package database

import (
	"social_network/internal/models"
	"strconv"
	"strings"
)

// GetPostsByUser retrieves posts created by a specific user with pagination
func GetPostsByUser(userID, page, limit int) ([]models.Post, error) {
	offset := (page - 1) * limit
	
	query := `
		SELECT p.id, p.title, p.content, p.user_id, p.created_at, u.username,
			(SELECT COUNT(*) FROM likes_dislikes WHERE post_id = p.id AND is_like = 1) as likes,
			(SELECT COUNT(*) FROM likes_dislikes WHERE post_id = p.id AND is_like = 0) as dislikes,
			GROUP_CONCAT(DISTINCT pc.category_id) as categories
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_categories pc ON p.id = pc.post_id
		WHERE p.user_id = ?
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`
	
	rows, err := FetchData(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var posts []models.Post
	for rows.Next() {
		var post models.Post
		var categoriesStr string
		
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
			return nil, err
		}
		
		post.Categories = parseCategoriesFromString(categoriesStr)
		posts = append(posts, post)
	}
	
	return posts, nil
}

// parseCategoriesFromString converts a comma-separated string of category IDs to a slice of integers
func parseCategoriesFromString(categoriesStr string) []int {
	if categoriesStr == "" {
		return []int{}
	}
	
	idStrings := strings.Split(categoriesStr, ",")
	ids := make([]int, 0, len(idStrings))
	
	for _, idStr := range idStrings {
		id, err := strconv.Atoi(strings.TrimSpace(idStr))
		if err == nil {
			ids = append(ids, id)
		}
	}
	
	return ids
}
