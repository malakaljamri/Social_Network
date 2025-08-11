package handlers

import (
	"database/sql"
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
		utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Error fetching comments: %v", err))
		return
	}
	// log.Println(postID, "📝📝📝 comments", comments)
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

	// Get the current working directory (project root)
	currentDir, err := os.Getwd()
	if err != nil {
		log.Printf("DEBUG: Failed to get current working directory: %v", err)
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to determine project directory")
		return
	}
	log.Printf("DEBUG: Current working directory: %s", currentDir)

	// Construct the path to "web/uploads/userID" relative to the project root
	uploadDir := filepath.Join(currentDir, "web", "uploads", fmt.Sprintf("userID%d", userID))
	log.Printf("DEBUG: Upload directory path: %s", uploadDir)

	// Ensure the uploads directory exists
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		log.Printf("DEBUG: Creating upload directory: %s", uploadDir)
		err := os.MkdirAll(uploadDir, os.ModePerm)
		if err != nil {
			log.Printf("DEBUG: Failed to create upload directory: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create uploads directory")
			return
		}
		log.Printf("DEBUG: Successfully created upload directory")
	}

	// Handle the uploaded image file
	var imagePath string
	file, handler, err := r.FormFile("Image")
	if err == nil { // If an image is provided
		defer file.Close()
		log.Printf("DEBUG: Processing image upload - Filename: %s, Size: %d bytes", handler.Filename, handler.Size)

		// Save the file to the uploads folder
		uploadPath := filepath.Join(uploadDir, handler.Filename)
		log.Printf("DEBUG: Full upload path: %s", uploadPath)

		out, err := os.Create(uploadPath)
		if err != nil {
			log.Printf("DEBUG: Failed to create file: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to save image")
			return
		}
		defer out.Close()

		_, err = io.Copy(out, file)
		if err != nil {
			log.Printf("DEBUG: Failed to copy file content: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to save image")
			return
		}

		// Verify the file was actually created
		if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
			log.Printf("DEBUG: ERROR - File was not created at: %s", uploadPath)
		} else {
			log.Printf("DEBUG: SUCCESS - File created at: %s", uploadPath)
		}

		imagePath = fmt.Sprintf("/uploads/userID%d/%s", userID, handler.Filename) // Relative path for serving
		log.Printf("DEBUG: Database image path: %s", imagePath)
	} else {
		log.Printf("DEBUG: No image provided in form data: %v", err)
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
		UserID: userID,
	}

	if imagePath != "" {
		comment.Image = sql.NullString{String: imagePath, Valid: true}
	} else {
		comment.Image = sql.NullString{Valid: false}
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
