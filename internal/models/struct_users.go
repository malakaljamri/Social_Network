package models

import "time"

type User struct {
	ID        int
	Username  string
	BirthDate time.Time
	Gender    string
	FirstName string
	LastName  string
	Email     string
	Password  string
	LastMessageTime string
	Online    bool
}

type Session struct {
	ID        int
	UserID    int
	Token     string
	ExpiresAt time.Time
}
