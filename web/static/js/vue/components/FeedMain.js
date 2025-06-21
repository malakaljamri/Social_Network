// FeedMain Component
const FeedMain = {
    props: {
        posts: {
            type: Array,
            required: true
        },
        categories: {
            type: Array,
            required: true
        },
        currentUser: {
            type: Object,
            required: true
        },
        totalPages: {
            type: Number,
            default: 1
        },
        currentPage: {
            type: Number,
            default: 1
        },
        onPrevPage: {
            type: Function,
            required: false
        },
        onNextPage: {
            type: Function,
            required: false
        },
        getCategoryName: {
            type: Function,
            required: false
        }
    },
    methods: {
        getImageUrl(imagePath) {
            if (!imagePath) return '';
            if (imagePath.startsWith('http')) return imagePath;
            return `${window.location.origin}/web${imagePath.startsWith('/') ? '' : '/'}${imagePath.replace(/\\/g, '/')}`;
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        },
        getCategoryNameLocal(catId) {
            if (this.getCategoryName) {
                return this.getCategoryName(catId);
            }
            const category = this.categories.find(cat => cat.ID === catId || cat.id === catId);
            return category ? category.Name || category.name : catId;
        },
        viewUserProfile(userId) {
            this.$emit('view-user-profile', userId);
        }
    },
    template: `
        <div class="feed-main main-content">
            <div v-if="posts.length === 0" class="no-posts">No posts to show.</div>
            <div v-for="post in posts" :key="post.ID" class="post-card" :data-post-id="post.ID">
                <div class="post-header">
                    <h2>{{ post.Title }}</h2>
                    <div class="post-meta">
                        <span class="post-author">Posted by <span class="user-clickable" @click="viewUserProfile(post.UserID)">{{ post.Author }}</span>
                            <span class="post-id">  Post ID: {{ post.ID }}</span>
                        </span>
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
                    <div class="post-text">{{ post.Text }}</div>
                </div>
                <div class="post-footer">
                    <div class="post-category" v-if="post.Categories && post.Categories.length">
                        <span v-for="catId in post.Categories" :key="catId">{{ getCategoryNameLocal(catId) }}</span>
                    </div>
                </div>
                <comment-section :post-id="post.ID" :current-user="currentUser"></comment-section>
            </div>
            <div class="pagination-controls" v-if="totalPages > 1">
                <button 
                    @click="onPrevPage && onPrevPage()" 
                    :disabled="currentPage === 1"
                    class="pagination-btn"
                >
                    Previous
                </button>
                <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
                <button 
                    @click="onNextPage && onNextPage()" 
                    :disabled="currentPage === totalPages"
                    class="pagination-btn"
                >
                    Next
                </button>
            </div>
        </div>
    `
};

// No mount here, will be registered globally. 