package utils

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
)

func WriteJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func GenerateSessionToken() string {
	timePrefix := time.Now().Format("15-04-05-000")
	b := make([]byte, 32-len(timePrefix)-1)
	rand.Read(b)
	// return base64.URLEncoding.EncodeToString(b)
	token := base64.URLEncoding.EncodeToString(b) // Encode the random bytes to base64
	return timePrefix + "_" + token
}

// IsValidImageType checks if the given content type is a valid image type
func IsValidImageType(contentType string) bool {
	validTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/gif":  true,
	}
	return validTypes[contentType]
}

// WriteJSONResponse writes a JSON response with the given status code and data
func WriteJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}
