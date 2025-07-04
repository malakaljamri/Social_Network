// GroupMain Component
const GroupMain = {
    props: ['selectedGroup', 'groupPosts', 'groupEvents', 'categories', 'currentUser'],
    data() {
        return {
            showCreateGroupPostForm: false,
            showGroupEventsModal: false,
            showGroupChatWindow: false,
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
            joinLoading: false
        };
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
            if (!dateStr) return '';
            // SQLite returns "YYYY-MM-DD HH:MM:SS", replace space with T for JS Date
            const iso = dateStr.replace(' ', 'T');
            const d = new Date(iso);
            return isNaN(d) ? dateStr : d.toLocaleString();
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
                        <button @click="openGroupChatWindow" class="group-chat-btn" style="margin-bottom: 16px;">
                            <i class="fas fa-comments"></i> Group Chat
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
                    <div v-for="post in groupPosts" :key="post.ID" class="post-card">
                        <div class="post-header">
                            <h3>{{ post.Title }}</h3>
                            <div class="post-meta">
                                <span class="post-author">Posted by {{ post.Author }}</span>
                                <span class="post-date">{{ formatDate(post.CreatedAt) }}</span>
                            </div>
                        </div>
                        <div class="post-content">{{ post.Content }}</div>
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
        'g-group-events-modal': window.G_GroupEventsModal
    }
};
window.G_GroupMain = GroupMain; 