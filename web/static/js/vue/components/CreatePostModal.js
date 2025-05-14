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
                            <option v-for="cat in categories" :key="cat.ID" :value="cat.ID">[[cat.Name]]</option>
                        </select>
                        <select v-model="form.privacy" required>
                            <option value="public">Public</option>
                            <option value="almost_private">Followers</option>
                            <option value="private">Chosen followers</option>
                        </select>
                        <input type="file" @change="handleFileUpload" accept="image/jpeg, image/png, image/gif">
                        <button type="submit" class="button" :disabled="form.loading">Create Post</button>
                        <div v-if="form.error" class="error">[[form.error]]</div>
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
    methods: {
        async fetchCategories() {
            const currentUser = this.$root.currentUser || (this.currentUser && this.currentUser.value);
            if (!currentUser || !currentUser.isLoggedIn) {
                this.categories = [];
                return;
            }
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                const data = await response.json();
                this.categories = data;
            } catch (error) {
                this.categories = [];
            }
        },
        handleFileUpload(event) {
            this.form.file = event.target.files[0];
        },
        async submitPost() {
            this.form.loading = true;
            this.form.error = '';
            try {
                const formData = new FormData();
                formData.append('title', this.form.title);
                formData.append('content', this.form.content);
                formData.append('category_id', this.form.category_id);
                formData.append('privacy', this.form.privacy);
                if (this.form.file) {
                    formData.append('file', this.form.file);
                }
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                if (!response.ok) {
                    const err = await response.json();
                    this.form.error = err.error || 'Failed to create post';
                    this.form.loading = false;
                    return;
                }
                const data = await response.json();
                this.$emit('created', data);
                window.dispatchEvent(new Event('post-created'));
                this.close();
            } catch (e) {
                this.form.error = 'Network error';
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

// No mount here, will be registered globally. 