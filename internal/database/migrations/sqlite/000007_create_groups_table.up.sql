CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    privacy_setting TEXT CHECK (privacy_setting IN ('public', 'private')) DEFAULT 'public',
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE INDEX idx_groups_creator_id ON groups(creator_id);
CREATE INDEX idx_groups_name ON groups(name);
