package handlers

import (
	"encoding/json"
	"net/http"
	"social_network/internal/database"
	"social_network/internal/models"
)

func LikePost(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "You must be logged in to like a post", http.StatusUnauthorized)
		return
	}

	var likeDislike models.LikeDislike
	err = json.NewDecoder(r.Body).Decode(&likeDislike)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	likeDislike.UserID = userID
	likeDislike.IsLike = true

	created, err := database.CreateLikeDislike(&likeDislike)
	if err != nil {
		http.Error(w, "Error processing like/dislike", http.StatusInternalServerError)
		return
	}

	// Get updated like/dislike counts
	// likes, dislikes, err := database.GetLikeDislikeCounts(likeDislike.PostID, 0)
	// if err != nil {
	// 	http.Error(w, "Error getting like/dislike counts", http.StatusInternalServerError)
	// 	return
	// }

	response := struct {
		LikeDislike models.LikeDislike `json:"likeDislike"`
		Likes       int                `json:"likes"`
		Dislikes    int                `json:"dislikes"`
		Created     bool               `json:"created"`
	}{
		LikeDislike: likeDislike,
		// Likes:       likes,
		// Dislikes:    dislikes,
		Created: created,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func DislikePost(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "You must be logged in to dislike a post", http.StatusUnauthorized)
		return
	}

	var likeDislike models.LikeDislike
	err = json.NewDecoder(r.Body).Decode(&likeDislike)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	likeDislike.UserID = userID
	likeDislike.IsLike = false

	created, err := database.CreateLikeDislike(&likeDislike)
	if err != nil {
		http.Error(w, "Error processing like/dislike", http.StatusInternalServerError)
		return
	}

	// Get updated like/dislike counts
	// likes, dislikes, err := database.GetLikeDislikeCounts(likeDislike.PostID, 0)
	// if err != nil {
	// 	http.Error(w, "Error getting like/dislike counts", http.StatusInternalServerError)
	// 	return
	// }

	response := struct {
		LikeDislike models.LikeDislike `json:"likeDislike"`
		Likes       int                `json:"likes"`
		Dislikes    int                `json:"dislikes"`
		Created     bool               `json:"created"`
	}{
		LikeDislike: likeDislike,
		// Likes:       likes,
		// Dislikes:    dislikes,
		Created: created,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
