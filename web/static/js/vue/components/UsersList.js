// UsersList Component
const UsersList = {
    props: {
        users: {
            type: Array,
            default: () => []
        }
    },
    template: `
        <div class="users-list card">
            <h3 class="users-list-header" style="display: flex; align-items: center; justify-content: space-between;">
                Users
                <span v-if="myId && totalUnreadCount > 0" class="unread-badge right-badge">{{ totalUnreadCount }}</span>
            </h3>
            <user-search @user-selected="openChat"></user-search>
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
                <div v-else>No users found</div>
            </div>
        </div>
    `,
    data() {
        return {
            users: [],
            searchResults: [],
            searching: false,
            refreshInterval: null,
            unreadCounts: {} // Track unread counts by user ID
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
                return 0;
            });
        },
        myId() {
            return this.$root.currentUser?.id || this.$root.currentUser?.value?.id || null;
        },
        totalUnreadCount() {
            if (!this.myId) return 0;
            return Object.entries(this.unreadCounts)
                .filter(([userId, count]) => parseInt(userId) !== this.myId)
                .reduce((a, [, count]) => a + (count || 0), 0);
        }
    },
    data() {
        return {
            searchResults: [],
            searching: false,
            refreshInterval: null
        }
    },
    data() {
        return {
            searchResults: [],
            searching: false,
            refreshInterval: null
        }
    },
    methods: {
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
            this.unreadCounts[userId] = count;
        },
        openChat(userOrId) {
            const existingClose = document.querySelector('.close-span');
            if (existingClose) existingClose.click();
            let user = null;
            if (typeof userOrId === 'object') {
                user = userOrId;
                if (!user.ID && user.id) {
                    user.ID = user.id;
                }
                if (!user.Username && user.username) {
                    user.Username = user.username;
                }
            } else {
                user = this.displayedUsers.find(u => u.ID === userOrId || u.id === userOrId);
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
        }
    },
    mounted() {
        this.fetchUsers();
        window.addEventListener('user-status-change', this.handleUserStatusChange);
        window.addEventListener('unread-count-update', this.handleUnreadCountUpdate);
        this.refreshInterval = setInterval(this.fetchUsers, 30000);

        // Fetch unread counts on page load
        fetch('/api/unread-counts', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                this.unreadCounts = data || {};
            })
            .catch(() => {
                this.unreadCounts = {};
            });
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
