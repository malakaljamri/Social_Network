// CreateGroupEventModal Component
const CreateGroupEventModal = {
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
                    <h2>Create Group Event</h2>
                    <form @submit.prevent="submitGroupEvent">
                        <input type="text" v-model="form.title" placeholder="Title" required minlength="3" maxlength="100">
                        <textarea v-model="form.description" placeholder="Description" required minlength="5" maxlength="1000"></textarea>
                        <input type="date" v-model="form.date" :min="today" required>
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
                description: '',
                date: '',
                loading: false,
                error: ''
            },
            today: new Date().toISOString().split('T')[0]
        };
    },
    inject: ['currentUser'],
    methods: {
        async submitGroupEvent() {
            if (!this.currentUser?.isLoggedIn) {
                this.form.error = 'You must be logged in to create a group event';
                return;
            }
            this.form.loading = true;
            this.form.error = '';
            try {
                const payload = {
                    title: this.form.title,
                    description: this.form.description,
                    event_date: this.form.date,
                    group_id: this.groupId
                };
                const response = await fetch('/api/groups/events/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to create group event');
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
    emits: ['close', 'created']
};
window.M_GroupCreateEvent = CreateGroupEventModal;
// No mount here, will be registered globally. 