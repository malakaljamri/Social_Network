package models

import (
	"database/sql"
	"time"
)

type Post struct {
	ID         int
	UserID     int
	Title      string
	Text       string
	CreatedAt  time.Time
	Author     string
	Categories []int
	Likes      int
	Dislikes   int
	Privacy    string
	Image      string
	GroupID    *int
}

type Comment struct {
	ID        int
	PostID    int
	UserID    int
	Text      string
	CreatedAt time.Time
	Author    string
	Image     sql.NullString
}

type ChatMessage struct {
	SenderID   int       `json:"sender_id"`
	ReceiverID int       `json:"Receiver_id"`
	Content    string    `json:"content"`
	Timestamp  time.Time `json:"timestamp"`
	IsRead     int       `json:"is_read"` // 0 = unread, 1 = read
}

type Category struct {
	ID        int
	Name      string
	PostCount int `json:"PostCount"`
}

type LikeDislike struct {
	ID        int  `json:"ID"`
	UserID    int  `json:"UserID"`
	PostID    int  `json:"PostID"`
	CommentID int  `json:"CommentID"`
	IsLike    bool `json:"IsLike"`
}

type GroupChatMessage struct {
	GroupID        int       `json:"group_id"`
	SenderID       int       `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	SenderAvatar   string    `json:"sender_avatar"`
	Content        string    `json:"content"`
	Timestamp      time.Time `json:"timestamp"`
}
