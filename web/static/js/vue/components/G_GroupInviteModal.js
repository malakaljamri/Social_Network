// GroupInviteModal Component
const GroupInviteModal = {
    props: {
        groupId: {
            type: Number,
            required: true
        },
        groupName: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            username: '',
            searchResults: [],
            loading: false,
            error: '',
            success: '',
            processing: false
        };
    },
    methods: {
        async searchUsers() {
            if (!this.username.trim()) {
                this.searchResults = [];
                return;
            }

            this.loading = true;
            this.error = '';
            
            try {
                const response = await fetch(`/api/search/users?q=${encodeURIComponent(this.username)}`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.searchResults = data.filter(user => user.username !== this.$root.currentUser.value.username);
                } else {
                    this.error = 'Failed to search users';
                }
            } catch (error) {
                console.error('Error searching users:', error);
                this.error = 'Failed to search users';
            } finally {
                this.loading = false;
            }
        },
        
        async inviteUser(username) {
            this.processing = true;
            this.error = '';
            this.success = '';
            
            try {
                const response = await fetch('/api/groups/invite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        group_id: this.groupId,
                        username: username
                    }),
                    credentials: 'include'
                });
                
                if (response.ok) {
                    this.success = `Successfully invited ${username} to ${this.groupName}`;
                    this.username = '';
                    this.searchResults = [];
                    
                    // Emit event to notify parent
                    this.$emit('invitation-sent', { username, groupId: this.groupId });
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || 'Failed to send invitation';
                }
            } catch (error) {
                console.error('Error sending invitation:', error);
                this.error = 'Failed to send invitation';
            } finally {
                this.processing = false;
            }
        },
        
        close() {
            this.$emit('close');
        },
        
        getAvatarUrl(avatar) {
            if (!avatar) {
                return '/static/images/default-avatar.png';
            }
            if (avatar.startsWith('http')) {
                return avatar;
            }
            return `/web/${avatar}`;
        }
    },
    
    watch: {
        username() {
            // Debounce search
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchUsers();
            }, 300);
        }
    },
    
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content" @click.stop style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Invite Users to {{ groupName }}</h2>
                        <button class="modal-close" @click="close" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="username-search">Search users by username:</label>
                            <input 
                                type="text" 
                                id="username-search" 
                                v-model="username" 
                                placeholder="Enter username..."
                                class="form-control"
                                :disabled="processing"
                            >
                        </div>
                        
                        <div v-if="loading" class="loading-indicator">
                            <p>Searching users...</p>
                        </div>
                        
                        <div v-if="error" class="error-message">
                            <p>{{ error }}</p>
                        </div>
                        
                        <div v-if="success" class="success-message">
                            <p>{{ success }}</p>
                        </div>
                        
                        <div v-if="searchResults.length > 0" class="search-results">
                            <h3>Search Results:</h3>
                            <div class="user-list">
                                <div v-for="user in searchResults" :key="user.id" class="user-item">
                                    <div class="user-info">
                                        <img 
                                            :src="getAvatarUrl(user.avatar)" 
                                            :alt="user.username + ' avatar'"
                                            class="user-avatar"
                                        >
                                        <div class="user-details">
                                            <strong>{{ user.username }}</strong>
                                            <span v-if="user.nickname" class="nickname">({{ user.nickname }})</span>
                                        </div>
                                    </div>
                                    <button 
                                        @click="inviteUser(user.username)"
                                        :disabled="processing"
                                        class="button invite-btn"
                                    >
                                        <i v-if="processing" class="fas fa-spinner fa-spin"></i>
                                        <i v-else class="fas fa-user-plus"></i>
                                        Invite
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div v-else-if="username && !loading && searchResults.length === 0" class="no-results">
                            <p>No users found with that username</p>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button @click="close" class="button secondary-button">Close</button>
                    </div>
                </div>
            </div>
        </teleport>
    `,
    
    emits: ['close', 'invitation-sent']
};

window.G_GroupInviteModal = GroupInviteModal; 