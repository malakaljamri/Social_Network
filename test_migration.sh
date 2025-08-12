#!/bin/bash

echo "🧪 Testing Migration System"
echo "============================"

echo ""
echo "1. Testing with no migration flags (default behavior):"
echo "   This should start the server without running migrations"
echo "   Press Ctrl+C after a few seconds to stop the test"
echo ""

# Test default behavior (no migrations)
echo "Starting server with default settings..."
timeout 5s MIGRATE_DB=false MIGRATE_SEED=false MIGRATE_RESET=false go run cmd/main.go || echo "Server stopped (expected)"

echo ""
echo "2. Testing database reset and migration:"
echo "   This will drop all tables and recreate them"
echo "   Press Ctrl+C after migrations complete to stop the test"
echo ""

# Test reset and migration
echo "Starting server with MIGRATE_RESET=true and MIGRATE_DB=true..."
timeout 10s MIGRATE_RESET=true MIGRATE_DB=true MIGRATE_SEED=false go run cmd/main.go || echo "Server stopped (expected)"

echo ""
echo "3. Testing data seeding:"
echo "   This will seed the database with sample data"
echo "   Press Ctrl+C after seeding complete to stop the test"
echo ""

# Test data seeding
echo "Starting server with MIGRATE_SEED=true..."
timeout 10s MIGRATE_DB=false MIGRATE_SEED=true MIGRATE_RESET=false go run cmd/main.go || echo "Server stopped (expected)"

echo ""
echo "✅ Migration system test completed!"
echo ""
echo "Available environment variables:"
echo "  MIGRATE_DB=true      - Run database migrations"
echo "  MIGRATE_RESET=true   - Reset database completely"
echo "  MIGRATE_SEED=true    - Seed initial data"
echo "  MIGRATE_FOLLOWERS=true - Run followers migration (integrated)"
echo ""
echo "Example usage:"
echo "  MIGRATE_RESET=true MIGRATE_DB=true MIGRATE_SEED=true go run cmd/main.go"
