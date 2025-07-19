// UserSearch Component
const UserSearch = {
    template: `
        <div class="user-search">
            <input type="text" v-model="searchQuery" @input="onInput" placeholder="Search users by username, email, or nickname..." class="form-control" />
            <div v-if="searching" class="search-loading">Searching...</div>
            <ul v-if="Array.isArray(results) && results.length > 0" class="search-results">
                <li v-for="user in results" :key="user.id" class="search-result-item">
                    <img
                        :src="getAvatarUrl(user.avatar || user.Avatar)"
                        class="avatar-small profile-link-avatar"
                        style="width:24px;height:24px;border-radius:50%;margin-right:8px;cursor:pointer;vertical-align:middle;"
                        :alt="user.username + ' avatar'"
                        @click.stop="goToProfile(user.id || user.ID)"
                    >
                    <strong @click="selectUser(user)" style="cursor:pointer;">{{ user.username }}</strong>
                    <span v-if="user.nickname"> ({{ user.nickname }})</span>
                    <span style="color: #888; font-size: 0.9em;">{{ user.email }}</span>
                </li>
            </ul>
            <div v-if="searchQuery.length >= 2 && !searching && Array.isArray(results) && results.length === 0" class="no-results">No users found.</div>
        </div>
    `,
    data() {
        return {
            searchQuery: '',
            results: [],
            searching: false,
            debounceTimeout: null
        };
    },
    methods: {
        onInput() {
            clearTimeout(this.debounceTimeout);
            if (this.searchQuery.length < 1) {
                this.results = [];
                this.searching = false;
                return;
            }
            this.searching = true;
            this.debounceTimeout = setTimeout(this.fetchResults, 300);
        },
        async fetchResults() {
            try {
                const response = await fetch(`/api/search/users?q=${encodeURIComponent(this.searchQuery)}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to search users');
                const data = await response.json();
                this.results = Array.isArray(data) ? data : [];
            } catch (error) {
                this.results = [];
            } finally {
                this.searching = false;
            }
        },
        selectUser(user) {
            this.$emit('user-selected', user);
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
            this.$root.viewUserProfile(userId);
        }
    }
};

// Attach to window for global use
window.UserSearch = UserSearch; 