package database

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"social_network/internal/models"
	"strconv"
	"strings"
	"time"
)

func CreatePost(post *models.Post) error {
	query := `INSERT INTO posts (user_id, title, content, privacy, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
	result, err := ExecuteQuery(query, post.UserID, post.Title, post.Text, post.Privacy)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	post.ID = int(id)
	return nil
}

func GetPosts(page, limit int) ([]models.Post, int, error) {
	offset := (page - 1) * limit

	// First, get the total count
	var totalCount int
	err := db.QueryRow("SELECT COUNT(*) FROM posts").Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	// Then, fetch the posts for the current page
	query := `SELECT id, user_id, title, content, created_at, (SELECT username FROM users WHERE id = user_id) AS author
          FROM posts ORDER BY id DESC LIMIT ? OFFSET ?`
	rows, err := FetchData(query, limit, offset)
	if err != nil {
		log.Printf("\033[31m❌ Error fetching posts: %v\033[0m", err)
		return nil, 0, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		if err := rows.Scan(&post.ID, &post.UserID, &post.Title, &post.Text, &post.CreatedAt, &post.Author); err != nil {
			return nil, 0, err
		}
		posts = append(posts, post)
	}
	return posts, totalCount, nil
}

func GetPostByID(postID int) (models.Post, error) {
	query := `
    SELECT p.id, p.user_id, p.title, p.content, p.created_at,
           COALESCE(SUM(CASE WHEN ld.is_like = 1 THEN 1 ELSE 0 END), 0) as likes,
           COALESCE(SUM(CASE WHEN ld.is_like = 0 THEN 1 ELSE 0 END), 0) as dislikes
    FROM posts p
    LEFT JOIN likes_dislikes ld ON p.id = ld.post_id
    WHERE p.id = ?
    GROUP BY p.id`
	rows, err := FetchData(query, postID)
	if err != nil {
		return models.Post{}, err
	}
	defer rows.Close()

	var post models.Post
	if rows.Next() {
		err := rows.Scan(&post.ID, &post.UserID, &post.Title, &post.Text, &post.CreatedAt, &post.Likes, &post.Dislikes)
		if err != nil {
			return models.Post{}, err
		}
	}
	return post, nil
}

func DeletePost(postID int) error {
	query := `DELETE FROM posts WHERE id = ?`
	_, err := ExecuteQuery(query, postID)
	return err
}

func GetPostsByUserID(userID int) ([]models.Post, error) {
	query := `
    SELECT p.id, p.user_id, p.title, p.content, p.created_at,
           COALESCE(SUM(CASE WHEN ld.is_like = 1 THEN 1 ELSE 0 END), 0) as likes,
           COALESCE(SUM(CASE WHEN ld.is_like = 0 THEN 1 ELSE 0 END), 0) as dislikes
    FROM posts p
    LEFT JOIN likes_dislikes ld ON p.id = ld.post_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.id DESC`

	rows, err := FetchData(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		if err := rows.Scan(&post.ID, &post.UserID, &post.Title, &post.Text, &post.CreatedAt, &post.Likes, &post.Dislikes); err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}
	return posts, nil
}

func GetFilteredPosts(page, limit int, filters map[string]interface{}, r *http.Request) ([]models.Post, int, error) {
	query := `
	SELECT p.id, p.user_id, p.title, p.content, p.created_at,
		   COALESCE(SUM(CASE WHEN ld.is_like = 1 THEN 1 ELSE 0 END), 0) as likes,
		   COALESCE(SUM(CASE WHEN ld.is_like = 0 THEN 1 ELSE 0 END), 0) as dislikes,
		   GROUP_CONCAT(DISTINCT pc.category_id) as category_ids
	FROM posts p
	LEFT JOIN likes_dislikes ld ON p.id = ld.post_id
	LEFT JOIN post_categories pc ON p.id = pc.post_id
	WHERE 1=1`

	var args []interface{}

	if categories, ok := filters["categories"].([]interface{}); ok && len(categories) > 0 {
		placeholders := make([]string, len(categories))
		for i, category := range categories {
			placeholders[i] = "?"
			args = append(args, category)
		}
		query += " AND pc.category_id IN (" + strings.Join(placeholders, ",") + ")"
	}

	if fromDate, ok := filters["fromDate"].(string); ok && fromDate != "" {
		parsedFromDate, _ := time.Parse("2006-01-02", fromDate)
		query += " AND p.created_at >= ?"
		args = append(args, parsedFromDate.Format("2006-01-02 15:04:05"))
	}

	if toDate, ok := filters["toDate"].(string); ok && toDate != "" {
		parsedToDate, _ := time.Parse("2006-01-02", toDate)
		query += " AND p.created_at <= ?"
		args = append(args, parsedToDate.Format("2006-01-02 15:04:05"))
	}

	if loggedInUserFilter, ok := filters["loggedInUserFilter"].(bool); ok && loggedInUserFilter {
		userID, err := GetUserIDFromSession(r)
		if err == nil && userID > 0 {
			query += " AND p.user_id = ?"
			args = append(args, userID)
		}
	}

	if likedByUserID, ok := filters["likedOnly"].(bool); ok && likedByUserID {
		userID, err := GetUserIDFromSession(r)
		if err == nil && userID > 0 {
			query += " AND p.id IN (SELECT post_id FROM likes_dislikes WHERE user_id = ? AND is_like = 1)"
			args = append(args, userID)
		}
	}

	query += " GROUP BY p.id ORDER BY p.id DESC LIMIT ? OFFSET ?"
	args = append(args, limit, (page-1)*limit)

	finalQuery := query
	for _, arg := range args {
		finalQuery = strings.Replace(finalQuery, "?", fmt.Sprintf("%v", arg), 1)
	}
	log.Println("🎬🎬🎬🎬Final query:", finalQuery)

	log.Printf("Executing query with args: %v", args)
	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Error executing query: %v", err)
		return nil, 0, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		var categoryIDsStr sql.NullString
		err := rows.Scan(&post.ID, &post.UserID, &post.Title, &post.Text, &post.CreatedAt, &post.Likes, &post.Dislikes, &categoryIDsStr)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			return nil, 0, err
		}
		log.Printf("Scanned post: %+v", post)
		if categoryIDsStr.Valid {
			categoryIDs := strings.Split(categoryIDsStr.String, ",")
			post.Categories = make([]int, len(categoryIDs))
			for i, idStr := range categoryIDs {
				id, _ := strconv.Atoi(idStr)
				post.Categories[i] = id
			}
		}
		posts = append(posts, post)
	}

	log.Printf("Total posts retrieved: %d", len(posts))

	var totalCount int
	countQuery := "SELECT COUNT(DISTINCT p.id) " + query[strings.Index(query, "FROM"):]
	countQuery = strings.Replace(countQuery, "GROUP BY p.id ORDER BY p.id DESC LIMIT ? OFFSET ?", "", 1)
	finalQuery2 := countQuery
	for _, arg := range args {
		finalQuery2 = strings.Replace(finalQuery2, "?", fmt.Sprintf("%v", arg), 1)
	}
	log.Println("🎬🎬🎬🎬Final countQuery:", finalQuery2)
	err = db.QueryRow(countQuery, args[:len(args)-2]...).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	log.Printf("Total count from database: %d", totalCount)

	return posts, totalCount, nil
}

func GetOldestPostDate() (string, error) {
	query := "SELECT MIN(created_at) FROM posts"
	row := db.QueryRow(query)
	var date string
	err := row.Scan(&date)
	if err != nil {
		return "", err
	}
	// log.Println("👍👍👍👍GetOldestPostDate:", date)
	return date, nil
}

func GetNewestPostDate() (string, error) {
	query := "SELECT DATE(MAX(created_at), '+1 day') || ' 00:00:01' FROM posts"
	row := db.QueryRow(query)
	var date string
	err := row.Scan(&date)
	if err != nil {
		return "", err
	}
	return date, nil
}
