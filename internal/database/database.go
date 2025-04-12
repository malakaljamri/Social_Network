package database

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"social_network/internal/models"

	// Import SQLite driver
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

// Global database connection
var db *sql.DB

// InitializeDB initializes the database connection and creates tables if needed
func InitializeDB() (*sql.DB, error) {
	var err error
	dir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get current working directory: %v", err)
	}
	dbPath := filepath.Join(dir, "forum.db")
	if strings.HasSuffix(dir, "cmd") {
		dbPath = filepath.Join(dir, "..", "forum.db")
	}

	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	// Create tables in the database
	err = createTables()
	if err != nil {
		return nil, fmt.Errorf("failed to create tables: %v", err)
	}

	// Check if the database is empty
	isEmpty, err := isDatabaseEmpty()
	if err != nil {
		return nil, fmt.Errorf("failed to check if database is empty: %v", err)
	}

	// If the database is empty, generate fake data
	if isEmpty {
		GenerateFakeData()
	}

	return db, nil
}

// isDatabaseEmpty checks if the users table is empty
func isDatabaseEmpty() (bool, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return false, err
	}
	// log.Println("🎬 count:", count)
	return count == 0, nil
}

// createTables reads the schema_output.sql file and executes the queries to create tables
func createTables() error {
	// Check if tables exist
	var tableCount int
	err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'").Scan(&tableCount)
	if err != nil {
		return err
	}

	// If tables already exist, return without creating them
	if tableCount > 0 {
		return nil
	}
	// Get the directory of the current file
	_, currentFile, _, _ := runtime.Caller(0)
	dir := filepath.Dir(currentFile)

	// Read the schema_output.sql file containing table creation queries
	sqlFile, err := os.ReadFile(filepath.Join(dir, "schema_output.sql"))
	if err != nil {
		return fmt.Errorf("failed to read schema_output.sql file: %v", err)
	}

	// Split the SQL file content into individual queries
	queries := strings.Split(string(sqlFile), ";")

	// Execute each query
	for _, query := range queries {
		query = strings.TrimSpace(query)
		if query == "" {
			continue
		}
		_, err := db.Exec(query)
		if err != nil {
			return fmt.Errorf("failed to execute query: %v\nQuery: %s", err, query)
		}
	}

	return nil
}

// ExecuteQuery prepares and executes a SQL query with the given arguments
func ExecuteQuery(query string, args ...interface{}) (sql.Result, error) {
	stmt, err := db.Prepare(query)
	if (err != nil) {
		return nil, fmt.Errorf("failed to prepare query: %v", err)
	}
	defer stmt.Close()

	result, err := stmt.Exec(args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}

	return result, nil
}

// FetchData prepares and executes a SQL query, returning the resulting rows
// IDK why if running via launch.json returns the expected results, but running via go run returns unexpected results
func FetchData(query string, args ...interface{}) (*sql.Rows, error) {
	stmt, err := db.Prepare(query)
	if err != nil {
		log.Printf("\033[31m❌ query: %v\033[0m", stmt)
		log.Printf("❌ failed to prepare query: %v", err)
		return nil, fmt.Errorf("failed to prepare query: %v", err)
	}

	defer stmt.Close()

	rows, err := stmt.Query(args...)
	if err == nil {
		count := 0
		for rows.Next() {
			count++
		}
		rows.Close()
		// log.Printf("✅ query returned %d rows", count)
		rows, _ = stmt.Query(args...) // Reset rows cursor for actual use
	}
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	return rows, nil
}

// GenerateFakeData creates sample data for the forum
func GenerateFakeData() {
	// Set a random seed for generating data
	rand.Seed(time.Now().UnixNano())

	// Generate sample users
	users := []models.User{
		{Username: "john_doe", Email: "john_doe@gmail.com"},
		{Username: "jane_smith", Email: "jane_smith@gmail.com"},
		{Username: "mike_johnson", Email: "mike_johnson@gmail.com"},
		{Username: "emily_brown", Email: "emily_brown@gmail.com"},
		{Username: "chris_wilson", Email: "chris_wilson@gmail.com"},
	}

	// Create users with hashed passwords
	for i := range users {
		password, _ := bcrypt.GenerateFromPassword([]byte(users[i].Username), bcrypt.DefaultCost)
		users[i].Password = string(password)
		CreateUser(&users[i])
	}

	// Generate sample categories
	categories := []models.Category{
		{Name: "Technology"},
		{Name: "Sports"},
		{Name: "Movies"},
		{Name: "Food"},
		{Name: "Travel"},
	}

	// Create categories
	for i := range categories {
		CreateCategory(&categories[i])
	}

	// Generate sample posts
	posts := []models.Post{
		{UserID: users[0].ID, Title: "The Future of AI", Text: "Artificial Intelligence is rapidly evolving. In this post, we'll explore the potential impacts of AI on various industries and our daily lives."},
		{UserID: users[1].ID, Title: "Best Hiking Trails in the US", Text: "From the Appalachian Trail to the Pacific Crest Trail, the US offers some of the most breathtaking hiking experiences. Let's discuss the top trails and what makes them special."},
		{UserID: users[2].ID, Title: "Movie Review: Inception", Text: "Christopher Nolan's 'Inception' is a mind-bending masterpiece. In this review, we'll delve into the intricate plot, stunning visuals, and thought-provoking themes."},
		{UserID: users[3].ID, Title: "Easy Vegan Recipes for Beginners", Text: "Transitioning to a vegan diet? Here are five simple and delicious vegan recipes that anyone can make, complete with nutritional information and tips."},
		{UserID: users[4].ID, Title: "The Rise of Remote Work", Text: "The COVID-19 pandemic has accelerated the trend of remote work. We'll examine the pros and cons, and discuss how companies can adapt to this new normal."},
	}

	// Create posts
	for i := range posts {
		CreatePost(&posts[i])
	}

	// Generate post categories
	for _, post := range posts {
		numCategories := rand.Intn(3) + 1
		for i := 0; i < numCategories; i++ {
			category := categories[rand.Intn(len(categories))]
			_, err := ExecuteQuery("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", post.ID, category.ID)
			if err != nil {
				log.Printf("Error creating post_category: %v", err)
			}
		}
	}

	// Generate sample comments
	comments := []models.Comment{
		{PostID: posts[0].ID, UserID: users[1].ID, Text: "Great post! I'm particularly interested in how AI will impact healthcare. Any thoughts on that?"},
		{PostID: posts[0].ID, UserID: users[2].ID, Text: "I'm a bit concerned about the potential job displacement due to AI. How do you think we should address this?"},
		{PostID: posts[1].ID, UserID: users[3].ID, Text: "I've hiked part of the Appalachian Trail and it was amazing! Has anyone here done the Pacific Crest Trail?"},
		{PostID: posts[2].ID, UserID: users[4].ID, Text: "Inception is one of my all-time favorites! The ending still leaves me pondering every time I watch it."},
		{PostID: posts[3].ID, UserID: users[0].ID, Text: "Thanks for sharing these recipes! I've been trying to incorporate more plant-based meals into my diet."},
		{PostID: posts[4].ID, UserID: users[2].ID, Text: "As someone who's been working remotely for a year now, I can attest to both the benefits and challenges. Great analysis!"},
	}

	// Create comments
	for i := range comments {
		CreateComment(&comments[i])
	}

	// Generate sample likes/dislikes
	likesDislikes := []models.LikeDislike{
		{UserID: users[0].ID, PostID: posts[1].ID, IsLike: true},
		{UserID: users[1].ID, PostID: posts[0].ID, IsLike: true},
		{UserID: users[2].ID, PostID: posts[3].ID, IsLike: false},
		{UserID: users[3].ID, PostID: posts[2].ID, IsLike: true},
		{UserID: users[4].ID, PostID: posts[4].ID, IsLike: true},
	}

	// Create likes/dislikes
	for i := range likesDislikes {
		CreateLikeDislike(&likesDislikes[i])
	}

	fmt.Println("Realistic fake data generation complete")
}
