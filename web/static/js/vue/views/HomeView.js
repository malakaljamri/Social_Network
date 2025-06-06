// HomeView Component
const HomeView = {
    template: `
        <div class="home-view layout-grid">
            <filters-sidebar class="sidebar" @filters-changed="onFiltersChanged" @show-create-post-modal="$emit('show-create-post-modal')"></filters-sidebar>
            <div class="feed-main main-content">
                <h1>Welcome To Social Network</h1>
                <div v-if="loading" class="loading-indicator">Loading posts...</div>
                <div v-if="!loading && filteredPosts.length === 0" class="no-posts">No posts match your filters</div>
                <div v-for="post in filteredPosts" :key="post.ID" class="post-card">
                    <div class="post-header">
                        <h2>{{ post.Title }}</h2>
                        <div class="post-meta">
                            <span class="post-author">Posted by <span class="user-clickable" @click="viewPostsByUser(post.UserID)">{{ post.Author }}</span></span>
                            <span class="post-date">{{ formatDate(post.CreatedAt) }}</span>
                        </div>
                    </div>
                    <div class="post-content">{{ post.Text }}</div>
                    <div class="post-footer">
                        <div class="post-interactions">
                            <button @click="likePost(post.ID)" class="like-btn" :disabled="!currentUserValue && currentUserValue.isLoggedIn">{{ post.Likes || 0 }}</button>
                            <button @click="dislikePost(post.ID)" class="dislike-btn" :disabled="!currentUserValue && currentUserValue.isLoggedIn">{{ post.Dislikes || 0 }}</button>
                        </div>
                        <div class="post-category" v-if="post.Categories && post.Categories.length">
                            <span v-for="catId in post.Categories" :key="catId">{{ getCategoryName(catId) }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <users-list class="users-list" @open-chat="openChat"></users-list>
            <div id="chat-section">
                <chat-window v-for="user in openChats" :key="user.ID" :user="user" :currentUser="currentUserValue" :onClose="() => closeChat(user.ID)" :style="{ zIndex: getChatZIndex(user.ID) }"></chat-window>
            </div>
        </div>
    `,
    data() {
        return {
            posts: [],
            filters: {
                categories: [],
                fromDate: '',
                toDate: '',
                likedOnly: false,
                loggedInUserFilter: false
            },
            loading: false,
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            openChats: [],
            chatTimestamps: {} // Store timestamps for each chat window
        };
    },
    computed: {
        currentUserValue() {
            return this.$root.currentUser.value;
        },
        filteredPosts() {
            // Server-side filtering, so just return posts
            return this.posts;
        }
    },
    methods: {
        showCreatePostModal() {
            console.log('HomeView: Emitting show-modal event for createPost');
            this.$root.handleShowModal('createPost');
        },
        async fetchPosts() {
            if (!this.currentUserValue && this.currentUserValue.isLoggedIn) return;
            this.loading = true;
            let queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize,
                filters: JSON.stringify(this.filters)
            });
            try {
                const response = await fetch(`/api/posts?${queryParams}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch posts');
                const data = await response.json();
                this.posts = data.posts || [];
                this.totalPages = data.totalPages || 1;
            } catch (e) {
                this.posts = [];
                this.totalPages = 1;
            } finally {
                this.loading = false;
            }
        },
        async likePost(postId) {
            if (!this.currentUserValue && this.currentUserValue.isLoggedIn) return;
            try {
                const response = await fetch(`/api/posts/${postId}/like`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to like post');
                await this.fetchPosts();
            } catch (error) {
                console.error('Error liking post:', error);
            }
        },
        async dislikePost(postId) {
            if (!this.currentUserValue && this.currentUserValue.isLoggedIn) return;
            try {
                const response = await fetch(`/api/posts/${postId}/dislike`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to dislike post');
                await this.fetchPosts();
            } catch (error) {
                console.error('Error disliking post:', error);
            }
        },
        onFiltersChanged(newFilters) {
            this.filters = newFilters;
            this.currentPage = 1;
            this.fetchPosts();
        },
        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.fetchPosts();
            }
        },
        nextPage() {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.fetchPosts();
            }
        },
        viewPostsByUser(userId) {
            this.$root.currentView = 'profile';
            this.$root.viewUserProfile(userId);
        },
        getCategoryName(catId) {
            // This now expects categories to be provided by the sidebar or a global store
            // For now, just return the ID as a fallback
            return catId;
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        },
        openChat(user) {
            if (!this.openChats.some(u => u.ID === user.ID)) {
                this.openChats.push(user);
            }
            // Update timestamp for this chat window
            this.chatTimestamps[user.ID] = Date.now();
        },
        getChatZIndex(userId) {
            const timestamp = this.chatTimestamps[userId];
            if (!timestamp) return 1;
            return parseInt(timestamp.toString().slice(-6)); // Get last 6 digits of timestamp
        },
        closeChat(userId) {
            this.openChats = this.openChats.filter(u => u.ID !== userId);
            delete this.chatTimestamps[userId];
        }
    },
    mounted() {
        if (this.currentUserValue && this.currentUserValue.isLoggedIn) {
            this.fetchPosts();
        }
        window.addEventListener('post-created', this.fetchPosts);
    },
    watch: {
        'currentUserValue.isLoggedIn'(val) {
            if (val) this.fetchPosts();
        }
    },
    beforeUnmount() {
        window.removeEventListener('post-created', this.fetchPosts);
    }
};

// No mount here, will be registered globally. 