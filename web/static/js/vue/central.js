// Central Vue App
const app = Vue.createApp({
    data() {
        return {
            currentView: 'login',
            showRegisterModal: false,
            showCreatePostModal: false,
            showCreateGroupModal: false,
            currentUser: {
                isLoggedIn: false,
                id: null,
                username: null,
                email: null
            },
            chatWindows: new Map(),
            minimizedChats: new Set(),
            posts: [], // for updating after post creation
            groups: [] // for updating after group creation
        };
    },
    methods: {
        // Navigation methods
        goToHome() {
            this.currentView = 'home';
        },
        goToGroups() {
            this.currentView = 'groups';
        },
        goToProfile() {
            this.currentView = 'profile';
        },
        goToLogin() {
            this.currentView = 'login';
        },
        goToRegister() {
            this.showRegisterModal = true;
        },

        // User authentication methods
        async handleLogin(credentials) {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(credentials),
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Login failed');
                }

                const data = await response.json();
                this.currentUser = {
                    isLoggedIn: true,
                    id: data.id,
                    username: data.username,
                    email: data.email
                };

                this.goToHome();
            } catch (error) {
                console.error('Login error:', error);
                throw error;
            }
        },

        async handleLogout() {
            try {
                await fetch('/api/logout', {
                    method: 'POST'
                });

                this.currentUser = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };

                this.goToLogin();
            } catch (error) {
                console.error('Logout error:', error);
            }
        },

        // Chat window management
        showChat(userId) {
            if (!this.chatWindows.has(userId)) {
                this.chatWindows.set(userId, {
                    position: this.getNextChatPosition()
                });
            }
        },

        minimizeChat(userId) {
            this.minimizedChats.add(userId);
        },

        closeChat(userId) {
            this.chatWindows.delete(userId);
            this.minimizedChats.delete(userId);
        },

        getNextChatPosition() {
            const offset = this.chatWindows.size * 20;
            return {
                x: window.innerWidth - 300 - offset,
                y: window.innerHeight - 400 - offset
            };
        },

        // Modal handlers
        openCreatePostModal() { this.showCreatePostModal = true; },
        openCreateGroupModal() { this.showCreateGroupModal = true; },
        handleShowModal(modalType) {
            if (modalType === 'createPost') this.openCreatePostModal();
            if (modalType === 'createGroup') this.openCreateGroupModal();
        },
        onPostCreated(newPost) {
            this.showCreatePostModal = false;
            // Optionally: this.posts.unshift(newPost);
        },
        onGroupCreated(newGroup) {
            this.showCreateGroupModal = false;
            // Optionally: this.groups.unshift(newGroup);
        },
        handleNavigate(view) {
            this.currentView = view;
        },
        async onLogin(data) {
            // Called when login-form emits 'login' with user data
            this.currentUser = {
                isLoggedIn: true,
                id: data.user_id || data.id,
                username: data.username,
                email: data.email || ''
            };
            this.currentView = 'home';
        },
        async onRegistered(data) {
            // Called when register-modal emits 'registered' with user data
            // Try to fetch user status and update state
            try {
                const response = await fetch('/api/user_status');
                const text = await response.text();
                let userData = {};
                try {
                    userData = JSON.parse(text);
                } catch (e) {
                    console.error('Error parsing /api/user_status response as JSON:', text);
                    this.currentView = 'login';
                    this.showRegisterModal = false;
                    return;
                }
                if (userData.loggedIn) {
                    this.currentUser = {
                        isLoggedIn: true,
                        id: userData.userID,
                        username: userData.username,
                        email: userData.email || ''
                    };
                    this.currentView = 'home';
                } else {
                    this.currentView = 'login';
                }
            } catch (e) {
                this.currentView = 'login';
            }
            this.showRegisterModal = false;
        }
    },
    mounted() {
        // Check if user is already logged in
        fetch('/api/user')
            .then(async response => {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    if (data.isLoggedIn) {
                        this.currentUser = {
                            isLoggedIn: true,
                            id: data.id,
                            username: data.username,
                            email: data.email
                        };
                        this.goToHome();
                    }
                } catch (e) {
                    console.error('Error parsing /api/user response as JSON:', text);
                }
            })
            .catch(error => {
                console.error('Error checking user status:', error);
            });

        // Listen for chat window events
        window.addEventListener('show-chat', (event) => {
            this.showChat(event.detail.userId);
        });

        window.addEventListener('minimize-chat', (event) => {
            this.minimizeChat(event.detail.userId);
        });

        window.addEventListener('close-chat', (event) => {
            this.closeChat(event.detail.userId);
        });
    },
    provide() {
        return {
            currentUser: this.currentUser
        };
    },
    template: `
        <div>
            <nav-bar :state="currentView"
                @show-modal="handleShowModal"
                @logout="handleLogout"
                @navigate="handleNavigate"
            ></nav-bar>
            <create-post-modal v-if="showCreatePostModal" @close="showCreatePostModal = false" @created="onPostCreated"></create-post-modal>
            <create-group-modal v-if="showCreateGroupModal" @close="showCreateGroupModal = false" @created="onGroupCreated"></create-group-modal>
            <main v-if="currentView === 'login'" class="page login-page">
                <login-form @login="onLogin"></login-form>
                <register-modal v-if="showRegisterModal" @registered="onRegistered"></register-modal>
            </main>
            <main v-if="currentView === 'home'" class="page home-page">
                <feed-main></feed-main>
                <users-list></users-list>
            </main>
            <main v-if="currentView === 'groups'" class="page groups-page">
                <groups-list></groups-list>
                <group-main>
                    <group-posts></group-posts>
                    <group-events></group-events>
                    <group-chat></group-chat>
                </group-main>
                <users-list></users-list>
            </main>
            <main v-if="currentView === 'profile'" class="page profile-page">
                <filters-sidebar :is-profile="true"></filters-sidebar>
                <profile-main></profile-main>
                <users-list></users-list>
            </main>
        </div>
    `
});

// Use WebSocket plugin
app.use(WebSocketPlugin);

// Register all components and views globally
app.component('nav-bar', NavBar);
app.component('users-list', UsersList);
app.component('filters-sidebar', FiltersSidebar);
app.component('chat-window', ChatWindow);
app.component('register-modal', RegisterModal);
app.component('create-post-modal', CreatePostModal);
app.component('create-group-modal', CreateGroupModal);
app.component('login-form', LoginView);
app.component('feed-main', HomeView);
app.component('groups-list', GroupsView);
app.component('profile-main', ProfileView);
// Stub components for missing group features
app.component('group-posts', { template: '<div>Group Posts (stub)</div>' });
app.component('group-events', { template: '<div>Group Events (stub)</div>' });
app.component('group-chat', { template: '<div>Group Chat (stub)</div>' });
app.component('group-main', { template: '<div><slot /></div>' });

// Mount the app
app.mount('#app'); 