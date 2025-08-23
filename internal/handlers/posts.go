package handlers

import (
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"

	// "social_network/internal/websocket"
	"strconv"
	"strings"
)

func CreatePost(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	userID, errUserID := database.GetUserIDFromSession(r)
	if errUserID != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to get user ID from session")
		return
	}
	// Parse the multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	// Get the current working directory (project root)
	currentDir, err := os.Getwd()
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to determine project directory")
		return
	}

	// Construct the path to "web/uploads/userID" relative to the project root
	uploadDir := filepath.Join(currentDir, "web", "uploads", fmt.Sprintf("userID%d", userID))

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

		// Verify the file was actually created
		_, _ = os.Stat(uploadPath) // Check if file was created

		imagePath = fmt.Sprintf("/uploads/userID%d/%s", userID, handler.Filename) // Relative path for serving
	} else {
		// No image provided
	}

	// Extract form fields
	title := strings.TrimSpace(r.FormValue("Title"))
	text := strings.TrimSpace(r.FormValue("Text"))
	var categoryIDs []int
	categoryIDsStr := r.FormValue("CategoryIDs")
	if categoryIDsStr != "" {
		err = json.Unmarshal([]byte(categoryIDsStr), &categoryIDs)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid CategoryIDs format")
			return
		}
	}
	privacy := r.FormValue("Privacy")

	// Handle group ID for group posts
	var groupID *int
	groupIDStr := r.FormValue("GroupID")
	if groupIDStr != "" {
		groupIDInt, err := strconv.Atoi(groupIDStr)
		if err != nil {
			utils.WriteJSONError(w, http.StatusBadRequest, "Invalid GroupID format")
			return
		}
		groupID = &groupIDInt
	}

	// Create the post object
	post := models.Post{
		Title:      html.EscapeString(title),
		Text:       html.EscapeString(text),
		Categories: categoryIDs,
		UserID:     userID,
		Privacy:    privacy,
		Image:      imagePath,
		GroupID:    groupID,
	}
	// Validate the post using PostValidation
	err = PostValidation(&post)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, fmt.Sprintf("Validation error: %v", err))
		return
	}
	// Save the post to the database
	err = database.CreatePost(&post)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error creating post")
		return
	}

	// Broadcast new post via WebSocket for real-time updates
	websocket.BroadcastNewPost(websocket.MainHub, &post, userID)

	// Return success response
	response := map[string]interface{}{
		"status": "success",
		"post":   post,
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func GetPosts(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	posts, totalCount, err := database.GetFilteredPosts(page, limit, nil, r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "❌ Error fetching posts")
		return
	}

	totalPages := (totalCount + limit - 1) / limit

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Total-Pages", strconv.Itoa(totalPages))
	json.NewEncoder(w).Encode(posts)
}

func GetPostByID(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.URL.Query().Get("id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid post ID")
		return
	}

	post, err := database.GetPostByID(postID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching post")
		return
	}
	json.NewEncoder(w).Encode(post)
}

func DeletePost(w http.ResponseWriter, r *http.Request) {
	userID, errUserID := database.GetUserIDFromSession(r)
	if errUserID != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Failed to get user ID from session")
		return
	}

	postIDStr := r.URL.Query().Get("id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid post ID")
		return
	}

	err = database.DeletePost(postID)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error deleting post")
		return
	}

	// Broadcast post deletion via WebSocket for real-time updates
	websocket.BroadcastPostDeleted(websocket.MainHub, postID, userID)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post deleted successfully"})
}

func ServePostPage(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles("web/templates/post.html")
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	tmpl.Execute(w, nil)
}

func PostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Accept") == "application/json" {
		GetPostByID(w, r)
	} else {
		ServePostPage(w, r)
	}
}

// Side bar filters
func GetPostsHandler(w http.ResponseWriter, r *http.Request) {
	filtersJSON := r.URL.Query().Get("filters")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	var filters map[string]interface{}
	err := json.Unmarshal([]byte(filtersJSON), &filters)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid filters")
		return
	}

	posts, totalCount, err := database.GetFilteredPosts(page, limit, filters, r)
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("GetFilteredPosts issue: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Total-Count", strconv.Itoa(totalCount))
	totalPages := (totalCount + limit - 1) / limit
	json.NewEncoder(w).Encode(map[string]interface{}{
		"posts":        posts,
		"totalPages":   totalPages,
		"totalResults": totalCount,
	})
}

func GetOldestPostDate(w http.ResponseWriter, r *http.Request) {
	date, err := database.GetOldestPostDate()
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching oldest post date")
		return
	}
	json.NewEncoder(w).Encode(date)
}

func GetNewestPostDate(w http.ResponseWriter, r *http.Request) {
	date, err := database.GetNewestPostDate()
	if err != nil {
		utils.WriteJSONError(w, http.StatusInternalServerError, "Error fetching newest post date")
		return
	}
	json.NewEncoder(w).Encode(date)
}

/*func SendPostsViaWebSocket(client *websocket.Client) {
	posts, _, err := database.GetPosts(1, 10) // Get the first 10 posts
	if err != nil {
		return
	}

	message := websocket.Message{
		Type:    "posts",
		Content: posts,
	}

	client.Send <- messageToJSON(message)
}*/

// PostLikeDislikeRouter routes to like or dislike based on the URL path
func PostLikeDislikeRouter(w http.ResponseWriter, r *http.Request) {
	// Path: /api/posts/{id}/like or /api/posts/{id}/dislike
	path := r.URL.Path
	// Remove prefix
	prefix := "/api/posts/"
	if !strings.HasPrefix(path, prefix) {
		utils.WriteJSONError(w, http.StatusNotFound, "Invalid path")
		return
	}
	rest := path[len(prefix):] // e.g. 123/like
	parts := strings.Split(rest, "/")
	if len(parts) != 2 {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid path format")
		return
	}
	postIDStr, action := parts[0], parts[1]
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteJSONError(w, http.StatusBadRequest, "Invalid post ID")
		return
	}
	// Prepare a fake request body with post ID
	r.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"PostID":%d}`, postID)))
	r.Header.Set("Content-Type", "application/json")
	switch action {
	case "like":
		LikePost(w, r)
	case "dislike":
		DislikePost(w, r)
	default:
		utils.WriteJSONError(w, http.StatusNotFound, "Unknown action")
	}
}
