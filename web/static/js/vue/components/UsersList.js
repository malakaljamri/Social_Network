// UsersList Component
const UsersList = {
    template: `
        <div class="users-list card">
            <h3>Users</h3>
            <div class="users-container">
                <div v-if="users && users.length">
                    <div v-for="user in sortedUsers" :key="user.ID" class="user-item" :class="{ 'online-user': user.Online }" @click="openChat(user.ID)">
                        <span class="status-dot" :class="{ 'online': user.Online }"></span>
                        {{ user.Username }}
                    </div>
                </div>
                <div v-else>No users found</div>
            </div>
        </div>
    `,
    data() {
        return {
            users: [],
            refreshInterval: null
        }
    },
    computed: {
        sortedUsers() {
            return [...this.users].sort((a, b) => {
                // First sort by online status
                if (a.Online !== b.Online) {
                    return a.Online ? -1 : 1;
                }
                // Then sort by last message time if available
                if (a.LastMessageTime && b.LastMessageTime) {
                    return new Date(b.LastMessageTime) - new Date(a.LastMessageTime);
                }
                // If no messages or equal times, sort alphabetically by username
                return a.Username.toLowerCase().localeCompare(b.Username.toLowerCase());
            });
        }
    },
    methods: {
        async fetchUsers() {
            try {
                const response = await fetch('/api/users', {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to fetch users');
                this.users = await response.json();
            } catch (error) {
                console.error('Error fetching users:', error);
                this.users = [];
            }
        },
        openChat(userId) {
            // Emit event to parent to open chat
            this.$emit('open-chat', userId);
        }
    },
    mounted() {
        this.fetchUsers();
        // Refresh users list every 30 seconds
        this.refreshInterval = setInterval(this.fetchUsers, 30000);
    },
    beforeUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
};

// Remove export default and attach to window for global access
window.UsersList = UsersList; 