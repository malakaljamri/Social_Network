package auth

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"social_network/internal/database"
	"social_network/internal/models"
	"social_network/internal/utils"
	"social_network/internal/websocket"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandlers struct {
	hub *websocket.Hub
}

// Create a constructor
func NewAuthHandlers(hub *websocket.Hub) *AuthHandlers {
	return &AuthHandlers{hub: hub}
}

// RegisterHandler handles user registration
func (h *AuthHandlers) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if user.Username == "" || /* user.BirthDate == (time.Time{}) ||*/ user.Gender == "" || user.FirstName == "" || user.LastName == "" || user.Email == "" || user.Password == "" {
		http.Error(w, "All fields are required", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	user.Password = string(hashedPassword)

	// Create the user in the database
	err = database.CreateUser(&user)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"error":   err.Error(),
			"message": "Error creating user",
		})
		return
	}

	createSession(w, user, h)

	// Send success response
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":  "User registered and logged in successfully",
		"username": user.Username,
	})
}

func (h *AuthHandlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var loginData struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&loginData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := database.GetUserByEmailOrNickname(loginData.Identifier)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid credentials.",
			"error":   err.Error(),
		})
		return
	}

	// Compare the provided password with the stored hashed password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginData.Password))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid credentials.",
			"error":   err.Error(),
		})
		return
	}

	createSession(w, user, h)
	w.WriteHeader(http.StatusOK) // Send response last
	json.NewEncoder(w).Encode(map[string]any{
		"message":  "Logged in successfully",
		"username": user.Username,
		"user_id":  user.ID,
	})
}

func createSession(w http.ResponseWriter, user models.User, h *AuthHandlers) {
	// Delete existing sessions for this user
	err := database.DeleteSessionsByUserID(user.ID)
	if err != nil {
		http.Error(w, "Error managing sessions", http.StatusInternalServerError)
		return
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
		http.Error(w, "Error creating session", http.StatusInternalServerError)
		return
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
		Secure:     false, // Set to false for local development (no HTTPS)
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

	// Clear the session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Expires:  time.Now(),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
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
	go websocket.Print_userIDs("LogoutHandler")
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
	log.Println("🪑 session", session)

	user, err := database.GetUserByID(session.UserID)
	if err != nil { // w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"loggedIn": false, "user": nil,
		})
		return
	}

	log.Println("👤 user", user)
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
