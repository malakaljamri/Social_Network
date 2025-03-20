package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"social_network/internal/database"
	"social_network/internal/models"
	"strconv"
)

func GetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := database.GetCategories()
	if err != nil {
		http.Error(w, "Error fetching categories", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(categories)
}

func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var category models.Category
	err := json.NewDecoder(r.Body).Decode(&category)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Add validation checks
	if len(category.Name) < 3 || len(category.Name) > 30 {
		http.Error(w, "Category name must be between 3 and 30 characters", http.StatusBadRequest)
		return
	}

	// Only allow alphanumeric characters and spaces
	match, _ := regexp.MatchString("^[a-zA-Z0-9 ]+$", category.Name)
	if !match {
		http.Error(w, "Category name can only contain letters, numbers and spaces", http.StatusBadRequest)
		return
	}

	err = database.CreateCategory(&category)
	if err != nil {
		http.Error(w, "Error creating category", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(category)
}

func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	categoryIDStr := r.URL.Query().Get("id")
	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	err = database.DeleteCategory(categoryID)
	if err != nil {
		http.Error(w, "Error deleting category", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Category deleted successfully"})
}
