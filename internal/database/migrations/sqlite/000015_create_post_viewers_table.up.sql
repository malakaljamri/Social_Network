CREATE TABLE post_viewers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    viewer_id INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_post_viewers_post_id_viewer_id ON post_viewers(post_id, viewer_id);
CREATE INDEX idx_post_viewers_post_id ON post_viewers(post_id);
CREATE INDEX idx_post_viewers_viewer_id ON post_viewers(viewer_id);
