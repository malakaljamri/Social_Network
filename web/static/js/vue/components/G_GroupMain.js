// GroupMain Component
const GroupMain = {
    props: ['selectedGroup', 'groupPosts', 'groupEvents', 'categories'],
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
            eventError: ''
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
                        <button @click="$emit('open-create-group-post-modal', selectedGroup.ID)" class="create-group-post-btn" style="margin-bottom: 16px; margin-right: 10px;">
                            <i class="fas fa-plus-circle"></i> Create Group Post
                        </button>
                        <button @click="openGroupEventsModal" class="group-events-btn" style="margin-bottom: 16px; margin-right: 10px;">
                            <i class="fas fa-calendar-alt"></i> Group Events
                        </button>
                        <button @click="openGroupChatWindow" class="group-chat-btn" style="margin-bottom: 16px;">
                            <i class="fas fa-comments"></i> Group Chat
                        </button>
                        <p><strong>created by:</strong> {{ selectedGroup.Creator?.Username || 'unknown' }}</p>
                        <p><strong>created on:</strong> {{ formatDate(selectedGroup.CreatedAt) }}</p>
                        <p>{{ selectedGroup.Description }}</p>
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
            </div>
        </div>
    `,
    components: {
        'g-group-events-modal': window.G_GroupEventsModal
    }
};
window.G_GroupMain = GroupMain; 