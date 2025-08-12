CREATE TABLE event_attendance (
    event_id INTEGER,
    user_id INTEGER,
    status TEXT CHECK (status IN ('going', 'not going')) DEFAULT 'going',
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_user_id ON event_attendance(user_id);
CREATE INDEX idx_event_attendance_status ON event_attendance(status);
