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
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Create Group Post</h2>
                    <form @submit.prevent="submitGroupPost">
                        <input type="text" v-model="form.title" placeholder="Title" required minlength="3" maxlength="100">
                        <textarea v-model="form.content" placeholder="Content" required minlength="10" maxlength="5000"></textarea>
                        <select v-model="form.category_id" required>
                            <option value="">Select a category</option>
                            <option v-for="cat in categories" :key="cat.ID" :value="cat.ID">{{ cat.Name }}</option>
                        </select>
                        <select v-model="form.privacy_setting" required>
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                        </select>
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
                privacy_setting: 'public',
                loading: false,
                error: ''
            },
            categories: []
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
        async submitGroupPost() {
            if (!this.currentUserValue?.isLoggedIn) {
                this.form.error = 'You must be logged in to create a group post';
                return;
            }
            this.form.loading = true;
            this.form.error = '';
            try {
                const payload = {
                    title: this.form.title,
                    content: this.form.content,
                    category_id: this.form.category_id ? Number(this.form.category_id) : null,
                    privacy_setting: this.form.privacy_setting,
                    group_id: this.groupId
                };
                const response = await fetch('/api/groups/posts/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
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