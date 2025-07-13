// GroupInviteModal Component
const GroupInviteModal = {
    props: {
        show: Boolean,
        groupId: [Number, String],
        groupName: String,
        currentUser: Object,
        users: {
            type: Array,
            default: () => []
        },
        groupMembers: {
            type: Array,
            default: () => []
        },
        groupAdminId: {
            type: [Number, String],
            default: null
        }
    },
    emits: ['close', 'invitation-sent'],
    data() {
        return {
            searchQuery: '',
            selectedUser: null,
            loading: false,
            error: '',
            success: '',
            // users: [] // Will be populated from parent
        };
    },
    computed: {
        filteredUsers() {
            // Get IDs of group members
            const memberIds = new Set(this.groupMembers.map(m => m.id || m.ID));
            const adminId = this.groupAdminId;
            const currentUserId = this.currentUser.id;
            const filtered = this.users.filter(user => {
                const userId = user.id || user.ID;
                // Exclude self, admin, and existing members
                return userId !== currentUserId && userId !== adminId && !memberIds.has(userId);
            });
            if (!this.searchQuery.trim()) {
                return filtered;
            }
            const query = this.searchQuery.toLowerCase();
            return filtered.filter(user => {
                const username = (user.username || user.Username || '').toLowerCase();
                const email = (user.email || user.Email || '').toLowerCase();
                const nickname = (user.nickname || user.Nickname || '').toLowerCase();
                return username.includes(query) || email.includes(query) || nickname.includes(query);
            });
        },
        // For search: show all users, but mark already members
        searchedUsers() {
            const query = this.searchQuery.trim().toLowerCase();
            if (!query) return this.filteredUsers;
            // Show all users matching search, even if already members
            return this.users.filter(user => {
                const username = (user.username || user.Username || '').toLowerCase();
                const email = (user.email || user.Email || '').toLowerCase();
                const nickname = (user.nickname || user.Nickname || '').toLowerCase();
                return username.includes(query) || email.includes(query) || nickname.includes(query);
            });
        }
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.resetForm();
            }
        }
    },
    methods: {
        resetForm() {
            this.searchQuery = '';
            this.selectedUser = null;
            this.error = '';
            this.success = '';
        },
        selectUser(user) {
            this.selectedUser = user;
        },
        async inviteUser() {
            if (!this.selectedUser) {
                this.error = 'Please select a user to invite';
                return;
            }

            this.loading = true;
            this.error = '';
            this.success = '';

            try {
                const response = await fetch('/api/groups/invite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        invitee_id: this.selectedUser.id || this.selectedUser.ID,
                        group_id: this.groupId
                    }),
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    this.success = data.message || 'Invitation request sent successfully';
                    this.selectedUser = null;
                    this.searchQuery = '';
                    
                    // Emit success event
                    this.$emit('invitation-sent', {
                        user: this.selectedUser,
                        groupId: this.groupId
                    });
                    
                    // Trigger data refresh in parent components
                    this.triggerDataRefresh();
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || 'Failed to send invitation';
                }
            } catch (error) {
                console.error('Error sending invitation:', error);
                this.error = 'Failed to send invitation';
            } finally {
                this.loading = false;
            }
        },
        
        triggerDataRefresh() {
            // Dispatch events to refresh data in parent components
            window.dispatchEvent(new CustomEvent('group-membership-changed', {
                detail: { groupId: this.groupId }
            }));
            
            // Refresh notifications if available
            if (this.$root && this.$root.fetchNotificationCount) {
                this.$root.fetchNotificationCount();
            }
        },
        closeModal() {
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
        },
        isAlreadyMember(user) {
            const userId = user.id || user.ID;
            return this.groupMembers.some(m => (m.id || m.ID) === userId) || userId === this.groupAdminId || userId === this.currentUser.id;
        }
    },
    template: `
        <teleport to="body">
            <div v-if="show" class="modal-overlay layer-modal" @click.self="closeModal">
                <div class="modal-content layer-modal">
                    <div class="modal-header">
                        <h2>Invite User to {{ groupName }}</h2>
                        <button class="close-button" @click="closeModal">&times;</button>
                    </div>
                    
                    <div class="search-section">
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            placeholder="Search users by username, email, or nickname..." 
                            class="search-input"
                        >
                    </div>
                    
                    <div class="users-list">
                        <div v-if="users.length === 0" class="no-users">No users available</div>
                        <div 
                            v-for="user in searchedUsers" 
                            :key="user.ID || user.id"
                            class="user-item"
                            :class="{ 'selected': selectedUser && (selectedUser.ID || selectedUser.id) === (user.ID || user.id), 'already-member': isAlreadyMember(user) }"
                            @click="!isAlreadyMember(user) && selectUser(user)"
                        >
                            <div class="user-info">
                                <img 
                                    :src="getAvatarUrl(user.avatar || user.Avatar)" 
                                    :alt="user.username || user.Username"
                                    class="user-avatar"
                                >
                                <div class="user-details">
                                    <span class="username">{{ user.username || user.Username }}</span>
                                    <span v-if="user.nickname || user.Nickname" class="nickname">({{ user.nickname || user.Nickname }})</span>
                                    <span class="email">{{ user.email || user.Email }}</span>
                                    <span v-if="isAlreadyMember(user)" class="already-member-label">✔ Already part of group</span>
                                </div>
                            </div>
                            <div class="checkbox">
                                <input 
                                    type="radio" 
                                    :name="'user-' + (user.ID || user.id)"
                                    :checked="selectedUser && (selectedUser.ID || selectedUser.id) === (user.ID || user.id)"
                                    :disabled="isAlreadyMember(user)"
                                    @click.stop
                                    @change="selectUser(user)"
                                >
                            </div>
                        </div>
                        <div v-if="searchedUsers.length === 0 && users.length > 0" class="no-users">
                            {{ searchQuery ? 'No users found matching your search' : 'No users available' }}
                        </div>
                    </div>
                    
                    <div v-if="error" class="error-message">{{ error }}</div>
                    <div v-if="success" class="success-message">{{ success }}</div>
                    
                    <div class="modal-actions">
                        <button 
                            type="button" 
                            class="button primary-button" 
                            @click="inviteUser"
                            :disabled="loading || !selectedUser"
                        >
                            {{ loading ? 'Sending...' : 'Send Invitation' }}
                        </button>
                        <button 
                            type="button" 
                            class="button secondary-button" 
                            @click="closeModal"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    `
};

// Attach to window for global use
window.GroupInviteModal = GroupInviteModal; 