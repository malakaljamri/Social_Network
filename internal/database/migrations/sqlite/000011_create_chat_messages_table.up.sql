CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    "Receiver_id" INTEGER,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY ("Receiver_id") REFERENCES users(id)
);

CREATE INDEX idx_chat_messages_sender_receiver ON chat_messages(sender_id, "Receiver_id");
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);
