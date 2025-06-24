// UsersList Component
const UsersList = {
    template: `
        <div class="users-list card">
            <h3>Users</h3>
            <user-search @user-selected="openChat"></user-search>
            <div class="users-container">
                <div v-if="displayedUsers && displayedUsers.length">
                    <div v-for="user in sortedDisplayedUsers" :key="user.ID" class="user-item" :class="{ 'online-user': user.Online }" @click="openChat(user.ID)">
                        <span class="status-dot" :class="{ 'online': user.Online }"></span>
                        <strong>{{ user.Username }}</strong>
                        <span v-if="user.Nickname"> ({{ user.Nickname }})</span>
                        <span style="color: #888; font-size: 0.9em;">{{ user.Email }}</span>
                    </div>
                </div>
                <div v-else>No users found</div>
            </div>
        </div>
    `,
    data() {
        return {
            users: [],
            searchResults: [],
            searching: false,
            refreshInterval: null
        }
    },
    computed: {
        displayedUsers() {
            return this.searchResults.length > 0 ? this.searchResults : this.users;
        },
        sortedDisplayedUsers() {
            return [...this.displayedUsers].sort((a, b) => {
                if (a.Online !== b.Online) {
                    return a.Online ? -1 : 1;
                }
                if (a.LastMessageTime && b.LastMessageTime) {
                    return new Date(b.LastMessageTime) - new Date(a.LastMessageTime);
                }
                return (a.Username || '').toLowerCase().localeCompare((b.Username || '').toLowerCase());
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
        handleUserStatusChange(event) {
            const { userId, status, username } = event.detail;
            const userIndex = this.users.findIndex(u => u.ID === userId);
            if (userIndex === -1) {
                this.fetchUsers();
                return;
            }
            this.users[userIndex].Online = status === 'online';
            if (status === 'online') {
                this.users[userIndex].LastMessageTime = new Date().toISOString();
            }
        },
        openChat(userOrId) {
            let user = null;
            if (typeof userOrId === 'object') {
                user = userOrId;
                // Normalize ID property for chat compatibility
                if (!user.ID && user.id) {
                    user.ID = user.id;
                }
                // Normalize Username property for chat compatibility
                if (!user.Username && user.username) {
                    user.Username = user.username;
                }
            } else {
                user = this.displayedUsers.find(u => u.ID === userOrId || u.id === userOrId);
            }
            if (user) {
                this.$emit('open-chat', user);
            }
        }
    },
    mounted() {
        this.fetchUsers();
        window.addEventListener('user-status-change', this.handleUserStatusChange);
        this.refreshInterval = setInterval(this.fetchUsers, 30000);
    },
    beforeUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        window.removeEventListener('user-status-change', this.handleUserStatusChange);
    },
    components: {
        'user-search': window.UserSearch
    }
};

// Remove export default and attach to window for global access
window.UsersList = UsersList; 