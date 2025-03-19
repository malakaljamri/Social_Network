package utils

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
)

func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func GenerateSessionToken() string {
	timePrefix := time.Now().Format("15-04-05-000")
	b := make([]byte, 32-len(timePrefix)-1)
	rand.Read(b)
	// return base64.URLEncoding.EncodeToString(b)
	token := base64.URLEncoding.EncodeToString(b) // Encode the random bytes to base64
	return timePrefix + "_" + token
}
