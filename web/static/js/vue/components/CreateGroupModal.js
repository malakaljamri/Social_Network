// CreateGroupModal Component
const CreateGroupModal = {
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Create Group</h2>
                    <form @submit.prevent="submitGroup">
                        <input type="text" v-model="form.name" placeholder="Group Name" required minlength="3" maxlength="50">
                        <textarea v-model="form.description" placeholder="Description" required minlength="10" maxlength="500"></textarea>
                        <select v-model="form.privacy" required>
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                        </select>
                        <button type="submit" class="button" :disabled="form.loading">Create Group</button>
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
                name: '',
                description: '',
                privacy: 'public',
                loading: false,
                error: ''
            }
        };
    },
    methods: {
        async submitGroup() {
            this.form.loading = true;
            this.form.error = '';
            try {
                const response = await fetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: this.form.name,
                        description: this.form.description,
                        privacy: this.form.privacy
                    })
                });
                if (!response.ok) {
                    const err = await response.json();
                    this.form.error = err.error || 'Failed to create group';
                    this.form.loading = false;
                    return;
                }
                const data = await response.json();
                this.$emit('created', data);
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
    }
};

// No mount here, will be registered globally. 