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
	// Content length is validated by the frontend (max 90 characters)
	// Title character validation using more precise regex
	titleRegex := regexp.MustCompile(`^[a-zA-Z0-9\s!?.,'-]+$`)
	if !titleRegex.MatchString(post.Title) {
		return fmt.Errorf("title Contains Invalid Characters")
	}
	return nil
}
