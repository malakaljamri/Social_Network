package models

// UserProfile combines user information with follower and following counts
type UserProfile struct {
	User           User   `json:"user"`
	FollowersCount int    `json:"followers_count"`
	FollowingCount int    `json:"following_count"`
	PostsCount     int    `json:"posts_count"`
	IsFollowing    bool   `json:"is_following,omitempty"`
}

// FollowRequest represents a follow/unfollow request
type FollowRequest struct {
	UserID int `json:"user_id"`
}
