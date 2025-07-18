// GroupMain Component
const GroupMain = {
    props: {
        currentUser: {
            type: Object,
            required: true
        },
        selectedGroup: {
            type: [Object, null],
            default: null
        },
        groupPosts: {
            type: Array,
            default: () => []
        },
        groupEvents: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            showGroupEventsModal: false,
            showGroupChatWindow: false,
            showInviteUserModal: false,
            showGroupMembersModal: false,

            today: new Date().toISOString().split('T')[0],
            eventError: '',
            groupAccess: false,
            groupMembership: '',
            joinLoading: false,
            unreadCounts: {}, // Track unread counts by group ID
            groupMembers: [], // Store group members for invite modal
            groupAdminId: null // Store group admin ID for invite modal
        };
    },
    computed: {
        myId() {
            return this.currentUser?.id || null;
        }
    },
    mounted() {
        // Initialize unread count service
        if (window.unreadCountService) {
            window.unreadCountService.addListener((counts) => {
                this.unreadCounts = counts;
            });
        }
    },
    methods: {
        openCreateGroupPostModal() {
            this.$emit('open-create-group-post-modal', this.selectedGroup.ID);
        },
        openGroupEventsModal() {
            this.showGroupEventsModal = true;
        },
        openGroupChatWindow() {
            this.showGroupChatWindow = true;
            // Reset unread count when group chat is opened
            if (this.selectedGroup && this.selectedGroup.ID) {
                if (window.unreadCountService) {
                    window.unreadCountService.resetUnreadCount(this.selectedGroup.ID);
                }
            }
        },

        closeGroupEventsModal() {
            this.showGroupEventsModal = false;
        },
        closeGroupChatWindow() {
            this.showGroupChatWindow = false;
        },
        async openInviteUserModal() {
            // Fetch group members and admin ID before opening modal
            if (this.selectedGroup && this.selectedGroup.ID) {
                try {
                    const response = await fetch(`/api/groups/members?group_id=${this.selectedGroup.ID}`, { credentials: 'include' });
                    if (response.ok) {
                        const data = await response.json();
                        this.groupMembers = data.members || [];
                        // Find admin ID
                        const admin = this.groupMembers.find(m => m.status === 'admin');
                        this.groupAdminId = admin ? (admin.id || admin.ID) : null;
                    }
                } catch (e) {
                    this.groupMembers = [];
                    this.groupAdminId = null;
                }
            }
            this.showInviteUserModal = true;
        },
        closeInviteUserModal() {
            this.showInviteUserModal = false;
        },
        openGroupMembersModal() {
            console.log('🔍 G_GroupMain: openGroupMembersModal called');
            console.log('🔍 G_GroupMain: selectedGroup =', this.selectedGroup);
            console.log('🔍 G_GroupMain: selectedGroup.ID =', this.selectedGroup?.ID);
            console.log('🔍 G_GroupMain: selectedGroup.Name =', this.selectedGroup?.Name);
            this.showGroupMembersModal = true;
            console.log('🔍 G_GroupMain: showGroupMembersModal set to true');
        },
        closeGroupMembersModal() {
            this.showGroupMembersModal = false;
        },
        handleViewUserProfile(userId) {
            this.$emit('view-user-profile', userId);
        },
        handleInvitationSent(data) {
            // Handle successful invitation
            console.log('Invitation sent:', data);
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            // SQLite returns "YYYY-MM-DD HH:MM:SS", replace space with T for JS Date
            const iso = dateStr.replace(' ', 'T');
            const d = new Date(iso);
            return isNaN(d) ? dateStr : d.toLocaleString();
        },
        getImageUrl(imagePath) {
            if (!imagePath) return '';
            if (imagePath.startsWith('http')) return imagePath;
            return `${window.location.origin}/web${imagePath.startsWith('/') ? '' : '/'}${imagePath.replace(/\\/g, '/')}`;
        },
        async checkGroupAccess() {
            if (!this.selectedGroup || !this.currentUser || !this.currentUser.isLoggedIn) {
                this.groupAccess = false;
                this.groupMembership = '';
                return;
            }

            try {
                const response = await fetch(`/api/groups/access?group_id=${this.selectedGroup.ID}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    this.groupAccess = data.has_access;
                    this.groupMembership = data.membership_status || '';
                }
            } catch (error) {
                console.error('Error checking group access:', error);
                this.groupAccess = false;
                this.groupMembership = '';
            }
        },
        async requestJoinGroup() {
            if (!this.selectedGroup || !this.currentUser || !this.currentUser.isLoggedIn) return;
            
            this.joinLoading = true;
            try {
                const response = await fetch('/api/groups/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group_id: this.selectedGroup.ID }),
                    credentials: 'include'
                });
                if (response.ok) {
                    this.groupMembership = 'pending';
                }
            } catch (error) {
                console.error('Error requesting to join group:', error);
            } finally {
                this.joinLoading = false;
            }
        },
        // Unread count updates are now handled by the centralized service
    },
    beforeUnmount() {
        // Clean up unread count service listener
        if (window.unreadCountService) {
            window.unreadCountService.removeListener((counts) => {
                this.unreadCounts = counts;
            });
        }
    },
    watch: {
        selectedGroup: {
            handler() {
                this.checkGroupAccess();
            },
            immediate: true
        }
    },
    template: `
        <div class="group-main-content layer-content">
            <div class="group-description">
                <h2>{{ selectedGroup ? (selectedGroup.Name + ' Description') : 'Group Description' }}</h2>
                <div class="card layer-card">
                    <template v-if="!selectedGroup">
                        <p style="color: grey;"><span style="color: blue;">↖</span> Click on a group</p>
                    </template>
                    <template v-else>
                        <p><strong>created by:</strong> {{ selectedGroup.Creator?.Username || 'unknown' }}</p>
                        <p><strong>created on:</strong> {{ formatDate(selectedGroup.CreatedAt) }}</p>
                        <p>{{ selectedGroup.Description }}</p>
                        
                        <!-- Show action buttons only if user has access -->
                        <div v-if="groupAccess">
                            <button @click="$emit('open-create-group-post-modal', selectedGroup.ID)" class="create-group-post-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-plus-circle"></i> Create Group Post
                            </button>
                            <button @click="openGroupEventsModal" class="group-events-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-calendar-alt"></i> Group Events
                            </button>
                            <button @click="openGroupChatWindow" class="group-chat-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-comments"></i> Group Chat
                                <span v-if="myId && unreadCounts[selectedGroup.ID] > 0" class="unread-badge right-badge">{{ unreadCounts[selectedGroup.ID] }}</span>
                            </button>
                            <!-- Show Invite User button only for private groups -->
                            <button v-if="selectedGroup.PrivacySetting === 'private'" @click="openInviteUserModal" class="invite-user-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-user-plus"></i> Invite User
                            </button>
                            <!-- Show Group Members button only for private groups -->
                            <button v-if="selectedGroup.PrivacySetting === 'private'" @click="openGroupMembersModal" class="group-members-btn" style="margin-bottom: 16px;">
                                <i class="fas fa-users"></i> Group Members
                            </button>
                        </div>
                        
                        <!-- Show join button if user doesn't have access and hasn't requested to join -->
                        <div v-else-if="!groupAccess && groupMembership !== 'pending'">
                            <button @click="requestJoinGroup" class="button" :disabled="joinLoading" style="margin-top: 16px;">
                                {{ joinLoading ? 'Joining...' : 'Join ' + selectedGroup.Name }}
                            </button>
                        </div>
                        
                        <!-- Show pending message if user has requested to join -->
                        <div v-else-if="groupMembership === 'pending'">
                            <p style="color: #666; font-style: italic; margin-top: 16px;">⏳ Awaiting group admin approval</p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Group Events Modal -->
            <g-group-events-modal
                v-if="showGroupEventsModal && selectedGroup"
                :events="groupEvents"
                :group-id="selectedGroup.ID"
                :group-name="selectedGroup.Name || 'Group'"
                @close="closeGroupEventsModal"
                @refresh-events="$emit('refresh-group-events')"
                @event-click="$emit('event-click', $event)"
            />
            
            <!-- Group Chat Modal -->
            <div v-if="showGroupChatWindow" class="modal-overlay" @click.self="closeGroupChatWindow">
                <g-group-chat :group-name="selectedGroup?.Name" :group-id="selectedGroup?.ID" @close="closeGroupChatWindow" />
            </div>
            
            <!-- Invite User Modal -->
            <group-invite-modal
                v-if="showInviteUserModal && selectedGroup"
                :show="showInviteUserModal"
                :group-id="selectedGroup.ID"
                :group-name="selectedGroup.Name"
                :current-user="currentUser"
                :users="$root.users"
                :group-members="groupMembers"
                :group-admin-id="groupAdminId"
                @close="closeInviteUserModal"
                @invitation-sent="handleInvitationSent"
            />
            
            <!-- Group Members Modal -->
            <group-members-modal
                v-if="showGroupMembersModal && selectedGroup"
                :key="'group-members-' + selectedGroup.ID"
                :show="showGroupMembersModal"
                :group-id="selectedGroup.ID"
                :group-name="selectedGroup.Name"
                :current-user="currentUser"
                @close="closeGroupMembersModal"
                @view-user-profile="handleViewUserProfile"
            />
            
            <!-- Group Posts Section -->
            <div class="group-posts layer-content">
                <h2>{{ selectedGroup ? (selectedGroup.Name + ' Posts') : 'Group Posts' }}</h2>
                <div v-if="!selectedGroup">
                    <p style="color: grey;">Select a group to view its posts</p>
                </div>
                <div v-else>
                    <!-- Show posts only if user has access -->
                    <div v-if="groupAccess">
                        <div v-if="groupPosts.length === 0" class="no-posts">No posts in this group yet</div>
                        <div v-for="post in groupPosts" :key="post.ID" class="post-card layer-card">
                            <div class="post-header">
                                <h3>{{ post.Title }}</h3>
                                <div class="post-meta">
                                    <span class="post-author">Posted by {{ post.Author }}</span>
                                    <span class="post-date">{{ formatDate(post.CreatedAt) }}</span>
                                </div>
                            </div>
                            <div class="post-content">
                                <div v-if="post.Image" class="post-image">
                                    <img 
                                        :src="getImageUrl(post.Image)" 
                                        :alt="post.Title"
                                        loading="lazy"
                                    >
                                </div>
                                <div class="post-text">{{ post.Content }}</div>
                            </div>
                            <comment-section :post-id="post.ID" :current-user="currentUser"></comment-section>
                        </div>
                    </div>
                    <!-- Show message if user doesn't have access -->
                    <div v-else>
                        <p style="color: #666; font-style: italic;">join group to see posts</p>
                    </div>
                </div>
            </div>
        </div>
    `,
    components: {
        'g-group-events-modal': window.G_GroupEventsModal,
        'comment-section': window.CommentSection,
        'group-invite-modal': window.GroupInviteModal,
        'group-members-modal': window.GroupMembersModal
    }
};
window.G_GroupMain = GroupMain; 