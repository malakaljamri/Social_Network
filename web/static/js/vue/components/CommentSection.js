// CommentSection Component
const CommentSection = {
    props: ['postId', 'currentUser'],
    template: `
        <div class="comments-section">
            <button @click="showComments = !showComments" class="comment-toggle-btn">{{ commentButtonText }}</button>
            <div v-if="showComments">
                <h3 class="comments-title">Comments</h3>
                <div v-if="comments.length === 0" class="no-comments">No comments yet.</div>
                <div v-else class="comments-list">
                    <div v-for="comment in comments" :key="comment.ID" class="comment-card">
                        <div class="comment-header">
                            <span class="comment-author">{{ comment.Author }}</span>
                            <span class="comment-timestamp">{{ formatDate(comment.CreatedAt) }}</span>
                        </div>
                        <div class="comment-content">
                            <p class="comment-text">{{ comment.Text }}</p>
                            <div v-if="comment.Image" class="comment-image">
                                <img 
                                    :src="getImageUrl(comment.Image)" 
                                    :alt="'Comment by ' + comment.Author"
                                    @error="handleImageError"
                                    loading="lazy"
                                >
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="currentUser && currentUser.isLoggedIn" class="comment-form">
                    <h4>Add a Comment</h4>
                    <textarea v-model="newComment.text" placeholder="Write a comment..." rows="3"></textarea>
                    
                    <!-- Image Upload for Comments -->
                    <div class="image-upload-section">
                        <div class="image-upload-container" 
                             @click="triggerFileInput" 
                             @dragover.prevent 
                             @drop.prevent="handleFileDrop"
                             :class="{ 'has-image': imagePreview }">
                            <input 
                                type="file" 
                                ref="commentFileInput"
                                @change="handleFileUpload" 
                                accept="image/jpeg, image/png, image/gif"
                                class="hidden"
                            >
                            <div v-if="!imagePreview" class="upload-placeholder">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Click or drag image here</p>
                                <p class="upload-hint">Max size: 2MB, Max dimensions: 2000x2000px</p>
                            </div>
                            <div v-else class="image-preview">
                                <img :src="imagePreview" alt="Preview">
                                <button type="button" class="remove-image" @click.stop="removeImage">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div v-if="imageError" class="error">{{ imageError }}</div>
                    </div>

                    <button @click="submitComment" :disabled="!newComment.text.trim() && !newComment.file">Post Comment</button>
                    <div v-if="submitError" class="error">{{ submitError }}</div>
                </div>
                <div v-else class="login-to-comment">
                    <p>Please log in to add a comment.</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            comments: [],
            showComments: false,
            newComment: {
                text: '',
                file: null
            },
            imagePreview: null,
            imageError: '',
            submitError: '',
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxDimensions: 2000
        };
    },
    methods: {
        async fetchComments() {
            try {
                const response = await fetch(`/api/comments?post_id=${this.postId}`, { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Failed to fetch comments');
                }
                // console.log(this.postId,"🔥🔥🔥 comments")
                const data = await response.json();
                // console.log(data)
                this.comments = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Error fetching comments:', error);
                this.submitError = 'Failed to load comments.';
            }
        },
        async submitComment() {
            if (!this.newComment.text.trim() && !this.newComment.file) {
                this.submitError = 'Comment cannot be empty.';
                return;
            }
            this.submitError = '';

            const formData = new FormData();
            formData.append('PostID', this.postId);
            formData.append('Text', this.newComment.text);
            if (this.newComment.file) {
                formData.append('Image', this.newComment.file);
            }

            try {
                const response = await fetch('/api/comment/create', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to post comment');
                }

                // Clear the form and refetch comments
                this.newComment.text = '';
                this.newComment.file = null;
                this.removeImage(); // Clear image preview
                this.fetchComments();
                this.showComments = true; // Keep comments visible after posting
            } catch (error) {
                console.error('Error submitting comment:', error);
                this.submitError = error.message;
            }
        },
        formatDate(dateStr) {
            return window.formatDate(dateStr, "YYYY-MM-DD HH:MM:SS");
        },
        getImageUrl(imagePath) {
            if (imagePath && imagePath.String) {
                // If imagePath is a sql.NullString and is valid, use its String value
                if (imagePath.Valid) {
                    const url = imagePath.String;
                    if (url.startsWith('http')) return url;
                    return `${window.location.origin}/web${url.startsWith('/') ? '' : '/'}${url.replace(/\\/g, '/')}`;
                }
            }
            // If imagePath is null, undefined, or an invalid sql.NullString, return empty string
            return '';
        },
        handleImageError(event) {
            const img = event.target;
            img.style.display = 'none'; // Hide broken image icon
        },
        triggerFileInput() {
            this.$refs.commentFileInput.click();
        },
        handleFileDrop(event) {
            const file = event.dataTransfer.files[0];
            if (file) {
                this.validateAndSetImage(file);
            }
        },
        async handleFileUpload(event) {
            const file = event.target.files[0];
            if (file) {
                await this.validateAndSetImage(file);
            }
        },
        async validateAndSetImage(file) {
            this.imageError = '';
            
            // Check file type
            if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
                this.imageError = 'Please upload a valid image file (JPEG, PNG, or GIF)';
                return;
            };

            // Check file size
            if (file.size > this.maxFileSize) {
                this.imageError = 'Image size must not exceed 2MB';
                return;
            };

            // Check image dimensions
            try {
                const dimensions = await this.getImageDimensions(file);
                if (dimensions.width > this.maxDimensions || dimensions.height > this.maxDimensions) {
                    this.imageError = `Image dimensions must not exceed ${this.maxDimensions}x${this.maxDimensions}px`;
                    return;
                }
            } catch (error) {
                this.imageError = 'Failed to validate image dimensions';
                return;
            }

            // If all validations pass, set the file and preview
            this.newComment.file = file;
            this.imagePreview = URL.createObjectURL(file);
        },
        getImageDimensions(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        width: img.width,
                        height: img.height
                    });
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        },
        removeImage() {
            this.newComment.file = null;
            if (this.imagePreview) {
                URL.revokeObjectURL(this.imagePreview);
                this.imagePreview = null;
            }
        }
    },
    mounted() {
        this.fetchComments();
    },
    computed: {
        commentButtonText() {
            return this.showComments ? 'Hide Comments' : `View Comments (${this.comments.length})`;
        }
    },
    watch: {
        postId: function(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.fetchComments();
            }
        }
    }
}; 