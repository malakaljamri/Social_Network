-- Add session_token column to users table
ALTER TABLE users ADD COLUMN session_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
