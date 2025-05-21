package handlers

import (
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"social_network/internal/database"
	"social_network/internal/models"

	// "social_network/internal/websocket"
	"strconv"
	"strings"
)

func CreatePost(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	userID, errUserID := database.GetUserIDFromSession(r)
	if errUserID != nil {
		response := map[string]string{"error": "Failed to get user ID from session"}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}
	// Parse the multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	// Determine the root directory of the project
	executablePath, err := os.Executable() // Get the path of the running executable
	if err != nil {
		http.Error(w, "Failed to determine executable path", http.StatusInternalServerError)
		return
	}
	rootDir := filepath.Dir(executablePath) // Get the directory of the executable

	// Construct the path to "web/uploads" relative to the root directory
	uploadDir := filepath.Join(rootDir, "..", "web", "uploads", fmt.Sprintf("userID%d", userID)) // Go up one level, then to "web/uploads"

	// Ensure the uploads directory exists
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err := os.MkdirAll(uploadDir, os.ModePerm)
		if err != nil {
			http.Error(w, "Failed to create uploads directory", http.StatusInternalServerError)
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
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
		defer out.Close()
		_, err = io.Copy(out, file)
		if err != nil {
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
		imagePath = fmt.Sprintf("/uploads/userID%d/%s", userID, handler.Filename) // Relative path for serving
	}

	// Extract form fields
	title := strings.TrimSpace(r.FormValue("Title"))
	text := strings.TrimSpace(r.FormValue("Text"))
	categoryID, _ := strconv.Atoi(r.FormValue("CategoryID"))
	privacy := r.FormValue("Privacy")

	// Validate the fields
	if len(title) < 3 || len(title) > 100 {
		http.Error(w, "Title must be between 3 and 100 characters", http.StatusBadRequest)
		return
	}
	if len(text) < 10 || len(text) > 5000 {
		http.Error(w, "Content must be between 10 and 5000 characters", http.StatusBadRequest)
		return
	}

	// Create the post object
	post := models.Post{
		Title:      html.EscapeString(title),
		Text:       html.EscapeString(text),
		CategoryID: categoryID,
		UserID:     userID,
		Privacy:    privacy,
		Image:      imagePath,
	}
	// Validate the post using PostValidation
	err = PostValidation(&post)
	if err != nil {
		response := map[string]string{"error": fmt.Sprintf("Validation error: %v", err)}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}
	// Save the post to the database
	err = database.CreatePost(&post)
	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Error creating post", http.StatusInternalServerError)
		return
	}

	// Handle multiple categories (CategoryIDs)
	categoryIDsJSON := r.FormValue("CategoryIDs")
	if categoryIDsJSON != "" {
		var categoryIDs []int
		err := json.Unmarshal([]byte(categoryIDsJSON), &categoryIDs)
		if err != nil {
			log.Printf("Error parsing CategoryIDs: %v", err)
			http.Error(w, "Error processing categories", http.StatusBadRequest)
			return
		}
		for _, catID := range categoryIDs {
			err := database.AddPostCategory(post.ID, catID)
			if err != nil {
				log.Printf("Error adding post category: %v", err)
			}
		}
	}

	// If post is private, add chosen followers to post_viewers table
	if privacy == "private" {
		chosenFollowersJSON := r.FormValue("ChosenFollowers")
		if chosenFollowersJSON != "" {
			var chosenFollowers []interface{}
			if err := json.Unmarshal([]byte(chosenFollowersJSON), &chosenFollowers); err != nil {
				log.Printf("Error parsing chosen followers: %v", err)
				http.Error(w, "Error processing chosen followers", http.StatusInternalServerError)
				return
			}

			// Add each chosen follower to post_viewers
			for _, follower := range chosenFollowers {
				var followerID int
				switch v := follower.(type) {
				case float64:
					followerID = int(v)
				case string:
					var err error
					followerID, err = strconv.Atoi(v)
					if err != nil {
						log.Printf("Error converting follower ID to integer: %v", err)
						continue
					}
				default:
					log.Printf("Unexpected type for follower ID: %T", follower)
					continue
				}

				err := database.AddPostViewer(post.ID, followerID)
				if err != nil {
					log.Printf("Error adding post viewer: %v", err)
					http.Error(w, "Error setting up post viewers", http.StatusInternalServerError)
					return
				}
			}
		}
	}

	// Return success response
	response := map[string]interface{}{
		"status": "success",
		"post":   post,
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func GetPosts(w http.ResponseWriter, r *http.Request) {
	// log.Println("Original GetPosts called")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	// log.Println("📃📃📃📃page:", page)

	// posts, totalCount, err := database.GetPosts(page, limit)
	posts, totalCount, err := database.GetFilteredPosts(page, limit, nil, r)
	if err != nil {
		http.Error(w, "❌ Error fetching posts", http.StatusInternalServerError)
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
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	post, err := database.GetPostByID(postID)
	if err != nil {
		http.Error(w, "Error fetching post", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(post)
}

func DeletePost(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.URL.Query().Get("id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	err = database.DeletePost(postID)
	if err != nil {
		http.Error(w, "Error deleting post", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post deleted successfully"})
}

func ServePostPage(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles("web/templates/post.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
	log.Println("GetPostsHandler called")
	filtersJSON := r.URL.Query().Get("filters")
	log.Printf("Received filters: %s", filtersJSON)

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	log.Printf("Page: %d, Limit: %d", page, limit)

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	var filters map[string]interface{}
	err := json.Unmarshal([]byte(filtersJSON), &filters)
	if err != nil {
		log.Printf("Error unmarshaling filters: %v", err)
		http.Error(w, "Invalid filters", http.StatusBadRequest)
		return
	}
	log.Printf("Parsed filters: %+v", filters)

	posts, totalCount, err := database.GetFilteredPosts(page, limit, filters, r)
	if err != nil {
		log.Printf("Error getting filtered posts: %v", err)
		http.Error(w, fmt.Sprintf("GetFilteredPosts issue: %v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Retrieved %d posts out of %d total", len(posts), totalCount)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Total-Count", strconv.Itoa(totalCount))

	err = json.NewEncoder(w).Encode(posts)
	if err != nil {
		log.Printf("Error encoding posts to JSON: %v", err)
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
	log.Println("Response sent successfully")
}
func GetOldestPostDate(w http.ResponseWriter, r *http.Request) {
	date, err := database.GetOldestPostDate()
	if err != nil {
		http.Error(w, "Error fetching oldest post date", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(date)
}

func GetNewestPostDate(w http.ResponseWriter, r *http.Request) {
	date, err := database.GetNewestPostDate()
	if err != nil {
		http.Error(w, "Error fetching newest post date", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(date)
}

/*func SendPostsViaWebSocket(client *websocket.Client) {
	posts, _, err := database.GetPosts(1, 10) // Get the first 10 posts
	if err != nil {
		log.Printf("❌ Error fetching posts: %v", err)
		return
	}

	message := websocket.Message{
		Type:    "posts",
		Content: posts,
	}

	client.Send <- messageToJSON(message)
}*/
