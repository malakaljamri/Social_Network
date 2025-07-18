// GroupMembersModal Component
const GroupMembersModal = {
    props: {
        show: Boolean,
        groupId: [Number, String],
        groupName: String,
        currentUser: Object
    },
    emits: ['close', 'view-user-profile'],
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
            } else {
                // Clear data when modal closes
                this.members = [];
                this.error = '';
                this.searchQuery = '';
            }
        },
        groupId(newVal) {
            if (newVal && this.show) {
                this.fetchMembers();
            }
        }
    },
    methods: {
        async fetchMembers() {
            this.loading = true;
            this.error = '';

            try {
                console.log('Fetching members for group:', this.groupId);
                const response = await fetch(`/api/groups/members?group_id=${this.groupId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    this.members = data.members || [];
                    console.log('Fetched members:', this.members);
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || 'Failed to fetch group members';
                    console.error('Error fetching members:', errorData);
                }
            } catch (error) {
                console.error('Error fetching group members:', error);
                this.error = 'Failed to fetch group members: ' + error.message;
            } finally {
                this.loading = false;
            }
        },
        closeModal() {
            this.$emit('close');
        },
        async refreshMembers() {
            await this.fetchMembers();
        },
        goToUserProfile(userId) {
            // Emit event to parent instead of direct $root access
            this.$emit('view-user-profile', userId);
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
                        <div class="modal-actions">
                            <button class="refresh-button" @click="refreshMembers" :disabled="loading">
                                <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
                            </button>
                            <button class="close-button" @click="closeModal">&times;</button>
                        </div>
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