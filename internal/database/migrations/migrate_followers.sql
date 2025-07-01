-- Migration script to fix followers table schema
-- This script should be run to update existing databases

-- Drop the old followers table
DROP TABLE IF EXISTS followers;

-- Recreate with correct composite primary key
CREATE TABLE followers (
    follower_id INTEGER,
    followed_id INTEGER,
    status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (followed_id) REFERENCES users(id)
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_followed_id ON followers(followed_id);
CREATE INDEX IF NOT EXISTS idx_followers_status ON followers(status);
