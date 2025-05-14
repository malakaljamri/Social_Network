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
                <span class="user-greeting">[[currentUser.username]] 👋</span>
                <button class="button secondary-button" @click="goToProfile">My Profile</button>
                <button class="button logout-button" @click="handleLogout">Logout</button>
            </div>
        </nav>
    `,
    props: {
        state: {
            type: String,
            required: true
        }
    },
    setup(props, { emit }) {
        const currentUser = Vue.inject('currentUser');

        // Navigation methods
        function goToHome() {
            emit('navigate', 'home');
        }

        function goToGroups() {
            emit('navigate', 'groups');
        }

        function goToProfile() {
            emit('navigate', 'profile');
        }

        function showCreatePostModal() {
            emit('show-modal', 'createPost');
        }

        function showCreateGroupModal() {
            emit('show-modal', 'createGroup');
        }

        async function handleLogout() {
            try {
                await fetch('/api/logout', {
                    method: 'POST'
                });
                emit('logout');
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        return {
            currentUser,
            currentView: Vue.computed(() => props.state),
            goToHome,
            goToGroups,
            goToProfile,
            showCreatePostModal,
            showCreateGroupModal,
            handleLogout
        };
    }
};
// No mount here, will be registered globally. 