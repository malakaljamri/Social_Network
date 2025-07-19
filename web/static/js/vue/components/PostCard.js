// PostCard Component - Reusable post display component
const PostCard = {
    props: {
        post: {
            type: Object,
            required: true
        },
        categories: {
            type: Array,
            default: () => []
        },
        currentUser: {
            type: Object,
            required: true
        },
        showComments: {
            type: Boolean,
            default: true
        },
        showCategories: {
            type: Boolean,
            default: true
        },
        showAuthor: {
            type: Boolean,
            default: true
        },
        showDate: {
            type: Boolean,
            default: true
        },
        showPostId: {
            type: Boolean,
            default: false
        },
        profileUserName: {
            type: String,
            default: ''
        }
    },
    methods: {
        getImageUrl(imagePath) {
            if (!imagePath) {
                return '';
            }
            if (imagePath.startsWith('http')) {
                return imagePath;
            }
            const fullUrl = `${window.location.origin}/web${imagePath.startsWith('/') ? '' : '/'}${imagePath.replace(/\\/g, '/')}`;
            return fullUrl;
        },
        formatDate(dateStr) {
            return window.formatDate(dateStr, "YYYY-MM-DD HH:MM");
        },
        getCategoryName(catId) {
            const category = this.categories.find(cat => cat.ID === catId || cat.id === catId);
            return category ? category.Name || category.name : catId;
        },
        viewUserProfile(userId) {
            this.$emit('view-user-profile', userId);
        },
        handleImageError(event) {
            const img = event.target;
            img.style.display = 'none';
        }
    },

    template: `
        <div class="post-card" :data-post-id="post.ID">
            <div class="post-header">
                <h2>{{ post.Title }}</h2>
                <div class="post-meta" v-if="showAuthor || showDate">
                    <span class="post-author" v-if="showAuthor">
                        Posted by 
                        <span class="user-clickable" @click="viewUserProfile(post.UserID)">
                            {{ post.Author || profileUserName }}
                        </span>
                        <span class="post-id" v-if="showPostId"> Post ID: {{ post.ID }}</span>
                    </span>
                    <span class="post-date" v-if="showDate">{{ formatDate(post.CreatedAt) }}</span>
                </div>
            </div>
            <div class="post-content">
                <div v-if="post.Image || post.file_path || post.FilePath" class="post-image">
                    <img 
                        :src="getImageUrl(post.Image || post.file_path || post.FilePath)" 
                        :alt="post.Title"
                        loading="lazy"
                        @error="handleImageError"
                    >
                </div>
                <div class="post-text">{{ post.Text || post.Content }}</div>
            </div>
            <div class="post-footer" v-if="showCategories && ((post.Categories && post.Categories.length) || (post.CategoryIDs && post.CategoryIDs.length))">
                <div class="post-category">
                    <span v-for="catId in (post.Categories || post.CategoryIDs || [])" :key="catId" class="category-tag">
                        {{ getCategoryName(catId) }}
                    </span>
                </div>
            </div>
            <comment-section 
                v-if="showComments" 
                :post-id="post.ID" 
                :current-user="currentUser"
            ></comment-section>
        </div>
    `
};

// No mount here, will be registered globally.
window.PostCard = PostCard; 