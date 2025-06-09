package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"strconv"
)

func GetComments(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.URL.Query().Get("post_id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid post ID")
		return
	}

	comments, err := database.GetCommentsByPostID(postID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching comments")
		return
	}
	log.Println(postID,"📝📝📝 comments", comments)
	json.NewEncoder(w).Encode(comments)
}

func CreateComment(w http.ResponseWriter, r *http.Request) {
	userID, err := database.GetUserIDFromSession(r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusUnauthorized, "You must be logged in to post a comment")
		return
	}

	// Parse the multipart form
	err = r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	// Determine the root directory of the project
	executablePath, err := os.Executable() // Get the path of the running executable
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to determine executable path")
		return
	}
	rootDir := filepath.Dir(executablePath) // Get the directory of the executable

	// Construct the path to "web/uploads" relative to the root directory
	uploadDir := filepath.Join(rootDir, "..", "web", "uploads", fmt.Sprintf("userID%d", userID)) // Go up one level, then to "web/uploads"

	// Ensure the uploads directory exists
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err := os.MkdirAll(uploadDir, os.ModePerm)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create uploads directory")
			return
		}
	}

	// Handle the uploaded image file
	var imagePath string
	file, handler, err := r.FormFile("Image")
	if err == nil { // If an image is provided
		defer file.Close()
		// Save the file to the uploads folder
		uploadPath := filepath.Join(uploadDir, handler.Filename)
		out, err := os.Create(uploadPath)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to save image")
			return
		}
		defer out.Close()
		_, err = io.Copy(out, file)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to save image")
			return
		}
		imagePath = fmt.Sprintf("/uploads/userID%d/%s", userID, handler.Filename) // Relative path for serving
	}

	// // Decode the comment JSON body
	// var comment models.Comment
	// err = json.NewDecoder(r.Body).Decode(&comment)
	// if err != nil {
	// 	http.Error(w, err.Error(), http.StatusBadRequest)
	// 	return
	// }
	postID, err := strconv.Atoi(r.FormValue("PostID"))
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid PostID")
		return
	}
	comment := models.Comment{
		Text:   r.FormValue("Text"),
		PostID: postID,
		Image:  imagePath,
		UserID: userID,
	}

	err = database.CreateComment(&comment)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error creating comment")
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

func DeleteComment(w http.ResponseWriter, r *http.Request) {
	commentIDStr := r.URL.Query().Get("id")
	commentID, err := strconv.Atoi(commentIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid comment ID")
		return
	}

	err = database.DeleteComment(commentID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error deleting comment")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Comment deleted successfully"})
}
