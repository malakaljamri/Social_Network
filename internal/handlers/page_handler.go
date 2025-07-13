package handlers

import (
	"html/template"
	"net/http"
	"social_network/internal/utils"
)

func CreatePostPageHandler(tmpl *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := tmpl.ExecuteTemplate(w, "create-post.html", nil)
		if err != nil {
			utils.WriteJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
}

// Unread group counts handler (stub)
func GetUnreadGroupCountsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{}`))
}
