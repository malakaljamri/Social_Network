// UsersList Component
const UsersList = {
    template: `
        <div class="users-list card">
            <h3>Users</h3>
            <user-search @user-selected="openChat"></user-search>
            <div class="users-container">
                <div v-if="displayedUsers && displayedUsers.length">
                    <div v-for="user in sortedDisplayedUsers" :key="user.ID" class="user-item" :class="{ 'online-user': user.Online }">
                        <img
                            :src="getAvatarUrl(user.Avatar)"
                            class="avatar-small profile-link-avatar"
                            style="width:24px;height:24px;border-radius:50%;margin-right:8px;cursor:pointer;vertical-align:middle;"
                            :alt="user.Username + ' avatar'"
                            @click.stop="goToProfile(user.ID)"
                        >
                        <span class="status-dot" :class="{ 'online': user.Online }"></span>
                        <strong @click="openChat(user.ID)" 
                               style="cursor:pointer;" 
                               @mouseenter="showTooltip($event, user)" 
                               @mouseleave="hideTooltip">{{ user.Username }}</strong>
                        <span v-if="user.Nickname"> ({{ user.Nickname }})</span>
                        <span v-if="unreadCounts[user.ID] > 0" class="unread-badge">{{ unreadCounts[user.ID] }}</span>
                    </div>
                </div>
                <div v-else>No users found</div>
            </div>
            <!-- Custom Tooltip -->
            <div v-if="tooltip.show" 
                 class="custom-tooltip" 
                 :style="tooltip.style">
                {{ tooltip.content }}
            </div>
        </div>
    `,
    data() {
        return {
            users: [],
            searchResults: [],
            searching: false,
            refreshInterval: null,
            unreadCounts: {} // Track unread counts by user ID,
            tooltip: {
                show: false,
                content: '',
                style: {}
            }
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
        handleUnreadCountUpdate(event) {
            const { userId, count } = event.detail;
            this.$set(this.unreadCounts, userId, count);
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
        },
        getAvatarUrl(avatar) {
            if (!avatar) {
                return '/static/images/default-avatar.png';
            }
            if (avatar.startsWith('http')) {
                return avatar;
            }
            return `/web/${avatar}`;
        },
        goToProfile(userId) {
            this.$root.currentView = 'profile';
            this.$root.viewUserProfile(userId);
        },
        getUserTooltip(user) {
            let tooltip = `Email: ${user.Email}`;
            if (user.Nickname) {
                tooltip += `\nNickname: ${user.Nickname}`;
            }
            return tooltip;
        },
        showTooltip(event, user) {
            const rect = event.target.getBoundingClientRect();
            this.tooltip.content = this.getUserTooltip(user);
            this.tooltip.style = {
                position: 'fixed',
                top: (rect.bottom + 5) + 'px',
                left: rect.left + 'px',
                zIndex: '1000'
            };
            this.tooltip.show = true;
        },
        hideTooltip() {
            this.tooltip.show = false;
        }
    },
    mounted() {
        this.fetchUsers();
        window.addEventListener('user-status-change', this.handleUserStatusChange);
        window.addEventListener('unread-count-update', this.handleUnreadCountUpdate);
        this.refreshInterval = setInterval(this.fetchUsers, 30000);
    },
    beforeUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        window.removeEventListener('user-status-change', this.handleUserStatusChange);
        window.removeEventListener('unread-count-update', this.handleUnreadCountUpdate);
    },
    components: {
        'user-search': window.UserSearch
    }
};

// Remove export default and attach to window for global access
window.UsersList = UsersList;
