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
            console.log('🔍 M_GroupMembers: show watcher triggered, newVal =', newVal, 'groupId =', this.groupId);
            if (newVal && this.groupId) {
                // Use nextTick to ensure the modal is rendered before fetching
                this.$nextTick(() => {
                    console.log('🔍 M_GroupMembers: Calling fetchMembers from show watcher');
                    this.fetchMembers();
                });
            } else {
                // Clear data when modal closes
                this.members = [];
                this.error = '';
                this.searchQuery = '';
                console.log('🔍 M_GroupMembers: Modal closed, cleared data');
            }
        },
        groupId(newVal) {
            console.log('🔍 M_GroupMembers: groupId watcher triggered, newVal =', newVal, 'show =', this.show);
            if (newVal && this.show) {
                this.$nextTick(() => {
                    console.log('🔍 M_GroupMembers: Calling fetchMembers from groupId watcher');
                    this.fetchMembers();
                });
            }
        }
    },
    mounted() {
        console.log('🔍 M_GroupMembers: Component mounted, show =', this.show, 'groupId =', this.groupId);
        // If the modal is already shown when mounted, fetch members
        if (this.show && this.groupId) {
            console.log('🔍 M_GroupMembers: Modal already shown on mount, fetching members');
            this.$nextTick(() => {
                this.fetchMembers();
            });
        }
    },
    methods: {
        async fetchMembers() {
            this.loading = true;
            this.error = '';

            try {
                console.log('🔍 M_GroupMembers: Starting fetchMembers');
                console.log('🔍 M_GroupMembers: groupId =', this.groupId);
                console.log('🔍 M_GroupMembers: groupName =', this.groupName);
                console.log('🔍 M_GroupMembers: currentUser =', this.currentUser);
                
                const response = await fetch(`/api/groups/members?group_id=${this.groupId}`, {
                    credentials: 'include'
                });

                console.log('🔍 M_GroupMembers: Response status =', response.status);
                console.log('🔍 M_GroupMembers: Response ok =', response.ok);

                if (response.ok) {
                    const data = await response.json();
                    console.log('🔍 M_GroupMembers: Raw response data =', data);
                    
                    this.members = data.members || [];
                    console.log('🔍 M_GroupMembers: Processed members =', this.members);
                    console.log('🔍 M_GroupMembers: Members length =', this.members.length);
                } else {
                    const errorData = await response.json();
                    console.error('🔍 M_GroupMembers: Error response =', errorData);
                    this.error = errorData.error || 'Failed to fetch group members';
                }
            } catch (error) {
                console.error('🔍 M_GroupMembers: Exception during fetch =', error);
                this.error = 'Failed to fetch group members: ' + error.message;
            } finally {
                this.loading = false;
                console.log('🔍 M_GroupMembers: Fetch completed, loading = false');
            }
        },
        closeModal() {
            this.$emit('close');
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