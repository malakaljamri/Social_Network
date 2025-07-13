// UsersList Component
const UsersList = {
    props: {
        users: {
            type: Array,
            default: () => []
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    template: `
        <div class="users-list card">
            <h3 class="users-list-header" style="display: flex; align-items: center; justify-content: space-between;">
                Users
                <span v-if="myId && totalUnreadCount > 0" class="unread-badge right-badge">{{ totalUnreadCount }}</span>
            </h3>
            <input
                type="text"
                v-model="searchQuery"
                @focus="searchBarFocused = true"
                @blur="searchBarFocused = false"
                placeholder="Search users by username..."
                class="search-input"
                style="width: 100%; margin-bottom: 10px; padding: 6px; border-radius: 4px; border: 1px solid #ccc;"
            >
            <div class="users-container">
                <div v-if="displayedUsers && displayedUsers.length">
                    <div v-for="user in sortedDisplayedUsers" :key="user.ID" class="user-item user-item-flex" :class="{ 'online-user': user.Online }">
                        <img
                            :src="getAvatarUrl(user.Avatar)"
                            class="avatar-small profile-link-avatar"
                            style="width:24px;height:24px;border-radius:50%;margin-right:8px;cursor:pointer;vertical-align:middle;"
                            :alt="user.Username + ' avatar'"
                            @click.stop="goToProfile(user.ID)"
                        >
                        <span class="status-dot" :class="{ 'online': user.Online }"></span>
                        <strong @click="openChat(user.ID)" style="cursor:pointer;" :title="getUserTooltip(user)">{{ user.Username }}</strong>
                        <span v-if="user.Nickname"> ({{ user.Nickname }})</span>
                        <span v-if="myId && user.ID !== myId && unreadCounts[user.ID] > 0" class="unread-badge right-badge">{{ unreadCounts[user.ID] }}</span>
                    </div>
                </div>
                <div v-else>No users found. Please check your connection or try logging in again.</div>
            </div>
        </div>
    `,
    data() {
        return {
            searchResults: [],
            searching: false,
            refreshInterval: null,
            unreadCounts: {},
            searchQuery: '',
            searchBarFocused: false
        }
    },
    computed: {
        displayedUsers() {
            // Only filter if search bar is focused and has a value
            if (this.searchBarFocused && this.searchQuery.trim()) {
                return this.sortedDisplayedUsersFiltered();
            }
            // Otherwise, show all users
            return this.sortedDisplayedUsersAll();
        },
        sortedDisplayedUsers() {
            return [...this.displayedUsers].sort((a, b) => {
                if (a.Online !== b.Online) {
                    return a.Online ? -1 : 1;
                }
                return 0;
            });
        },
        myId() {
            return (this.currentUser && this.currentUser.id) || null;
        },
        totalUnreadCount() {
            if (!this.myId) return 0;
            return Object.entries(this.unreadCounts)
                .filter(([userId, count]) => parseInt(userId) !== this.myId)
                .reduce((a, [, count]) => a + (count || 0), 0);
        }
    },
    watch: {
        users(newUsers) {
            if (!this.searching) {
                this.searchResults = [];
            }
        }
    },
    methods: {
        handleUserStatusChange(event) {
            const { userId, status, username } = event.detail;
            const userIndex = this.users.findIndex(u => u.ID === userId);
            if (userIndex === -1) {
                // this.fetchUsers(); // Removed because fetchUsers is not defined
                return;
            }
            this.users[userIndex].Online = status === 'online';
            if (status === 'online') {
                this.users[userIndex].LastMessageTime = new Date().toISOString();
            }
        },
        handleUnreadCountUpdate(event) {
            const { userId, count } = event.detail;
            this.unreadCounts[userId] = count;
        },
        openChat(userOrId) {
            const existingClose = document.querySelector('.close-span');
            if (existingClose) existingClose.click();
            let user = null;
            if (typeof userOrId === 'object') {
                user = userOrId;
                // Normalize ID and Username
                if (!user.ID && user.id) {
                    user.ID = user.id;
                }
                if (!user.id && user.ID) {
                    user.id = user.ID;
                }
                if (!user.Username && user.username) {
                    user.Username = user.username;
                }
                if (!user.username && user.Username) {
                    user.username = user.Username;
                }
            } else {
                user = this.displayedUsers.find(u => u.ID === userOrId || u.id === userOrId);
                if (user) {
                    if (!user.ID && user.id) user.ID = user.id;
                    if (!user.id && user.ID) user.id = user.ID;
                    if (!user.Username && user.username) user.Username = user.username;
                    if (!user.username && user.Username) user.username = user.Username;
                }
            }
            if (user) {
                this.unreadCounts[user.ID] = 0;
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
        sortedDisplayedUsersAll() {
            // Sort all users (online first, then alphabetically)
            return [...this.users].sort((a, b) => {
                if (a.Online !== b.Online) {
                    return a.Online ? -1 : 1;
                }
                return (a.Username || a.username || '').localeCompare(b.Username || b.username || '');
            });
        },
        sortedDisplayedUsersFiltered() {
            // Filter and sort users based on searchQuery
            const filtered = this.users.filter(user =>
                (user.Username || user.username || '').toLowerCase().includes(this.searchQuery.toLowerCase())
            );
            return filtered.sort((a, b) => {
                if (a.Online !== b.Online) {
                    return a.Online ? -1 : 1;
                }
                return (a.Username || a.username || '').localeCompare(b.Username || b.username || '');
            });
        },
        resetSearch() {
            this.searchQuery = '';
            this.searchBarFocused = false;
        }
    },
    mounted() {
        window.addEventListener('user-status-change', this.handleUserStatusChange);
        window.addEventListener('unread-count-update', this.handleUnreadCountUpdate);
        this.refreshInterval = setInterval(() => {
            if (this.$root && typeof this.$root.fetchUsers === 'function') {
                this.$root.fetchUsers();
            }
        }, 30000); // 30 seconds
        // Fetch unread counts on page load only if user is logged in
        if (this.currentUser?.value?.isLoggedIn || this.currentUser?.isLoggedIn) {
            fetch('/api/unread-counts', { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    this.unreadCounts = data || {};
                })
                .catch(() => {
                    this.unreadCounts = {};
                });
        }
        // Expose resetSearch for root app
        if (this.$root) {
            this.$root.$on && this.$root.$on('reset-user-search', this.resetSearch);
        }
    },
    beforeUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        window.removeEventListener('user-status-change', this.handleUserStatusChange);
        window.removeEventListener('unread-count-update', this.handleUnreadCountUpdate);
    },
    components: {
        // 'user-search': window.UserSearch // Removed
    }
};

// Remove export default and attach to window for global access
window.UsersList = UsersList;
