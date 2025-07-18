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
	"social_network/internal/utils"
	"strconv"
	"strings"
)

func CreateGroupPostHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("📥 Received request at /api/groups/posts/create")

		userID, err := database.GetUserIDFromSession(r)
		if err != nil {
			log.Printf("❌ Failed to get user ID from session: %v", err)
			utils.WriteJSONError(w, http.StatusUnauthorized, "Failed to get user ID from session")
			return
		}

		// Parse multipart form data
		err = r.ParseMultipartForm(10 << 20) // 10 MB limit
		if err != nil {
			log.Printf("❌ Failed to parse form data: %v", err)
			utils.WriteJSONError(w, http.StatusBadRequest, "Failed to parse form data")
			return
		}

		// Extract form fields
		title := strings.TrimSpace(r.FormValue("title"))
		content := strings.TrimSpace(r.FormValue("content"))
		groupIDStr := r.FormValue("group_id")
		privacySetting := r.FormValue("privacy_setting")
		categoryIDStr := r.FormValue("category_id")

		// Validate required fields
		if title == "" || content == "" || groupIDStr == "" {
			utils.WriteJSONError(w, http.StatusBadRequest, "Title, content, and group_id are required")
			return
		}

		// Parse group ID
		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid group ID")
			return
		}

		// Parse category ID if provided
		var categoryID *int
		if categoryIDStr != "" {
			if catID, err := strconv.Atoi(categoryIDStr); err == nil {
				categoryID = &catID
			}
		}

		// Handle file upload
		var imagePath string
		file, handler, err := r.FormFile("image")
		if err == nil { // If an image is provided
			defer file.Close()

			// Determine upload directory
			executablePath, err := os.Executable()
			if err != nil {
				utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to determine executable path")
				return
			}
			rootDir := filepath.Dir(executablePath)
			uploadDir := filepath.Join(rootDir, "..", "web", "uploads", fmt.Sprintf("userID%d", userID))

			// Ensure uploads directory exists
			if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
				err := os.MkdirAll(uploadDir, os.ModePerm)
				if err != nil {
					utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to create uploads directory")
					return
				}
			}

			// Save the file
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
			imagePath = fmt.Sprintf("/uploads/userID%d/%s", userID, handler.Filename)
		}

		// Create group post object
		post := database.GroupPost{
			GroupID:        groupID,
			UserID:         userID,
			Title:          title,
			Content:        content,
			PrivacySetting: privacySetting,
			CategoryID:     categoryID,
			FilePath:       imagePath,
		}

		log.Printf("📦 Creating group post with data: %+v", post)

		err = database.CreateGroupPost(db, &post)
		if err != nil {
			log.Printf("❌ Failed to create group post: %v", err)
			utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create group post: %v", err))
			return
		}

		log.Println("✅ Group post created successfully")

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"post_id": post.ID,
		})
	}
}

func GetGroupPostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			http.Error(w, "Group ID is required", http.StatusBadRequest)
			return
		}

		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			http.Error(w, "Invalid group ID", http.StatusBadRequest)
			return
		}

		posts, err := database.GetGroupPosts(db, groupID)
		if err != nil {
			http.Error(w, "Failed to fetch group posts", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(posts)
	}
}
