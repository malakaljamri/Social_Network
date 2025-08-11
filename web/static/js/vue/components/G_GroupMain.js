// GroupMain Component
const GroupMain = {
    props: ['selectedGroup', 'groupPosts', 'groupEvents', 'categories', 'currentUser'],
    data() {
        return {
            showCreateGroupPostForm: false,
            showGroupEventsModal: false,
            showGroupChatWindow: false,
            showGroupMembers: false,
            showGroupJoinRequestsModal: false,
            showGroupInviteModal: false,
            groupMembers: [],
            loadingMembers: false,
            newGroupPost: {
                title: '',
                content: '',
                privacy_setting: 'public',
                category_id: ''
            },
            today: new Date().toISOString().split('T')[0],
            eventError: '',
            groupAccess: false,
            groupMembership: '',
            joinLoading: false,
            unreadCounts: {}, // Track unread counts by group ID
            pendingJoinRequestsCount: 0
        };
    },
    computed: {
        myId() {
            return this.$root.currentUser?.id || this.$root.currentUser?.value?.id || null;
        },
        sortedGroupMembers() {
            if (!this.groupMembers.length) return [];
            
            // Sort members with current user at the top
            return [...this.groupMembers].sort((a, b) => {
                // Current user goes first
                if (a.ID === this.myId) return -1;
                if (b.ID === this.myId) return 1;
                // Then sort by username
                return a.Username.localeCompare(b.Username);
            });
        },
        isGroupOwner() {
            return this.selectedGroup && this.selectedGroup.Creator?.ID === this.myId || this.selectedGroup?.CreatorID === this.myId;
        }
    },
    mounted() {
        // Fetch unread group counts on page load only if user is logged in
        if (this.$root.currentUser?.value?.isLoggedIn || this.$root.currentUser?.isLoggedIn) {
            fetch('/api/unread-group-counts', { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    this.unreadCounts = data || {};
                })
                .catch(() => {
                    this.unreadCounts = {};
                });
        }

        window.addEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
    },
    methods: {
        openCreateGroupPostModal() {
            this.showCreateGroupPostForm = true;
        },
        openGroupEventsModal() {
            this.showGroupEventsModal = true;
        },
        openGroupChatWindow() {
            this.showGroupChatWindow = true;
            // Reset unread count when group chat is opened
            if (this.selectedGroup && this.selectedGroup.ID) {
                this.unreadCounts[this.selectedGroup.ID] = 0;
                // Dispatch event to update other components
                window.dispatchEvent(new CustomEvent('unread-group-count-update', { 
                    detail: { groupId: this.selectedGroup.ID, count: 0 } 
                }));
            }
        },
        openGroupJoinRequestsModal() {
            console.log('GroupMain: openGroupJoinRequestsModal called');
            console.log('GroupMain: Current selectedGroup:', this.selectedGroup);
            console.log('GroupMain: Current selectedGroup.ID:', this.selectedGroup?.ID);
            console.log('GroupMain: Current selectedGroup.Name:', this.selectedGroup?.Name);
            
            this.showGroupJoinRequestsModal = true;
            console.log('GroupMain: Set showGroupJoinRequestsModal to true');
        },
        openGroupInviteModal() {
            console.log('🔍 Opening invite modal for group:', this.selectedGroup?.ID);
            this.showGroupInviteModal = true;
        },
        closeGroupJoinRequestsModal() {
            console.log('🔍 Closing join requests modal');
            this.showGroupJoinRequestsModal = false;
        },
        closeGroupInviteModal() {
            console.log('🔍 Closing invite modal');
            this.showGroupInviteModal = false;
        },
        closeCreateGroupPostModal() {
            this.showCreateGroupPostForm = false;
        },
        closeGroupEventsModal() {
            this.showGroupEventsModal = false;
        },
        closeGroupChatWindow() {
            this.showGroupChatWindow = false;
        },
        submitGroupPost() {
            this.$emit('create-group-post', { ...this.newGroupPost });
            this.newGroupPost = { title: '', content: '', privacy_setting: 'public', category_id: '' };
            this.closeCreateGroupPostModal();
        },
        formatDate(dateStr) {
            return window.formatDate(dateStr, "YYYY-MM-DD HH:MM");
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
                    // Emit event to notify parent component about membership status change
                    this.$emit('group-membership-changed', {
                        groupId: this.selectedGroup.ID,
                        membershipStatus: 'pending'
                    });
                }
            } catch (error) {
                console.error('Error requesting to join group:', error);
            } finally {
                this.joinLoading = false;
            }
        },
        handleUnreadCountUpdate(event) {
            const { groupId, count } = event.detail;
            this.unreadCounts[groupId] = count;
        },
        handleJoinRequestHandled(event) {
            console.log('🔍 Join request handled:', event);
            const { userId, action, groupId } = event;
            
            // Update the pending count
            this.pendingJoinRequestsCount = Math.max(0, this.pendingJoinRequestsCount - 1);
            
            // If this was an accept, we might want to refresh the group members
            if (action === 'accept' && this.showGroupMembers) {
                this.fetchGroupMembers();
            }
            
            // Dispatch event to refresh notifications in NavBar after handling join request
            // This ensures that declined notifications are removed from the UI
            window.dispatchEvent(new CustomEvent('refresh-notifications'));
            console.log('🔍 Dispatched refresh-notifications event after handling join request');
        },
        handleInvitationSent(event) {
            console.log('🔍 Invitation sent:', event);
            // Could add success message or other feedback here
        },
        async fetchPendingJoinRequestsCount() {
            if (!this.isGroupOwner || !this.selectedGroup) return;
            
            console.log('🔍 Fetching pending join requests count for group:', this.selectedGroup.ID);
            try {
                const response = await fetch(`/api/groups/join-requests?group_id=${this.selectedGroup.ID}`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const requests = await response.json();
                    this.pendingJoinRequestsCount = requests.length;
                    console.log('✅ Pending join requests count:', this.pendingJoinRequestsCount);
                } else {
                    console.log('⚠️ Could not fetch join requests count, status:', response.status);
                    this.pendingJoinRequestsCount = 0;
                }
            } catch (error) {
                console.error('❌ Error fetching join requests count:', error);
                this.pendingJoinRequestsCount = 0;
            }
        },
        viewUserProfile(userId) {
            console.log('🔍 viewUserProfile called with userId:', userId);
            this.$emit('view-user-profile', userId);
        },
        toggleGroupMembers() {
            this.showGroupMembers = !this.showGroupMembers;
            if (this.showGroupMembers && this.groupMembers.length === 0) {
                this.fetchGroupMembers();
            }
        },
        async fetchGroupMembers() {
            if (!this.selectedGroup || !this.groupAccess) return;
            
            this.loadingMembers = true;
            try {
                const response = await fetch(`/api/groups/members?group_id=${this.selectedGroup.ID}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    this.groupMembers = await response.json();
                } else {
                    console.error('Failed to fetch group members');
                    this.groupMembers = [];
                }
            } catch (error) {
                console.error('Error fetching group members:', error);
                this.groupMembers = [];
            } finally {
                this.loadingMembers = false;
            }
        },
        openPrivateChat(userId) {
            console.log('🔍 openPrivateChat called with userId:', userId);
            // Find the user in group members
            const user = this.groupMembers.find(member => member.ID === userId);
            if (user) {
                console.log('🔍 Emitting open-chat event with user:', user);
                this.$emit('open-chat', user);
            } else {
                console.log('❌ User not found in group members');
            }
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
        getMemberTooltip(member) {
            let tooltip = `Username: ${member.Username}`;
            if (member.Nickname) {
                tooltip += `\nNickname: ${member.Nickname}`;
            }
            tooltip += `\nStatus: ${member.Online ? 'Online' : 'Offline'}`;
            return tooltip;
        }
    },
    beforeUnmount() {
        window.removeEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
    },
    watch: {
        selectedGroup: {
            handler() {
                this.checkGroupAccess();
                // Reset members when group changes
                this.showGroupMembers = false;
                this.groupMembers = [];
                // Fetch pending join requests count if user is group owner
                this.fetchPendingJoinRequestsCount();
            },
            immediate: true
        }
    },
    template: `
        <div class="group-main-content">
            <div class="group-description">
                <h2>{{ selectedGroup ? (selectedGroup.Name + ' Description') : 'Group Description' }}</h2>
                <div class="card">
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
                            <button @click="toggleGroupMembers" class="group-members-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-users"></i> {{ showGroupMembers ? 'Hide' : 'Show' }} Members
                            </button>
                            <!-- Join Requests button - only for group owner -->
                            <button v-if="isGroupOwner" @click="openGroupJoinRequestsModal" class="join-requests-btn" style="margin-bottom: 16px; margin-right: 10px;">
                                <i class="fas fa-user-plus"></i> Join Requests
                                <span v-if="pendingJoinRequestsCount > 0" class="unread-badge right-badge">{{ pendingJoinRequestsCount }}</span>
                            </button>
                            <!-- Invite Users button - for group owner and members -->
                            <button v-if="groupAccess" @click="openGroupInviteModal" class="invite-users-btn" style="margin-bottom: 16px;">
                                <i class="fas fa-user-plus"></i> Invite Users
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
            
            <!-- Group Members Section -->
            <div v-if="showGroupMembers && groupAccess" class="group-members">
                <h2>{{ selectedGroup ? (selectedGroup.Name + ' Members') : 'Group Members' }}</h2>
                <div class="card">
                    <div v-if="loadingMembers" class="loading-members">
                        <p>Loading members...</p>
                    </div>
                    <div v-else-if="groupMembers.length === 0" class="no-members">
                        <p>No members found</p>
                    </div>
                    <div v-else class="members-container">
                        <div v-if="sortedGroupMembers.some(m => m.ID === myId)" class="members-section-header">
                            <span class="section-title">You</span>
                        </div>
                        <div v-for="member in sortedGroupMembers.filter(m => m.ID === myId)" :key="member.ID" class="member-item user-item-flex" :class="{ 'online-user': member.Online, 'current-user': member.ID === myId }">
                            <img
                                :src="getAvatarUrl(member.Avatar)"
                                class="avatar-small profile-link-avatar"
                                :style="member.ID === myId ? 'width:24px;height:24px;border-radius:50%;margin-right:8px;vertical-align:middle;opacity:0.7;' : 'width:24px;height:24px;border-radius:50%;margin-right:8px;cursor:pointer;vertical-align:middle;'"
                                :alt="member.Username + ' avatar'"
                                @click.stop="member.ID !== myId ? viewUserProfile(member.ID) : null"
                            >
                            <!-- <span class="status-dot" :class="{ 'online': member.Online }"></span> -->
                            <strong 
                                :style="member.ID === myId ? 'color: #666; font-style: italic;' : 'cursor:pointer;'" 
                                @click="member.ID !== myId ? openPrivateChat(member.ID) : null" 
                                :title="member.ID === myId ? 'You' : getMemberTooltip(member)"
                            >
                                {{ member.Username }}{{ member.ID === myId ? ' (You)' : '' }}
                            </strong>
                            <span v-if="member.Nickname && member.ID !== myId"> ({{ member.Nickname }})</span>
                        </div>
                        
                        <div v-if="sortedGroupMembers.some(m => m.ID !== myId)" class="members-section-header">
                            <span class="section-title">Other Members</span>
                        </div>
                        <div v-for="member in sortedGroupMembers.filter(m => m.ID !== myId)" :key="member.ID" class="member-item user-item-flex" :class="{ 'online-user': member.Online, 'current-user': member.ID === myId }">
                            <img
                                :src="getAvatarUrl(member.Avatar)"
                                class="avatar-small profile-link-avatar"
                                :style="member.ID === myId ? 'width:24px;height:24px;border-radius:50%;margin-right:8px;vertical-align:middle;opacity:0.7;' : 'width:24px;height:24px;border-radius:50%;margin-right:8px;cursor:pointer;vertical-align:middle;'"
                                :alt="member.Username + ' avatar'"
                                @click.stop="member.ID !== myId ? viewUserProfile(member.ID) : null"
                            >
                            <!-- <span class="status-dot" :class="{ 'online': member.Online }"></span> -->
                            <strong 
                                :style="member.ID === myId ? 'color: #666; font-style: italic;' : 'cursor:pointer;'" 
                                @click="member.ID !== myId ? openPrivateChat(member.ID) : null" 
                                :title="member.ID === myId ? 'You' : getMemberTooltip(member)"
                            >
                                {{ member.Username }}{{ member.ID === myId ? ' (You)' : '' }}
                            </strong>
                            <span v-if="member.Nickname && member.ID !== myId"> ({{ member.Nickname }})</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Create Group Post Modal -->
            <div v-if="showCreateGroupPostForm" class="modal-overlay" @click.self="closeCreateGroupPostModal">
                <div class="modal-content" @click.stop>
                    <h2>Create Group Post</h2>
                    <form @submit.prevent="submitGroupPost">
                        <div class="form-group">
                            <label for="post-title">Title</label>
                            <input type="text" id="post-title" v-model="newGroupPost.title" required>
                        </div>
                        <div class="form-group">
                            <label for="post-content">Content</label>
                            <textarea id="post-content" v-model="newGroupPost.content" required></textarea>
                        </div>
                        <div class="form-group">
                            <label for="privacy-setting">Privacy</label>
                            <select id="privacy-setting" v-model="newGroupPost.privacy_setting" required>
                                <option value="public">Public</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="post-category">Category</label>
                            <input type="text" id="post-category" v-model="newGroupPost.category_id">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="submit-btn">Create</button>
                            <button type="button" class="cancel-btn" @click="closeCreateGroupPostModal">Cancel</button>
                        </div>
                    </form>
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
            <!-- Group Join Requests Modal -->
            <g-group-join-requests-modal
                v-if="showGroupJoinRequestsModal && selectedGroup"
                :group-id="selectedGroup.ID"
                :group-name="selectedGroup.Name || 'Group'"
                @close="closeGroupJoinRequestsModal"
                @request-handled="handleJoinRequestHandled"
            />
            <!-- Group Invite Modal -->
            <g-group-invite-modal
                v-if="showGroupInviteModal && selectedGroup"
                :group-id="selectedGroup.ID"
                :group-name="selectedGroup.Name || 'Group'"
                @close="closeGroupInviteModal"
                @invitation-sent="handleInvitationSent"
            />
            <!-- Group Posts Section -->
            <div class="group-posts">
                <h2>{{ selectedGroup ? (selectedGroup.Name + ' Posts') : 'Group Posts' }}</h2>
                <div v-if="!selectedGroup">
                    <p style="color: grey;">Select a group to view its posts</p>
                </div>
                <div v-else>
                    <!-- Show posts only if user has access -->
                    <div v-if="groupAccess">
                        <div v-if="groupPosts.length === 0" class="no-posts">No posts in this group yet</div>
                        <post-card 
                            v-for="post in groupPosts" 
                            :key="post.ID" 
                            :post="post"
                            :categories="categories"
                            :current-user="currentUser"
                            :show-comments="true"
                            :show-categories="true"
                            :show-author="true"
                            :show-date="true"
                            :show-post-id="true"
                            @view-user-profile="viewUserProfile"
                        ></post-card>
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
        'g-group-join-requests-modal': window.G_GroupJoinRequestsModal,
        'g-group-invite-modal': window.G_GroupInviteModal
    }
};
window.G_GroupMain = GroupMain; 