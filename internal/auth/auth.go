package auth

import (
	"encoding/json"
	"fmt"
	"image"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"

	// "log"
	"net/http"
	"time"

	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandlers struct {
	hub *websocket.Hub
}

// Create a constructor
func NewAuthHandlers(hub *websocket.Hub) *AuthHandlers {
	return &AuthHandlers{hub: hub}
}

// Helper to write JSON error
func writeJSONError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// RegisterHandler handles user registration
func (h *AuthHandlers) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 10MB)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		writeJSONError(w, "Error parsing form", http.StatusBadRequest)
		return
	}
	form := r.MultipartForm
	get := func(key string) string {
		if vs, ok := form.Value[key]; ok && len(vs) > 0 {
			return vs[0]
		}
		return ""
	}
	var user models.User
	user.Username = get("username")
	user.Email = get("email")
	user.Password = get("password")
	user.FirstName = get("firstName")
	user.LastName = get("lastName")
	user.Gender = get("gender")
	user.AboutMe = get("aboutMe")
	birthDateStr := get("birthDate")

	// If username is empty, generate a unique one from first and last name
	if user.Username == "" {
		user.Username = database.GenerateUniqueUsername(user.FirstName, user.LastName)
	}

	if birthDateStr != "" {
		var t time.Time
		var err error
		if len(birthDateStr) > 10 {
			t, err = time.Parse(time.RFC3339, birthDateStr)
		} else {
			t, err = time.Parse("2006-01-02", birthDateStr)
		}
		if err != nil {
			writeJSONError(w, "Invalid birthDate format. Use YYYY-MM-DD or ISO format.", http.StatusBadRequest)
			return
		}
		user.BirthDate = t
	}

	// Validate required fields
	if user.Email == "" || user.Password == "" || user.FirstName == "" || user.LastName == "" || user.Gender == "" {
		writeJSONError(w, "Email, Password, First Name, Last Name, and Gender are required", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSONError(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	user.Password = string(hashedPassword)

	// Create the user in the database (ID will be set)
	err = database.CreateUser(&user)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Handle avatar file if present
	avatarPath := ""
	files := form.File["avatar"]
	if len(files) > 0 {
		fileHeader := files[0]
		if fileHeader.Size > 2*1024*1024 {
			writeJSONError(w, "Avatar image size must not exceed 2MB", http.StatusBadRequest)
			return
		}
		file, err := fileHeader.Open()
		if err != nil {
			writeJSONError(w, "Error opening avatar file", http.StatusBadRequest)
			return
		}
		defer file.Close()
		// Validate file type
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		contentType := http.DetectContentType(buf[:n])
		if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" {
			writeJSONError(w, "Invalid avatar file type. Only JPEG, PNG, and GIF are allowed.", http.StatusBadRequest)
			return
		}
		// Reset file pointer
		file.Seek(0, 0)
		// Validate dimensions
		img, _, err := image.DecodeConfig(file)
		if err != nil {
			writeJSONError(w, "Invalid image file", http.StatusBadRequest)
			log.Printf("🧑 avatar: %s", err)
			return
		}
		if img.Width > 2048 || img.Height > 2048 {
			writeJSONError(w, "Avatar image dimensions must not exceed 2048x2048px", http.StatusBadRequest)
			return
		}
		file.Seek(0, 0)
		// Get project root using runtime.Caller (like database.go)
		_, currentFile, _, _ := runtime.Caller(0)
		projectRoot := filepath.Join(filepath.Dir(currentFile), "..", "..")
		avatarDir := filepath.Join(projectRoot, "web", "uploads", fmt.Sprintf("userID%d", user.ID), "avatar")
		if err := os.MkdirAll(avatarDir, 0755); err != nil {
			writeJSONError(w, "Error creating avatar directory", http.StatusInternalServerError)
			return
		}
		avatarPath = filepath.Join(avatarDir, fileHeader.Filename)
		out, err := os.Create(avatarPath)
		if err != nil {
			writeJSONError(w, "Error saving avatar file", http.StatusInternalServerError)
			return
		}
		defer out.Close()
		if _, err := io.Copy(out, file); err != nil {
			writeJSONError(w, "Error saving avatar file", http.StatusInternalServerError)
			return
		}
		// Store relative path for DB/web
		relPath := fmt.Sprintf("userID%d/avatar/%s", user.ID, fileHeader.Filename)
		// Update user avatar in DB
		err = database.UpdateUserAvatar(user.ID, relPath)
		if err != nil {
			writeJSONError(w, "Error updating user avatar", http.StatusInternalServerError)
			return
		}
		avatarPath = relPath
	}

	if err := createSession(w, user, h); err != nil {
		writeJSONError(w, "Failed to create session after registration", http.StatusInternalServerError)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":  "User registered and logged in successfully",
		"username": user.Username,
		"avatar":   avatarPath,
		"user_id":  user.ID,
		"id":       user.ID, // Add both for compatibility
	})
}

func (h *AuthHandlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var loginData struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&loginData)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	// Validate input
	if loginData.Identifier == "" || loginData.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Email/username and password are required",
		})
		return
	}

	user, err := database.GetUserByEmailOrNickname(loginData.Identifier)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid credentials.",
			"error":   err.Error(),
		})
		return
	}

	// Compare the provided password with the stored hashed password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginData.Password))
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid credentials.",
			"error":   err.Error(),
		})
		return
	}

	// Create session and handle any errors
	if err := createSession(w, user, h); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Failed to create session",
			"error":   err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"message":  "Logged in successfully",
		"username": user.Username,
		"user_id":  user.ID,
		"id":       user.ID, // Add both for compatibility
	})
}

func createSession(w http.ResponseWriter, user models.User, h *AuthHandlers) error {
	// Delete existing sessions for this user
	err := database.DeleteSessionsByUserID(user.ID)
	if err != nil {
		return fmt.Errorf("error managing sessions: %v", err)
	}

	// Generate a new session token
	sessionToken := utils.GenerateSessionToken()
	// sessionToken := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create a new session
	session := models.Session{
		UserID:    user.ID,
		Token:     sessionToken,
		ExpiresAt: expiresAt,
	}

	// Store the session in the database
	err = database.CreateSession(&session)
	if err != nil {
		return fmt.Errorf("error creating session: %v", err)
	}

	// Set the session token as a cookie
	http.SetCookie(w, &http.Cookie{
		Name:       "session_token",
		Value:      sessionToken,
		Path:       "/",
		Domain:     "",
		Expires:    expiresAt,
		RawExpires: "",
		MaxAge:     int(24 * time.Hour.Seconds()), // Set MaxAge in seconds (24 hours)
		Secure:     false,                         // Set to false for local development (no HTTPS)
		HttpOnly:   true,
		SameSite:   http.SameSiteLaxMode, // Changed from StrictMode to LaxMode for better browser compatibility
		Raw:        "",
		Unparsed:   []string{},
	})

	// First set the user status (no go routine)
	go websocket.UpdateUserStatus(h.hub, user.ID, true)

	// Then broadcast to everyone, including the current user (no go routine)
	go func() {
		message := websocket.Message{
			Type: "user_status",
			Content: map[string]interface{}{
				"user_id":  user.ID,
				"username": user.Username,
				"status":   "online",
			},
		}
		jsonMessage, _ := json.Marshal(message)
		h.hub.Broadcast <- jsonMessage
	}()

	return nil
}

func (h *AuthHandlers) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Get the session token from the cookie
	c, err := r.Cookie("session_token")
	if err != nil {
		if err == http.ErrNoCookie {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "No active session",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	sessionToken := c.Value

	// Get the session from the database
	session, err := database.GetSessionByToken(sessionToken)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Error retrieving session",
		})
		return
	}

	// Get the user from the database
	user, err := database.GetUserByID(session.UserID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Error retrieving user",
		})
		return
	}

	// Delete the session from the database
	err = database.DeleteSession(sessionToken)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Error deleting session",
		})
		return
	}

	// Clear the session cookie - match the login cookie settings
	http.SetCookie(w, &http.Cookie{
		Name:       "session_token",
		Value:      "",
		Path:       "/",
		Domain:     "",
		Expires:    time.Now().Add(-1 * time.Hour), // Set to past time to expire immediately
		RawExpires: "",
		MaxAge:     -1,    // Delete immediately
		Secure:     false, // Match login setting for HTTP
		HttpOnly:   true,
		SameSite:   http.SameSiteLaxMode, // Match login setting
		Raw:        "",
		Unparsed:   []string{},
	})

	// Send a success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	})
	go func() {
		message := websocket.Message{
			Type: "user_status",
			Content: map[string]interface{}{
				"user_id":  session.UserID,
				"username": user.Username,
				"status":   "offline",
			},
		}
		jsonMessage, _ := json.Marshal(message)
		h.hub.Broadcast <- jsonMessage
	}()
	go websocket.UpdateUserStatus(h.hub, user.ID, false)
	// go websocket.Print_userIDs("LogoutHandler")
}

func (h *AuthHandlers) UserStatusHandler(w http.ResponseWriter, r *http.Request) { // called from main.go
	// w.Header().Set("Content-Type", "application/json")
	session, err := GetSessionFromRequest(r)
	if err != nil { // w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"loggedIn": false, "session": nil,
		})
		return
	}
	// log.Println("🪑 session", session)

	user, err := database.GetUserByID(session.UserID)
	if err != nil { // w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"loggedIn": false, "user": nil,
		})
		return
	}

	// log.Println("👤 user", user)
	// w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loggedIn": true,
		"username": user.Username,
		"userID":   user.ID,
	})

	websocket.UpdateUserStatus(h.hub, user.ID, true)
}

func GetSessionFromRequest(r *http.Request) (models.Session, error) {
	// Get the session token from the cookie
	c, err := r.Cookie("session_token")
	if err != nil {
		return models.Session{}, err
	}
	sessionToken := c.Value

	// Get the session from the database
	session, err := database.GetSessionByToken(sessionToken)
	if err != nil {
		return models.Session{}, err
	}

	// Check if the session has expired
	if time.Now().After(session.ExpiresAt) {
		database.DeleteSession(sessionToken)
		return models.Session{}, fmt.Errorf("session expired, client: 💻 %s", r.RemoteAddr)
	}

	return session, nil
}
