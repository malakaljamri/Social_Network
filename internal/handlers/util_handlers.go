package handlers

import (
	"fmt"
	"regexp"
	"social_network/internal/models"
)

func PostValidation(post *models.Post) error {
	// Validate title
	if len(post.Title) < 3 || len(post.Title) > 100 {
		return fmt.Errorf("title must be between 3 and 100 characters")
	}
	// Validate content
	if len(post.Text) < 10 || len(post.Text) > 5000 {
		return fmt.Errorf("content must be between 10 and 5000 characters")
	}
	// Title character validation using more precise regex
	titleRegex := regexp.MustCompile(`^[a-zA-Z0-9\s!?.,'-]+$`)
	if !titleRegex.MatchString(post.Title) {
		return fmt.Errorf("title Contains Invalid Characters")
	}
	return nil
}
