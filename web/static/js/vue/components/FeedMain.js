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
        },
        onRefreshPosts: {
            type: Function,
            required: false
        }
    },
    data() {
        return {
            localPosts: [],
            isListening: false
        };
    },
    watch: {
        posts: {
            immediate: true,
            handler(newPosts) {
                this.localPosts = [...newPosts];
            }
        }
    },
    mounted() {
        this.setupRealTimeUpdates();
    },
    beforeUnmount() {
        this.cleanupRealTimeUpdates();
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
        },
        setupRealTimeUpdates() {
            if (this.isListening) return;
            
            console.log('🔔 FeedMain: Setting up real-time updates');
            this.isListening = true;

            // Listen for new posts
            window.addEventListener('new-post', this.handleNewPost);
            
            // Listen for post updates
            window.addEventListener('post-updated', this.handlePostUpdated);
            
            // Listen for post deletions
            window.addEventListener('post-deleted', this.handlePostDeleted);
            
            // Listen for new comments
            window.addEventListener('new-comment', this.handleNewComment);
            
            // Listen for comment updates
            window.addEventListener('comment-updated', this.handleCommentUpdated);
            
            // Listen for comment deletions
            window.addEventListener('comment-deleted', this.handleCommentDeleted);
        },
        cleanupRealTimeUpdates() {
            if (!this.isListening) return;
            
            console.log('🔔 FeedMain: Cleaning up real-time updates');
            this.isListening = false;

            window.removeEventListener('new-post', this.handleNewPost);
            window.removeEventListener('post-updated', this.handlePostUpdated);
            window.removeEventListener('post-deleted', this.handlePostDeleted);
            window.removeEventListener('new-comment', this.handleNewComment);
            window.removeEventListener('comment-updated', this.handleCommentUpdated);
            window.removeEventListener('comment-deleted', this.handleCommentDeleted);
        },
        handleNewPost(event) {
            const newPost = event.detail;
            console.log('🔔 FeedMain: New post received:', newPost);
            
            // Add new post to the beginning of the list
            this.localPosts.unshift(newPost);
            
            // Show notification
            this.showPostNotification('New post created!', 'success');
        },
        handlePostUpdated(event) {
            const updatedPost = event.detail;
            console.log('🔔 FeedMain: Post updated:', updatedPost);
            
            // Find and update the post in the list
            const index = this.localPosts.findIndex(post => post.ID === updatedPost.ID);
            if (index !== -1) {
                this.localPosts[index] = { ...this.localPosts[index], ...updatedPost };
                this.showPostNotification('Post updated!', 'info');
            }
        },
        handlePostDeleted(event) {
            const deletedPost = event.detail;
            console.log('🔔 FeedMain: Post deleted:', deletedPost);
            
            // Remove the deleted post from the list
            this.localPosts = this.localPosts.filter(post => post.ID !== deletedPost.post_id);
            
            // Show notification
            this.showPostNotification('Post deleted!', 'warning');
            
            // If we have a refresh function, call it to update the total count
            if (this.onRefreshPosts) {
                this.onRefreshPosts();
            }
        },
        handleNewComment(event) {
            const newComment = event.detail;
            console.log('🔔 FeedMain: New comment received:', newComment);
            
            // Find the post and add the comment
            const postIndex = this.localPosts.findIndex(post => post.ID === newComment.PostID);
            if (postIndex !== -1) {
                if (!this.localPosts[postIndex].Comments) {
                    this.localPosts[postIndex].Comments = [];
                }
                this.localPosts[postIndex].Comments.push(newComment);
                
                // Update comment count if it exists
                if (this.localPosts[postIndex].CommentCount !== undefined) {
                    this.localPosts[postIndex].CommentCount++;
                }
            }
        },
        handleCommentUpdated(event) {
            const updatedComment = event.detail;
            console.log('🔔 FeedMain: Comment updated:', updatedComment);
            
            // Find and update the comment in the appropriate post
            const postIndex = this.localPosts.findIndex(post => post.ID === updatedComment.PostID);
            if (postIndex !== -1 && this.localPosts[postIndex].Comments) {
                const commentIndex = this.localPosts[postIndex].Comments.findIndex(
                    comment => comment.ID === updatedComment.ID
                );
                if (commentIndex !== -1) {
                    this.localPosts[postIndex].Comments[commentIndex] = { 
                        ...this.localPosts[postIndex].Comments[commentIndex], 
                        ...updatedComment 
                    };
                }
            }
        },
        handleCommentDeleted(event) {
            const deletedComment = event.detail;
            console.log('🔔 FeedMain: Comment deleted:', deletedComment);
            
            // Find and remove the comment from the appropriate post
            const postIndex = this.localPosts.findIndex(post => post.ID === deletedComment.PostID);
            if (postIndex !== -1 && this.localPosts[postIndex].Comments) {
                this.localPosts[postIndex].Comments = this.localPosts[postIndex].Comments.filter(
                    comment => comment.ID !== deletedComment.comment_id
                );
                
                // Update comment count if it exists
                if (this.localPosts[postIndex].CommentCount !== undefined) {
                    this.localPosts[postIndex].CommentCount = Math.max(0, this.localPosts[postIndex].CommentCount - 1);
                }
            }
        },
        showPostNotification(message, type = 'info') {
            // Create a simple toast notification
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#2196f3'};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 100);
            
            // Remove after 3 seconds
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
    },
    template: `
        <div class="feed-main main-content">
            <div v-if="localPosts.length === 0" class="no-posts">No posts to show.</div>
            <post-card 
                v-for="post in localPosts" 
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