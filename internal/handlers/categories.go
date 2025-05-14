package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"strconv"
)

func GetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := database.GetCategories()
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching categories")
		return
	}
	json.NewEncoder(w).Encode(categories)
}

func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var category models.Category
	err := json.NewDecoder(r.Body).Decode(&category)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Add validation checks
	if len(category.Name) < 3 || len(category.Name) > 30 {
		utils.WriteJSONError(w, http.StatusBadRequest, "Category name must be between 3 and 30 characters")
		return
	}

	// Only allow alphanumeric characters and spaces
	match, _ := regexp.MatchString("^[a-zA-Z0-9 ]+$", category.Name)
	if !match {
		utils.WriteJSONError(w, http.StatusBadRequest, "Category name can only contain letters, numbers and spaces")
		return
	}

	err = database.CreateCategory(&category)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error creating category")
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(category)
}

func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	categoryIDStr := r.URL.Query().Get("id")
	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	err = database.DeleteCategory(categoryID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error deleting category")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Category deleted successfully"})
}
