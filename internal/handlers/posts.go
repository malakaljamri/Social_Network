package handlers

import (
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"log"
	"net/http"
	"regexp"
	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/websocket"
	"strconv"
	"strings"
)

func CreatePost(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	var post models.Post
	err := json.NewDecoder(r.Body).Decode(&post)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Trim whitespace from title and content
	post.Title = strings.TrimSpace(post.Title)
	post.Text = strings.TrimSpace(post.Text)

	// Enhanced validation
	if err := PostValidation(&post); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Sanitize the input
	post.Title = html.EscapeString(post.Title)
	post.Text = html.EscapeString(post.Text)

	// Create post in database
	err = database.CreatePost(&post)
	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Error creating post", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := map[string]interface{}{
		"status": "success",
		"post":   post,
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

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

func GetPosts(w http.ResponseWriter, r *http.Request) {
	log.Println("Original GetPosts called")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	// log.Println("📃📃📃📃page:", page)

	posts, totalCount, err := database.GetPosts(page, limit)
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

func SendPostsViaWebSocket(client *websocket.Client) {
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
}
