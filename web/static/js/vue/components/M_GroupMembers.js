// GroupMembersModal Component
const GroupMembersModal = {
    props: {
        show: Boolean,
        groupId: [Number, String],
        groupName: String,
        currentUser: Object
    },
    emits: ['close'],
    data() {
        return {
            members: [],
            loading: false,
            error: '',
            searchQuery: ''
        };
    },
    computed: {
        filteredMembers() {
            if (!this.searchQuery.trim()) {
                return this.members;
            }
            const query = this.searchQuery.toLowerCase();
            return this.members.filter(member => {
                const username = (member.username || '').toLowerCase();
                const firstName = (member.first_name || '').toLowerCase();
                const lastName = (member.last_name || '').toLowerCase();
                return username.includes(query) || firstName.includes(query) || lastName.includes(query);
            });
        }
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.fetchMembers();
            }
        }
    },
    methods: {
        async fetchMembers() {
            this.loading = true;
            this.error = '';

            try {
                const response = await fetch(`/api/groups/members?group_id=${this.groupId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    let members = data.members || [];
                    // Ensure admin and current user are present
                    const admin = members.find(m => m.status === 'admin');
                    const currentUserId = this.currentUser.id;
                    const hasCurrentUser = members.some(m => (m.id || m.ID) === currentUserId);
                    if (!admin && this.groupAdminId) {
                        // Optionally fetch admin details if not present
                        // (Assume admin is always present in backend for now)
                    }
                    if (!hasCurrentUser) {
                        // Optionally fetch current user details if not present
                        // (Assume current user is always present in backend for now)
                    }
                    this.members = members;
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || 'Failed to fetch group members';
                }
            } catch (error) {
                console.error('Error fetching group members:', error);
                this.error = 'Failed to fetch group members';
            } finally {
                this.loading = false;
            }
        },
        closeModal() {
            this.$emit('close');
        },
        goToUserProfile(userId) {
            // Navigate to user profile
            this.$root.currentView = 'profile';
            this.$root.viewUserProfile(userId);
            this.closeModal();
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
        getUserDisplayName(member) {
            const firstName = member.first_name || '';
            const lastName = member.last_name || '';
            const username = member.username || '';
            
            if (firstName && lastName) {
                return `${firstName} ${lastName} (@${username})`;
            }
            return username;
        }
    },
    template: `
        <teleport to="body">
            <div v-if="show" class="modal-overlay layer-modal" @click.self="closeModal">
                <div class="modal-content layer-modal">
                    <div class="modal-header">
                        <h2>{{ groupName }} Members</h2>
                        <button class="close-button" @click="closeModal">&times;</button>
                    </div>
                    
                    <div class="search-section">
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            placeholder="Search members..." 
                            class="search-input"
                        >
                    </div>
                    
                    <div v-if="loading" class="loading-indicator">
                        Loading members...
                    </div>
                    
                    <div v-else-if="error" class="error-message">
                        {{ error }}
                    </div>
                    
                    <div v-else class="members-list">
                        <div v-if="members.length === 0" class="no-members">
                            No members in this group
                        </div>
                        <div v-else-if="filteredMembers.length === 0" class="no-members">
                            {{ searchQuery ? 'No members found matching your search' : 'No members in this group' }}
                        </div>
                        <div 
                            v-for="member in filteredMembers" 
                            :key="member.id"
                            class="member-item"
                            @click="goToUserProfile(member.id)"
                        >
                            <div class="member-info">
                                <img 
                                    :src="getAvatarUrl(member.avatar)" 
                                    :alt="member.username"
                                    class="member-avatar"
                                >
                                <div class="member-details">
                                    <span class="member-name">{{ getUserDisplayName(member) }}</span>
                                    <span class="member-status">
                                        <template v-if="member.status === 'admin'">
                                            <span class="admin-badge">Admin</span>
                                        </template>
                                        <template v-else>
                                            Member
                                        </template>
                                    </span>
                                </div>
                            </div>
                            <div class="member-actions">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button 
                            type="button" 
                            class="button secondary-button" 
                            @click="closeModal"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    `
};

// Attach to window for global use
window.GroupMembersModal = GroupMembersModal; 