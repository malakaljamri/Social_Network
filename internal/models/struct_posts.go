package models

import "time"

type Post struct {
	ID         int
	UserID     int
	Title      string
	Text       string
	CategoryID int
	CreatedAt  time.Time
	Author	   string
	Categories []int
	Likes      int
	Dislikes   int
	Privacy	   string
}

type Comment struct {
	ID     int
	PostID int
	UserID int
	Text   string
	CreatedAt time.Time
	Author string
}

type ChatMessage struct {
	SenderID   int       `json:"sender_id"`
	ReceiverID int       `json:"Receiver_id"`
	Content    string    `json:"content"`
	Timestamp  time.Time `json:"timestamp"`
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
