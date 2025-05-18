// NavBar Component
const NavBar = {
    template: `
        <nav class="navbar">
            <div class="nav-left">
                <a href="#" class="logo">
                    <div class="logo-icon">F</div>
                </a>
            </div>
            <div v-if="currentView === 'login' || currentView === 'register'" class="nav-center">
                Please login to continue <span title="key">🔑</span>
            </div>
            <div v-else class="nav-right">
                <button class="button secondary-button" @click="goToHome">🏠 Home</button>
                <button class="button" @click="showCreatePostModal">✍️ Create Post</button>
                <button class="button secondary-button" @click="goToGroups">👥 Groups</button>
                <button class="button" @click="showCreateGroupModal">➕ Create Group</button>
                <span class="user-greeting">{{ currentUser.username }} 👋</span>
                <button class="button secondary-button" @click="goToProfile">My Profile</button>
                <button class="button logout-button" @click="handleLogout">Logout</button>
            </div>
        </nav>
    `,
    props: {
        state: {
            type: String,
            required: true
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    computed: {
        currentView() {
            return this.state;
        }
    },
    methods: {
        goToHome() {
            this.$emit('navigate', 'home');
        },
        goToGroups() {
            this.$emit('navigate', 'groups');
        },
        goToProfile() {
            this.$emit('navigate', 'profile');
        },
        showCreatePostModal() {
            console.log('NavBar: Emitting show-modal event for createPost');
            this.$emit('show-modal', 'createPost');
        },
        showCreateGroupModal() {
            this.$emit('show-modal', 'createGroup');
        },
        async handleLogout() {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                this.$emit('logout');
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    }
};
// No mount here, will be registered globally. 