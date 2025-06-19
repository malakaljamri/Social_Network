package database

import (
	"social_network/internal/models"
)

// FollowUser creates a follower relationship between two users
func FollowUser(followerID, followedID int) error {
	// First, check if the target user has a private profile
	targetUser, err := GetUserByID(followedID)
	if err != nil {
		return err
	}

	var status string
	if targetUser.IsPrivate {
		// For private profiles, set status to 'pending'
		status = "pending"
	} else {
		// For public profiles, automatically accept the follow request
		status = "accepted"
	}

	query := `INSERT OR REPLACE INTO followers (follower_id, followed_id, status) VALUES (?, ?, ?)`
	_, err = ExecuteQuery(query, followerID, followedID, status)
	return err
}

// UnfollowUser removes a follower relationship
func UnfollowUser(followerID, followedID int) error {
	query := `DELETE FROM followers WHERE follower_id = ? AND followed_id = ?`
	_, err := ExecuteQuery(query, followerID, followedID)
	return err
}

// IsFollowing checks if user is following another user
func IsFollowing(followerID, followedID int) (bool, error) {
	query := `SELECT COUNT(*) FROM followers WHERE follower_id = ? AND followed_id = ? AND status = 'accepted'`
	rows, err := FetchData(query, followerID, followedID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	var count int
	if rows.Next() {
		if err := rows.Scan(&count); err != nil {
			return false, err
		}
	}
	return count > 0, nil
}

// GetFollowers returns all users following the specified user
func GetFollowers(userID int) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email 
		FROM users u
		JOIN followers f ON u.id = f.follower_id
		WHERE f.followed_id = ? AND f.status = 'accepted'
	`
	return fetchUsers(query, userID)
}

// GetFollowing returns all users that the specified user follows
func GetFollowing(userID int) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email 
		FROM users u
		JOIN followers f ON u.id = f.followed_id
		WHERE f.follower_id = ? AND f.status = 'accepted'
	`
	return fetchUsers(query, userID)
}

// GetFollowCounts returns the number of followers and following for a user
func GetFollowCounts(userID int) (followers int, following int, err error) {
	// Get followers count (only accepted)
	followersQuery := `SELECT COUNT(*) FROM followers WHERE followed_id = ? AND status = 'accepted'`
	followersRows, err := FetchData(followersQuery, userID)
	if err != nil {
		return 0, 0, err
	}
	defer followersRows.Close()

	if followersRows.Next() {
		if err := followersRows.Scan(&followers); err != nil {
			return 0, 0, err
		}
	}

	// Get following count (only accepted)
	followingQuery := `SELECT COUNT(*) FROM followers WHERE follower_id = ? AND status = 'accepted'`
	followingRows, err := FetchData(followingQuery, userID)
	if err != nil {
		return followers, 0, err
	}
	defer followingRows.Close()

	if followingRows.Next() {
		if err := followingRows.Scan(&following); err != nil {
			return followers, 0, err
		}
	}

	return followers, following, nil
}

// Helper function to fetch users from a query
func fetchUsers(query string, args ...interface{}) ([]models.User, error) {
	rows, err := FetchData(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email); err != nil {
			return nil, err
		}
		// Clear sensitive data
		user.Password = ""
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

// GetUserWithFollowCounts returns user info with follower and following counts
func GetUserWithFollowCounts(userID int) (models.UserProfile, error) {
	user, err := GetUserByID(userID)
	if err != nil {
		return models.UserProfile{}, err
	}

	followers, following, err := GetFollowCounts(userID)
	if err != nil {
		return models.UserProfile{}, err
	}

	// Get user's posts count (excluding group posts)
	postsQuery := `SELECT COUNT(*) FROM posts WHERE user_id = ? AND group_id IS NULL`
	postsRows, err := FetchData(postsQuery, userID)
	if err != nil {
		return models.UserProfile{}, err
	}
	defer postsRows.Close()

	var postsCount int
	if postsRows.Next() {
		if err := postsRows.Scan(&postsCount); err != nil {
			return models.UserProfile{}, err
		}
	}

	return models.UserProfile{
		User:           user,
		FollowersCount: followers,
		FollowingCount: following,
		PostsCount:     postsCount,
	}, nil
}

// AcceptFollowRequest accepts a follow request by updating the status to 'accepted'
func AcceptFollowRequest(followerID, followedID int) error {
	query := `
		UPDATE followers 
		SET status = 'accepted' 
		WHERE follower_id = ? AND followed_id = ?
	`
	_, err := ExecuteQuery(query, followerID, followedID)
	return err
}

// DeclineFollowRequest declines a follow request by updating the status to 'declined'
func DeclineFollowRequest(followerID, followedID int) error {
	query := `
		UPDATE followers 
		SET status = 'declined' 
		WHERE follower_id = ? AND followed_id = ?
	`
	_, err := ExecuteQuery(query, followerID, followedID)
	return err
}

// GetPendingFollowRequests returns all pending follow requests for a user
func GetPendingFollowRequests(userID int) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email 
		FROM users u
		JOIN followers f ON u.id = f.follower_id
		WHERE f.followed_id = ? AND f.status = 'pending'
	`
	return fetchUsers(query, userID)
}

// IsPendingFollowRequest checks if there is a pending follow request from followerID to followedID
func IsPendingFollowRequest(followerID, followedID int) (bool, error) {
	query := `SELECT COUNT(*) FROM followers WHERE follower_id = ? AND followed_id = ? AND status = 'pending'`
	rows, err := FetchData(query, followerID, followedID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	var count int
	if rows.Next() {
		if err := rows.Scan(&count); err != nil {
			return false, err
		}
	}
	return count > 0, nil
}
