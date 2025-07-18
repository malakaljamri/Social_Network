// CreateGroupPostModal Component
const CreateGroupPostModal = {
    props: {
        groupId: {
            type: Number,
            required: true
        }
    },
    template: `
        <teleport to="body">
            <div class="modal-overlay layer-modal" @click.self="close">
                <div class="modal-content layer-modal">
                    <h2>Create Group Post</h2>
                    <form @submit.prevent="submitGroupPost">
                        <input type="text" v-model="form.title" placeholder="Title" required minlength="3" maxlength="100">
                        <textarea v-model="form.content" placeholder="Content" required minlength="10" maxlength="5000"></textarea>
                        <select v-model="form.category_id" required>
                            <option value="">Select a category</option>
                            <option v-for="cat in categories" :key="cat.ID" :value="cat.ID">{{ cat.Name }}</option>
                        </select>
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
                        <button type="submit" class="button" :disabled="form.loading">Create</button>
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
                category_id: '',
                loading: false,
                error: '',
                file: null,
                imageError: ''
            },
            categories: [],
            imagePreview: null,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxDimensions: 2000
        };
    },
    inject: ['currentUser'],
    computed: {
        currentUserValue() {
            return this.currentUser.value;
        }
    },
    methods: {
        async fetchCategories() {
            if (!this.currentUserValue?.isLoggedIn) {
                this.categories = [];
                this.form.error = 'You must be logged in to create a group post';
                return;
            }
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch categories');
                const data = await response.json();
                this.categories = data;
            } catch (error) {
                this.categories = [];
                this.form.error = 'Failed to load categories. Please try again.';
            }
        },
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
            this.form.file = file;
            this.imagePreview = URL.createObjectURL(file);
        },
        getImageDimensions(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = function() {
                    resolve({ width: img.width, height: img.height });
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        },
        removeImage() {
            this.form.file = null;
            this.imagePreview = null;
        },
        async submitGroupPost() {
            if (!this.currentUserValue?.isLoggedIn) {
                this.form.error = 'You must be logged in to create a group post';
                return;
            }
            this.form.loading = true;
            this.form.error = '';
            try {
                const formData = new FormData();
                formData.append('title', this.form.title);
                formData.append('content', this.form.content);
                formData.append('category_id', this.form.category_id ? Number(this.form.category_id) : '');
                formData.append('group_id', this.groupId);
                if (this.form.file) {
                    formData.append('image', this.form.file);
                }
                const response = await fetch('/api/groups/posts/create', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to create group post');
                }
                const data = await response.json();
                this.$emit('created', data);
                this.close();
            } catch (e) {
                this.form.error = e.message || 'Network error';
            } finally {
                this.form.loading = false;
            }
        },
        close() {
            this.$emit('close');
        }
    },
    mounted() {
        this.fetchCategories();
    },
    emits: ['close', 'created']
};
window.M_GroupCreatePost = CreateGroupPostModal;
// No mount here, will be registered globally. 