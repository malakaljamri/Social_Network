// HomeView Component
const HomeView = {
    template: `
        <div class="home-view layout-grid">
            <filters-sidebar class="sidebar" @filters-changed="onFiltersChanged"></filters-sidebar>
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
                            <button @click="likePost(post.ID)" class="like-btn" :disabled="!currentUser.isLoggedIn">{{ post.Likes || 0 }}</button>
                            <button @click="dislikePost(post.ID)" class="dislike-btn" :disabled="!currentUser.isLoggedIn">{{ post.Dislikes || 0 }}</button>
                        </div>
                        <div class="post-category" v-if="post.Categories && post.Categories.length">
                            <span v-for="catId in post.Categories" :key="catId">{{ getCategoryName(catId) }}</span>
                        </div>
                    </div>
                </div>
                <div class="pagination-controls">
                    <button @click="prevPage" :disabled="currentPage <= 1">Previous</button>
                    <span>Page {{ currentPage }} of {{ totalPages }}</span>
                    <button @click="nextPage" :disabled="currentPage >= totalPages">Next</button>
                </div>
            </div>
            <users-list class="users-list"></users-list>
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
            totalPages: 1
        };
    },
    computed: {
        currentUser() {
            return this.$root.currentUser;
        },
        filteredPosts() {
            // Server-side filtering, so just return posts
            return this.posts;
        }
    },
    methods: {
        async fetchPosts() {
            this.loading = true;
            try {
                const queryParams = new URLSearchParams({
                    page: this.currentPage,
                    limit: this.pageSize,
                    filters: JSON.stringify(this.filters)
                });

                const response = await fetch(`/api/posts?${queryParams}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch posts');

                const totalCount = parseInt(response.headers.get('X-Total-Count'), 10);
                this.totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
                if (document.getElementById('resultsCounter')) {
                    document.getElementById('resultsCounter').textContent = `Total Results: ${totalCount}`;
                }

                const data = await response.json();
                this.posts = data;
            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                this.loading = false;
            }
        },
        async likePost(postId) {
            if (!this.currentUser.isLoggedIn) return;
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
            if (!this.currentUser.isLoggedIn) return;
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
        }
    },
    mounted() {
        this.fetchPosts();
        window.addEventListener('post-created', this.fetchPosts);
    },
    beforeUnmount() {
        window.removeEventListener('post-created', this.fetchPosts);
    }
};

// No mount here, will be registered globally. 