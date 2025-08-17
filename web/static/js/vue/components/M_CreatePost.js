// CreatePostModal Component
const CreatePostModal = {
    props: {
        groupId: {
            type: Number,
            default: null
        }
    },
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>{{ groupId ? 'Create Group Post' : 'Create Post' }}</h2>
                    <form @submit.prevent="submitPost">
                        <input type="text" v-model="form.title" placeholder="Title" required minlength="3" maxlength="20">
                        <textarea v-model="form.content" placeholder="Content (max 90 characters)" required maxlength="90"></textarea>
                        
                        <!-- Category Selection -->
                        <div class="category-select-container">
                            <input 
                                type="text" 
                                v-model="categorySearch" 
                                placeholder="Search categories..." 
                                class="category-search"
                            >
                            <div class="categories-container">
                                <div v-if="loading" class="loading">Loading categories...</div>
                                <div v-else-if="error" class="error">{{ error }}</div>
                                <div v-else class="categories-list">
                                    <div v-for="category in filteredCategories" 
                                         :key="category.ID" 
                                         class="category-item">
                                        <input 
                                            type="checkbox" 
                                            :id="'cat-' + category.ID" 
                                            :value="category.ID"
                                            v-model="form.category_ids"
                                        >
                                        <label :for="'cat-' + category.ID">
                                            {{ category.Name }}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Privacy settings - different for group vs regular posts -->
                        <select v-model="form.privacy" required>
                            <option v-if="!groupId" value="public">Public</option>
                            <option v-if="!groupId" value="almost_private">Followers</option>
                            <option v-if="!groupId" value="private">Chosen followers</option>
                            <option v-if="groupId" value="public">Public</option>
                            <option v-if="groupId" value="private">Private</option>
                        </select>

                        <!-- Private Viewers Selection - only for regular posts -->
                        <div v-if="!groupId && form.privacy === 'private'" class="private-viewers-section">
                            <input 
                                type="text" 
                                v-model="followerSearch" 
                                placeholder="Search followers..." 
                                class="follower-search"
                            >
                            <div class="followers-container">
                                <div v-if="loadingFollowers" class="loading">Loading followers...</div>
                                <div v-else-if="followersError" class="error">{{ followersError }}</div>
                                <div v-else class="followers-list">
                                    <div v-for="follower in filteredFollowers" 
                                         :key="follower.ID" 
                                         class="follower-item">
                                        <input 
                                            type="checkbox" 
                                            :id="'follower-' + follower.ID" 
                                            :value="follower.ID"
                                            v-model="form.chosen_followers"
                                        >
                                        <label :for="'follower-' + follower.ID">
                                            {{ follower.Username }}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Image Upload Section -->
                        <div class="image-upload-section">
                            <div class="image-upload-container" 
                                 @click="triggerFileInput" 
                                 @dragover.prevent 
                                 @drop.prevent="handleFileDrop"
                                 :class="{ 'has-image': imagePreview }">
                                <input 
                                    type="file" 
                                    ref="fileInput"
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
                            <div v-if="form.imageError" class="error">{{ form.imageError }}</div>
                        </div>

                        <button type="submit" class="button" :disabled="form.loading">
                            {{ groupId ? 'Create Group Post' : 'Create Post' }}
                        </button>
                        <div v-if="form.error" class="error">{{ form.error }}</div>
                    </form>
                    <button class="button secondary-button" @click="close">Cancel</button>
                </div>
            </div>
        </teleport>
    `,
    data() {
        return {
            form: {
                title: '',
                content: '',
                category_ids: [],
                privacy: 'public',
                chosen_followers: [],
                file: null,
                loading: false,
                error: '',
                imageError: ''
            },
            categories: [],
            followers: [],
            categorySearch: '',
            followerSearch: '',
            loading: false,
            loadingFollowers: false,
            error: '',
            followersError: '',
            imagePreview: null,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxDimensions: 2000
        };
    },
    inject: ['currentUser'],
    computed: {
        currentUserValue() {
            return this.currentUser.value;
        },
        filteredCategories() {
            if (!this.categorySearch) return this.categories;
            const searchTerm = this.categorySearch.toLowerCase();
            return this.categories.filter(cat => 
                cat.Name.toLowerCase().includes(searchTerm)
            );
        },
        filteredFollowers() {
            if (!this.followerSearch) return this.followers;
            const searchTerm = this.followerSearch.toLowerCase();
            return this.followers.filter(follower => 
                follower.Username.toLowerCase().includes(searchTerm)
            );
        }
    },
    methods: {
        triggerFileInput() {
            this.$refs.fileInput.click();
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
            this.form.imageError = '';
            
            // Check file type
            if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
                this.form.imageError = 'Please upload a valid image file (JPEG, PNG, or GIF)';
                return;
            }

            // Check file size
            if (file.size > this.maxFileSize) {
                this.form.imageError = 'Image size must not exceed 2MB';
                return;
            }

            // Check image dimensions
            try {
                const dimensions = await this.getImageDimensions(file);
                if (dimensions.width > this.maxDimensions || dimensions.height > this.maxDimensions) {
                    this.form.imageError = `Image dimensions must not exceed ${this.maxDimensions}x${this.maxDimensions}px`;
                    return;
                }
            } catch (error) {
                this.form.imageError = 'Failed to validate image dimensions';
                return;
            }

            // If all validations pass, set the file and preview
            this.form.file = file;
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
            this.form.file = null;
            if (this.imagePreview) {
                URL.revokeObjectURL(this.imagePreview);
                this.imagePreview = null;
            }
        },
        async fetchCategories() {
            this.loading = true;
            this.error = '';
            if (!this.currentUserValue?.isLoggedIn) {
                this.categories = [];
                this.error = 'You must be logged in to create a post';
                return;
            }
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }
                const data = await response.json();
                this.categories = data;
            } catch (error) {
                console.error('Error fetching categories:', error);
                this.error = 'Failed to load categories. Please try again.';
            } finally {
                this.loading = false;
            }
        },
        async fetchFollowers() {
            if (this.form.privacy !== 'private' || this.groupId) return;
            
            this.loadingFollowers = true;
            this.followersError = '';
            try {
                const response = await fetch('/api/user/followers', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Failed to fetch followers');
                }
                const data = await response.json();
                this.followers = data;
            } catch (error) {
                console.error('Error fetching followers:', error);
                this.followersError = 'Failed to load followers. Please try again.';
            } finally {
                this.loadingFollowers = false;
            }
        },
        async submitPost() {
            if (!this.currentUserValue?.isLoggedIn) {
                this.form.error = 'You must be logged in to create a post';
                return;
            }

            if (this.form.category_ids.length === 0) {
                this.form.error = 'Please select at least one category';
                return;
            }

            if (!this.groupId && this.form.privacy === 'private' && this.form.chosen_followers.length === 0) {
                this.form.error = 'Please select at least one follower for private posts';
                return;
            }

            this.form.loading = true;
            this.form.error = '';
            try {
                const formData = new FormData();
                formData.append('Title', this.form.title);
                formData.append('Text', this.form.content);
                formData.append('CategoryIDs', JSON.stringify(this.form.category_ids));
                formData.append('Privacy', this.form.privacy);
                if (!this.groupId && this.form.privacy === 'private') {
                    formData.append('ChosenFollowers', JSON.stringify(this.form.chosen_followers));
                }
                if (this.groupId) {
                    formData.append('GroupID', this.groupId.toString());
                }
                if (this.form.file) {
                    formData.append('Image', this.form.file);
                }

                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to create post');
                }

                const data = await response.json();
                
                // Reset form
                this.form = {
                    title: '',
                    content: '',
                    category_ids: [],
                    privacy: 'public',
                    chosen_followers: [],
                    file: null,
                    loading: false,
                    error: '',
                    imageError: ''
                };
                this.categorySearch = '';
                this.followerSearch = '';

                this.$emit('created', data);
                window.dispatchEvent(new Event('post-created'));
                this.close();
            } catch (e) {
                console.error('Error creating post:', e);
                this.form.error = e.message || 'Network error';
            } finally {
                this.form.loading = false;
            }
        },
        close() {
            this.$emit('close');
        }
    },
    watch: {
        'form.privacy'(newValue) {
            if (newValue === 'private' && !this.groupId) {
                this.fetchFollowers();
            }
        }
    },
    mounted() {
        this.fetchCategories();
    },
    emits: ['close', 'created']
};

// No mount here, will be registered globally.
window.M_CreatePost = CreatePostModal; 