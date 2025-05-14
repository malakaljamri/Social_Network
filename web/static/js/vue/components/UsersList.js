// UsersList Component
const UsersList = {
    template: `
        <div class="users-list card">
            <h3>Users</h3>
            <div class="users-container">
                <div v-if="loading" class="loading-indicator">Loading users...</div>
                <div v-else-if="onlineUsers.length" class="users-list-content">
                    <div v-for="user in sortedUsers" 
                         :key="user.id" 
                         class="user-item profile-link"
                         @click="openUserChat(user.id)">
                        <span class="online-indicator" :class="{'is-online': user.online}"></span>
                        <span class="username">{{ user.username }}</span>
                        <span class="view-profile-hint">Chat</span>
                    </div>
                </div>
                <div v-else class="no-users">No users online</div>
            </div>
        </div>
    `,
    setup() {
        const { state: wsState } = Vue.inject('websocket');
        const currentUser = Vue.inject('currentUser');
        const loading = Vue.ref(true);

        // Computed property for sorted users
        const sortedUsers = Vue.computed(() => {
            if (!currentUser.isLoggedIn) return [];
            return [...wsState.onlineUsers].sort((a, b) => {
                // First sort by online status
                if (a.online !== b.online) {
                    return b.online ? 1 : -1;
                }
                // Then by last message time
                const aLastMessage = wsState.chatWindows.get(a.id)?.slice(-1)[0]?.timestamp || 0;
                const bLastMessage = wsState.chatWindows.get(b.id)?.slice(-1)[0]?.timestamp || 0;
                if (aLastMessage !== bLastMessage) {
                    return bLastMessage - aLastMessage;
                }
                // Finally by username
                return a.username.localeCompare(b.username);
            });
        });

        // Open chat with user
        function openUserChat(userId) {
            if (!currentUser.isLoggedIn) return;
            
            // Create chat window if it doesn't exist
            if (!wsState.chatWindows.has(userId)) {
                wsState.chatWindows.set(userId, []);
            }

            // Emit event to show chat window
            window.dispatchEvent(new CustomEvent('show-chat', {
                detail: { userId }
            }));
        }

        // Watch for onlineUsers changes to update loading
        Vue.watch(
            () => wsState.onlineUsers.length,
            (newLen) => {
                loading.value = false;
            },
            { immediate: true }
        );
        // Watch for currentUser changes to reset loading
        Vue.watch(
            () => currentUser.isLoggedIn,
            (val) => {
                loading.value = true;
            }
        );

        return {
            onlineUsers: wsState.onlineUsers,
            sortedUsers,
            openUserChat,
            loading,
            currentUser
        };
    }
};

// No mount here, will be registered globally. 