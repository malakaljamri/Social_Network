CREATE TABLE group_invitation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    inviter_id INTEGER NOT NULL,
    invitee_id INTEGER NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (group_id, invitee_id)
);

CREATE INDEX idx_group_invitation_requests_group_id ON group_invitation_requests(group_id);
CREATE INDEX idx_group_invitation_requests_inviter_id ON group_invitation_requests(inviter_id);
CREATE INDEX idx_group_invitation_requests_status ON group_invitation_requests(status);
