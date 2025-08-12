CREATE TABLE likes_dislikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    post_id INTEGER,
    comment_id INTEGER,
    is_like BOOLEAN,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (comment_id) REFERENCES comments(id)
);

CREATE INDEX idx_likes_dislikes_user_id ON likes_dislikes(user_id);
CREATE INDEX idx_likes_dislikes_post_id ON likes_dislikes(post_id);
CREATE INDEX idx_likes_dislikes_comment_id ON likes_dislikes(comment_id);
