// HomeView Component
const HomeView = {
    template: `
        <div class="home-view">
            <filters-sidebar @filters-changed="onFiltersChanged"></filters-sidebar>
            <div class="feed-main">
                <h1>Welcome To Social Network</h1>
                <div v-if="loading" class="loading-indicator">Loading posts...</div>
                <div v-if="!loading && filteredPosts.length === 0" class="no-posts">No posts match your filters</div>
                <div v-for="post in paginatedPosts" :key="post.ID" class="post-card">
                    <div class="post-header">
                        <h2>[[post.Title]]</h2>
                        <div class="post-meta">
                            <span class="post-author">Posted by <span class="user-clickable" @click="viewPostsByUser(post.UserID)">[[post.Author]]</span></span>
                            <span class="post-date">[[formatDate(post.CreatedAt)]]</span>
                        </div>
                    </div>
                    <div class="post-content">[[post.Text]]</div>
                    <div class="post-footer">
                        <div class="post-interactions">
                            <button @click="likePost(post.ID)" class="like-btn" :disabled="!currentUser.isLoggedIn">[[post.Likes || 0]]</button>
                            <button @click="dislikePost(post.ID)" class="dislike-btn" :disabled="!currentUser.isLoggedIn">[[post.Dislikes || 0]]</button>
                        </div>
                        <div class="post-category" v-if="post.Categories && post.Categories.length">
                            <span v-for="catId in post.Categories" :key="catId">[[getCategoryName(catId)]]</span>
                        </div>
                    </div>
                </div>
                <div class="pagination-controls">
                    <button @click="prevPage" :disabled="currentPage <= 1">Previous</button>
                    <span>Page [[currentPage]] of [[totalPages]]</span>
                    <button @click="nextPage" :disabled="currentPage >= totalPages">Next</button>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            posts: [],
            categories: [],
            filters: {},
            loading: false,
            currentPage: 1,
            pageSize: 10
        };
    },
    computed: {
        filteredPosts() {
            // Apply filters to posts
            let filtered = this.posts;
            if (this.filters.category && this.filters.category.length) {
                filtered = filtered.filter(post => post.Categories && post.Categories.some(cat => this.filters.category.includes(cat)));
            }
            if (this.filters.userOnly) {
                filtered = filtered.filter(post => post.UserID === this.$root.currentUser.id);
            }
            if (this.filters.likedOnly) {
                filtered = filtered.filter(post => post.LikedByCurrentUser);
            }
            if (this.filters.dateFrom) {
                filtered = filtered.filter(post => new Date(post.CreatedAt) >= new Date(this.filters.dateFrom));
            }
            if (this.filters.dateTo) {
                filtered = filtered.filter(post => new Date(post.CreatedAt) <= new Date(this.filters.dateTo));
            }
            return filtered;
        },
        paginatedPosts() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.filteredPosts.slice(start, start + this.pageSize);
        },
        totalPages() {
            return Math.ceil(this.filteredPosts.length / this.pageSize) || 1;
        },
        currentUser() {
            return this.$root.currentUser;
        }
    },
    methods: {
        async fetchPosts() {
            this.loading = true;
            try {
                const response = await fetch('/api/posts');
                const data = await response.json();
                this.posts = data;
            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchCategories() {
            try {
                const response = await fetch('/api/categories');
                const data = await response.json();
                this.categories = data;
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        },
        onFiltersChanged(newFilters) {
            this.filters = newFilters;
            this.currentPage = 1;
        },
        prevPage() {
            if (this.currentPage > 1) this.currentPage--;
        },
        nextPage() {
            if (this.currentPage < this.totalPages) this.currentPage++;
        },
        likePost(postId) {
            // Implement like logic
        },
        dislikePost(postId) {
            // Implement dislike logic
        },
        viewPostsByUser(userId) {
            // Implement view posts by user logic
        },
        getCategoryName(catId) {
            const cat = this.categories.find(c => c.ID === catId);
            return cat ? cat.Name : '';
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        }
    },
    mounted() {
        this.fetchPosts();
        this.fetchCategories();
    }
};

// No mount here, will be registered globally. 