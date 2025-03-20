package database

import "social_network/internal/models"

func CreateComment(comment *models.Comment) error {
	query := `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`
	result, err := ExecuteQuery(query, comment.PostID, comment.UserID, comment.Text)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	comment.ID = int(id)
	return nil
}

func GetCommentsByPostID(postID int) ([]models.Comment, error) {
	query := `SELECT id, post_id, user_id, content, created_at, (SELECT username FROM users WHERE id = user_id) as user_name
	FROM comments WHERE post_id = ? order by id desc`
	rows, err := FetchData(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var comment models.Comment
		if err := rows.Scan(&comment.ID, &comment.PostID, &comment.UserID, &comment.Text, &comment.CreatedAt, &comment.Author); err != nil {
			return nil, err
		}
		comments = append(comments, comment)
	}
	return comments, nil
}

func DeleteComment(commentID int) error {
	query := `DELETE FROM comments WHERE id = ?`
	_, err := ExecuteQuery(query, commentID)
	return err
}
