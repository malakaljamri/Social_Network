package database

import (
	"log"
)

// ApplyMigrations applies any pending database migrations
func ApplyMigrations() error {
	log.Println("Checking and applying database migrations...")
	
	// Check if is_private column exists in users table
	rows, err := db.Query("PRAGMA table_info(users)")
	if err != nil {
		return err
	}
	defer rows.Close()
	
	hasPrivateField := false
	hasProfilePrivacy := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, dataType string
		var dfltValue interface{}
		if err := rows.Scan(&cid, &name, &dataType, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "is_private" {
			hasPrivateField = true
		}
		if name == "profile_privacy" {
			hasProfilePrivacy = true
		}
	}
	
	// Add is_private column if it doesn't exist
	if !hasPrivateField {
		log.Println("Adding is_private column to users table...")
		_, err = db.Exec("ALTER TABLE users ADD COLUMN is_private BOOLEAN DEFAULT FALSE")
		if err != nil {
			return err
		}
		log.Println("is_private column added successfully")
		
		// If profile_privacy exists, update is_private based on it
		if hasProfilePrivacy {
			log.Println("Updating is_private based on existing profile_privacy values...")
			_, err = db.Exec("UPDATE users SET is_private = (profile_privacy = 'private')")
			if err != nil {
				return err
			}
			log.Println("Privacy settings synchronized successfully")
		}
		
		log.Println("Migration applied successfully")
	} else {
		log.Println("No migrations needed for is_private column")
	}
	
	return nil
}
