package database

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// MigrationManager handles database migrations
type MigrationManager struct {
	db       *sql.DB
	migrator *migrate.Migrate
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *sql.DB) (*MigrationManager, error) {
	// Get the directory of the current file
	_, currentFile, _, _ := runtime.Caller(0)
	dir := filepath.Dir(currentFile)

	// Path to migrations folder
	migrationsPath := filepath.Join(dir, "migrations", "sqlite")

	// Convert to file:// URL format - handle Windows paths correctly
	// Convert backslashes to forward slashes for URL compatibility
	migrationsPath = strings.ReplaceAll(migrationsPath, "\\", "/")
	migrationsURL := fmt.Sprintf("file://%s", migrationsPath)

	log.Printf("Migration source: %s", migrationsURL)

	// Create SQLite driver instance
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to create sqlite driver: %v", err)
	}

	// Create migrator instance
	migrator, err := migrate.NewWithDatabaseInstance(migrationsURL, "sqlite3", driver)
	if err != nil {
		return nil, fmt.Errorf("failed to create migrator: %v", err)
	}

	return &MigrationManager{
		db:       db,
		migrator: migrator,
	}, nil
}

// RunMigrations runs all pending migrations
func (mm *MigrationManager) RunMigrations() error {
	log.Println("Running database migrations...")

	err := mm.migrator.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %v", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("No pending migrations")
	} else {
		log.Println("Migrations completed successfully")
	}

	return nil
}

// RollbackLastMigration rolls back the last migration
func (mm *MigrationManager) RollbackLastMigration() error {
	log.Println("Rolling back last migration...")

	if err := mm.migrator.Down(); err != nil {
		return fmt.Errorf("failed to rollback migration: %v", err)
	}

	log.Println("Migration rollback completed successfully")
	return nil
}

// GetMigrationVersion gets the current migration version
func (mm *MigrationManager) GetMigrationVersion() (uint, bool, error) {
	version, dirty, err := mm.migrator.Version()
	if err != nil {
		return 0, false, fmt.Errorf("failed to get migration version: %v", err)
	}
	return version, dirty, nil
}

// ForceMigrationVersion forces the migration version (useful for fixing dirty state)
func (mm *MigrationManager) ForceMigrationVersion(version uint) error {
	log.Printf("Forcing migration version to %d...", version)

	if err := mm.migrator.Force(int(version)); err != nil {
		return fmt.Errorf("failed to force migration version: %v", err)
	}

	log.Printf("Migration version forced to %d", version)
	return nil
}

// Close closes the migration manager
func (mm *MigrationManager) Close() error {
	if mm.migrator != nil {
		if _, err := mm.migrator.Close(); err != nil {
			return err
		}
	}
	return nil
}

// RunMigrationWithDataSeeding runs migrations and seeds initial data
func (mm *MigrationManager) RunMigrationWithDataSeeding() error {
	// First run migrations
	if err := mm.RunMigrations(); err != nil {
		return err
	}

	// Then seed data if needed
	return mm.SeedInitialData()
}

// SeedInitialData seeds the database with initial data
func (mm *MigrationManager) SeedInitialData() error {
	// Check if users table is empty
	var count int
	err := mm.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		log.Printf("WARNING: Could not check users table count: %v", err)
		return nil
	}

	if count > 0 {
		log.Println("Database already has data, skipping seeding")
		return nil
	}

	log.Println("Seeding initial data...")

	// Generate fake data using existing function
	GenerateFakeData()

	log.Println("Initial data seeding completed")
	return nil
}

// ResetDatabase drops all tables and recreates them
func (mm *MigrationManager) ResetDatabase() error {
	log.Println("Resetting database...")

	// Drop all tables
	tables := []string{
		"notifications",
		"group_invitation_requests",
		"group_invitations",
		"event_attendance",
		"events",
		"group_messages",
		"chat_messages",
		"likes_dislikes",
		"comments",
		"post_viewers",
		"post_categories",
		"posts",
		"group_members",
		"groups",
		"followers",
		"sessions",
		"categories",
		"users",
	}

	// Disable foreign keys temporarily
	_, err := mm.db.Exec("PRAGMA foreign_keys = OFF")
	if err != nil {
		return fmt.Errorf("failed to disable foreign keys: %v", err)
	}

	for _, table := range tables {
		_, err := mm.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
		if err != nil {
			log.Printf("WARNING: Failed to drop table %s: %v", table, err)
		}
	}

	// Re-enable foreign keys
	_, err = mm.db.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		return fmt.Errorf("failed to re-enable foreign keys: %v", err)
	}

	log.Println("Database reset completed")
	return nil
}
