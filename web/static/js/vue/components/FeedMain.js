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
        },
        profileUserName: {
            type: String,
            default: ''
        }
    },
    methods: {
        getImageUrl(imagePath) {
            if (!imagePath) return '';
            if (imagePath.startsWith('http')) return imagePath;
            return `${window.location.origin}/web${imagePath.startsWith('/') ? '' : '/'}${imagePath.replace(/\\/g, '/')}`;
        },
        formatDate(dateStr) {
            return window.formatDate(dateStr, "YYYY-MM-DD HH:MM");
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
            <post-card 
                v-for="post in posts" 
                :key="post.ID" 
                :post="post"
                :categories="categories"
                :current-user="currentUser"
                :show-comments="true"
                :show-categories="true"
                :show-author="true"
                :show-date="true"
                :show-post-id="true"
                :profile-user-name="profileUserName"
                @view-user-profile="viewUserProfile"
            ></post-card>
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