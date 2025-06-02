// CreatePostModal Component
const CreatePostModal = {
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Create Post</h2>
                    <form @submit.prevent="submitPost">
                        <input type="text" v-model="form.title" placeholder="Title" required minlength="3" maxlength="100">
                        <textarea v-model="form.content" placeholder="Content" required minlength="10" maxlength="5000"></textarea>
                        <select v-model="form.category_id" required>
                            <option value="">Select a category</option>
                            <option v-for="cat in categories" :key="cat.ID" :value="cat.ID">{{ cat.Name }}</option>
                        </select>
                        <select v-model="form.privacy" required>
                            <option value="public">Public</option>
                            <option value="almost_private">Followers</option>
                            <option value="private">Chosen followers</option>
                        </select>
                        <input type="file" @change="handleFileUpload" accept="image/jpeg, image/png, image/gif">
                        <button type="submit" class="button" :disabled="form.loading">Create Post</button>
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
                privacy: 'public',
                file: null,
                loading: false,
                error: ''
            },
            categories: []
        };
    },
    inject: ['currentUser'],
    methods: {
        async fetchCategories() {
            console.log('Fetching categories, currentUser:', this.currentUser);
            if (!this.currentUser?.isLoggedIn) {
                console.warn('User not logged in, cannot fetch categories');
                this.categories = [];
                return;
            }
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }
                const data = await response.json();
                console.log('Fetched categories:', data);
                this.categories = data;
            } catch (error) {
                console.error('Error fetching categories:', error);
                this.categories = [];
                this.form.error = 'Failed to load categories. Please try again.';
            }
        },
        handleFileUpload(event) {
            this.form.file = event.target.files[0];
        },
        async submitPost() {
            if (!this.currentUser?.isLoggedIn) {
                this.form.error = 'You must be logged in to create a post';
                return;
            }

            this.form.loading = true;
            this.form.error = '';
            try {
                const formData = new FormData();
                formData.append('Title', this.form.title);
                formData.append('Text', this.form.content);
                formData.append('CategoryID', Number(this.form.category_id));
                formData.append('Privacy', this.form.privacy);
                if (this.form.file) {
                    formData.append('Image', this.form.file);
                }

                console.log('Submitting post with data:', {
                    title: this.form.title,
                    content: this.form.content,
                    category_id: this.form.category_id,
                    privacy: this.form.privacy,
                    hasFile: !!this.form.file
                });

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
                console.log('Post created successfully:', data);
                
                // Reset form
                this.form = {
                    title: '',
                    content: '',
                    category_id: '',
                    privacy: 'public',
                    file: null,
                    loading: false,
                    error: ''
                };

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
            console.log('Closing modal');
            this.$emit('close');
        }
    },
    mounted() {
        console.log('CreatePostModal mounted');
        this.fetchCategories();
    },
    emits: ['close', 'created']
};

// No mount here, will be registered globally.
window.M_CreatePost = CreatePostModal; 