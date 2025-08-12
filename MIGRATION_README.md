# Database Migration System

This project now uses a proper database migration system based on `golang-migrate` that follows the mandatory requirements.

## Migration Structure

The migrations are organized in the `internal/database/migrations/sqlite/` folder with the following structure:

```
internal/database/migrations/sqlite/
├── 000000_create_schema_version_table.up.sql
├── 000000_create_schema_version_table.down.sql
├── 000001_create_users_table.up.sql
├── 000001_create_users_table.down.sql
├── 000002_create_posts_table.up.sql
├── 000002_create_posts_table.down.sql
├── 000003_create_categories_table.up.sql
├── 000003_create_categories_table.down.sql
├── 000004_create_post_categories_table.up.sql
├── 000004_create_post_categories_table.down.sql
├── 000005_create_sessions_table.up.sql
├── 000005_create_sessions_table.down.sql
├── 000006_create_followers_table.up.sql
├── 000006_create_followers_table.down.sql
├── 000007_create_groups_table.up.sql
├── 000007_create_groups_table.down.sql
├── 000008_create_group_members_table.up.sql
├── 000008_create_group_members_table.down.sql
├── 000009_create_comments_table.up.sql
├── 000009_create_comments_table.down.sql
├── 000010_create_likes_dislikes_table.up.sql
├── 000010_create_likes_dislikes_table.down.sql
├── 000011_create_chat_messages_table.up.sql
├── 000011_create_chat_messages_table.down.sql
├── 000012_create_group_messages_table.up.sql
├── 000012_create_group_messages_table.down.sql
├── 000013_create_events_table.up.sql
├── 000013_create_events_table.down.sql
├── 000014_create_event_attendance_table.up.sql
├── 000014_create_event_attendance_table.down.sql
├── 000015_create_post_viewers_table.up.sql
├── 000015_create_post_viewers_table.down.sql
├── 000016_create_group_invitations_table.up.sql
├── 000016_create_group_invitations_table.down.sql
├── 000017_create_group_invitation_requests_table.up.sql
├── 000017_create_group_invitation_requests_table.down.sql
├── 000018_create_notifications_table.up.sql
├── 000018_create_notifications_table.down.sql
├── 000019_seed_initial_data.up.sql
└── 000019_seed_initial_data.down.sql
```

## Environment Variables

The migration system is controlled by environment variables with default values of `false`:

### MIGRATE_DB
- **Default**: `false`
- **Purpose**: Run all pending database migrations
- **Usage**: `export MIGRATE_DB=true` or `MIGRATE_DB=true go run cmd/main.go`

### MIGRATE_FOLLOWERS
- **Default**: `false`
- **Purpose**: Run followers table migration (now integrated into main migration system)
- **Usage**: `export MIGRATE_FOLLOWERS=true` or `MIGRATE_FOLLOWERS=true go run cmd/main.go`

### MIGRATE_SEED
- **Default**: `false`
- **Purpose**: Seed the database with initial sample data
- **Usage**: `export MIGRATE_SEED=true` or `MIGRATE_SEED=true go run cmd/main.go`

### MIGRATE_RESET
- **Default**: `false`
- **Purpose**: Drop all tables and recreate the database from scratch
- **Usage**: `export MIGRATE_RESET=true` or `MIGRATE_RESET=true go run cmd/main.go`

## Bash Commands to Control Migrations

### Run Database Migrations
```bash
export MIGRATE_DB=true
go run cmd/main.go
```

### Reset Database and Run Migrations
```bash
export MIGRATE_RESET=true
go run cmd/main.go
```

### Seed Initial Data
```bash
export MIGRATE_SEED=true
go run cmd/main.go
```

### Run All Migrations and Seed Data
```bash
export MIGRATE_DB=true
export MIGRATE_SEED=true
go run cmd/main.go
```

### Reset Everything and Start Fresh
```bash
export MIGRATE_RESET=true
export MIGRATE_DB=true
export MIGRATE_SEED=true
go run cmd/main.go
```

### One-liner Commands
```bash
# Run migrations
MIGRATE_DB=true go run cmd/main.go

# Reset and migrate
MIGRATE_RESET=true MIGRATE_DB=true go run cmd/main.go

# Full setup
MIGRATE_RESET=true MIGRATE_DB=true MIGRATE_SEED=true go run cmd/main.go
```

## Migration Features

### Up Migrations
- Create tables with proper schema
- Add indexes for performance
- Set up foreign key relationships
- Include data validation constraints

### Down Migrations
- Drop tables in reverse dependency order
- Clean up all related data
- Remove indexes and constraints

### Data Seeding
- Sample users with hashed passwords
- Sample categories
- Safe to run multiple times (uses `INSERT OR IGNORE`)

### Schema Version Tracking
- Automatic version tracking in `schema_migrations` table
- Support for rollback operations
- Dirty state detection and recovery

## Migration Manager API

The `MigrationManager` provides several methods:

```go
// Run all pending migrations
err := migrationManager.RunMigrations()

// Rollback last migration
err := migrationManager.RollbackLastMigration()

// Get current migration version
version, dirty, err := migrationManager.GetMigrationVersion()

// Force migration version (useful for fixing dirty state)
err := migrationManager.ForceMigrationVersion(version)

// Reset database completely
err := migrationManager.ResetDatabase()

// Run migrations with data seeding
err := migrationManager.RunMigrationWithDataSeeding()
```

## Benefits of the New System

1. **Compliance**: Follows the mandatory migration requirements
2. **Version Control**: Tracks migration versions and states
3. **Rollback Support**: Can undo migrations if needed
4. **Environment Control**: Only runs when explicitly requested
5. **Separate Files**: Each table has its own migration files
6. **Proper Dependencies**: Tables are created in the correct order
7. **Data Preservation**: Safe to run on existing databases
8. **Performance**: Includes proper indexes and constraints

## Troubleshooting

### Migration Fails
If a migration fails, the system will mark it as "dirty". You can:
1. Fix the issue in the migration file
2. Use `MIGRATE_RESET=true` to start fresh
3. Or manually fix the database state

### Database Locked
If you get database locked errors:
1. Ensure no other processes are using the database
2. Check if the database file has proper permissions
3. Try using `MIGRATE_RESET=true` to recreate everything

### Old Schema Issues
If you have an existing database with the old schema:
1. Use `MIGRATE_RESET=true` to start fresh
2. Or manually migrate the data to the new schema
3. The system will automatically detect and handle schema differences

## Migration Order

The migrations are designed to run in the correct order:

1. **Schema version table** - Tracks migration state
2. **Users table** - Base table for all other tables
3. **Posts table** - Depends on users
4. **Categories and post_categories** - Junction table
5. **Sessions** - User authentication
6. **Followers** - User relationships
7. **Groups and group_members** - Group functionality
8. **Comments, likes, etc.** - Post interactions
9. **Chat and messaging** - Communication features
10. **Events and attendance** - Group events
11. **Notifications** - System notifications
12. **Data seeding** - Initial sample data

This ensures that all foreign key constraints are satisfied and the database is created in the correct order.
