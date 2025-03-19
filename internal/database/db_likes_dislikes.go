package database

import (
	"database/sql"
	// "fmt"
	"forum-project/internal/models"
)

func CreateLikeDislike(likeDislike *models.LikeDislike) (bool, error) {
	tx, err := db.Begin()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	// Check if a like/dislike already exists
	var existingID int
	var existingIsLike bool
	err = tx.QueryRow(`SELECT id, is_like FROM likes_dislikes 
		WHERE user_id = ? AND post_id = ? AND comment_id = ?`,
		likeDislike.UserID, likeDislike.PostID, likeDislike.CommentID).Scan(&existingID, &existingIsLike)

	if err == nil {
		// If it exists and it's the same type (like/dislike), delete it
		if existingIsLike == likeDislike.IsLike {
			_, err = tx.Exec(`DELETE FROM likes_dislikes WHERE id = ?`, existingID)
			if err != nil {
				return false, err
			}
			return false, tx.Commit() // Returning false indicates the like/dislike was removed
		}
		// If it exists but it's different, update it
		_, err = tx.Exec(`UPDATE likes_dislikes SET is_like = ? WHERE id = ?`, likeDislike.IsLike, existingID)
		if err != nil {
			return false, err
		}
		likeDislike.ID = existingID
	} else if err == sql.ErrNoRows {
		// If it doesn't exist, insert a new one
		result, err := tx.Exec(`INSERT INTO likes_dislikes (user_id, post_id, comment_id, is_like) VALUES (?, ?, ?, ?)`,
			likeDislike.UserID, likeDislike.PostID, likeDislike.CommentID, likeDislike.IsLike)
		if err != nil {
			return false, err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return false, err
		}
		likeDislike.ID = int(id)
	} else {
		return false, err
	}

	return true, tx.Commit() // Returning true indicates the like/dislike was added or updated
}

func GetLikesDislikes(postID, commentID int) ([]models.LikeDislike, error) {
	query := `SELECT id, user_id, post_id, comment_id, is_like FROM likes_dislikes WHERE post_id = ? OR comment_id = ?`
	rows, err := FetchData(query, postID, commentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var likesDislikes []models.LikeDislike
	for rows.Next() {
		var ld models.LikeDislike
		if err := rows.Scan(&ld.ID, &ld.UserID, &ld.PostID, &ld.CommentID, &ld.IsLike); err != nil {
			return nil, err
		}
		likesDislikes = append(likesDislikes, ld)
	}
	return likesDislikes, nil
}

func DeleteLikeDislike(id int) error {
	query := `DELETE FROM likes_dislikes WHERE id = ?`
	_, err := ExecuteQuery(query, id)
	return err
}

// func GetLikeDislikeCounts(postID, commentID int) (likes int, dislikes int, err error) {
// 	var query string
// 	var id int

// 	if postID != 0 {
// 		query = `SELECT 
//             SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as likes,
//             SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislikes
//         FROM likes_dislikes 
//         WHERE post_id = ?`
// 		id = postID
// 	} else if commentID != 0 {
// 		query = `SELECT 
//             SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as likes,
//             SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislikes
//         FROM likes_dislikes 
//         WHERE comment_id = ?`
// 		id = commentID
// 	} else {
// 		return 0, 0, fmt.Errorf("either postID or commentID must be provided")
// 	}

// 	row := db.QueryRow(query, id)
// 	err = row.Scan(&likes, &dislikes)
// 	return
// }
