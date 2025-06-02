// Central Vue App
const app = Vue.createApp({
    data() {
        return {
            currentView: 'login',
            showRegisterModal: false,
            showCreatePostModal: false,
            showCreateGroupModal: false,
            showCreateGroupPostModal: false,
            selectedGroupIdForModal: null,
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials),
                    credentials: 'include'
                });
                const data = await response.json();
                if (!response.ok || data.message !== 'Logged in successfully') {
                    throw new Error(data.message || 'Login failed');
                }
                this.currentUser.isLoggedIn = true;
                this.currentUser.id = data.user_id;
                this.currentUser.username = data.username;
                this.currentUser.email = data.email || '';
                // Initialize WebSocket and fetch posts (handled by HomeView)
                this.goToHome();
            } catch (error) {
                this.currentUser.isLoggedIn = false;
                this.currentUser.id = null;
                this.currentUser.username = null;
                this.currentUser.email = null;
                throw error;
            }
        },

        async handleLogout() {
            try {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                this.currentUser.isLoggedIn = false;
                this.currentUser.id = null;
                this.currentUser.username = null;
                this.currentUser.email = null;
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
        openCreatePostModal() { 
            console.log('Opening create post modal, current state:', this.showCreatePostModal);
            this.showCreatePostModal = true; 
            console.log('New state:', this.showCreatePostModal);
        },
        openCreateGroupModal() { 
            console.log('Opening create group modal, current state:', this.showCreateGroupModal);
            this.showCreateGroupModal = true; 
            console.log('New state:', this.showCreateGroupModal);
        },
        openCreateGroupPostModal(groupId) {
            this.selectedGroupIdForModal = groupId;
            this.showCreateGroupPostModal = true;
        },
        closeCreateGroupPostModal() {
            this.showCreateGroupPostModal = false;
            this.selectedGroupIdForModal = null;
        },
        handleShowModal(modalType) {
            console.log('Handling show modal:', modalType, 'Current user:', this.currentUser);
            if (modalType === 'createPost') {
                console.log('About to open create post modal');
                this.openCreatePostModal();
            }
            if (modalType === 'createGroup') {
                console.log('About to open create group modal');
                this.openCreateGroupModal();
            }
        },
        onPostCreated(newPost) {
            console.log('Post created:', newPost);
            this.showCreatePostModal = false;
            // Refresh posts list if we're on the home view
            if (this.currentView === 'home') {
                // Dispatch event to refresh posts
                window.dispatchEvent(new CustomEvent('refresh-posts'));
            }
        },
        onGroupCreated(newGroup) {
            this.showCreateGroupModal = false;
            // Optionally: this.groups.unshift(newGroup);
        },
        onGroupPostCreated() {
            this.closeCreateGroupPostModal();
            // Optionally refresh group posts here
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
        },
        async apiFetch(url, options = {}) {
            // Helper for all API calls to handle session expiration
            const opts = { ...options, credentials: 'include' };
            const response = await fetch(url, opts);
            if (response.status === 401 || response.status === 403) {
                this.handleLogout();
                throw new Error('Session expired. Please log in again.');
            }
            return response;
        }
    },
    mounted() {
        // Check if user is already logged in (use /api/user_status for parity)
        fetch('/api/user_status', { credentials: 'include' })
            .then(async response => {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    if (data.loggedIn) {
                        this.currentUser.isLoggedIn = true;
                        this.currentUser.id = data.userID;
                        this.currentUser.username = data.username;
                        this.currentUser.email = data.email || '';
                        this.goToHome();
                    } else {
                        this.currentUser.isLoggedIn = false;
                        this.currentUser.id = null;
                        this.currentUser.username = null;
                        this.currentUser.email = null;
                        this.goToLogin();
                    }
                } catch (e) {
                    this.currentUser.isLoggedIn = false;
                    this.currentUser.id = null;
                    this.currentUser.username = null;
                    this.currentUser.email = null;
                    this.goToLogin();
                }
            })
            .catch(error => {
                this.currentUser.isLoggedIn = false;
                this.currentUser.id = null;
                this.currentUser.username = null;
                this.currentUser.email = null;
                this.goToLogin();
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
            <nav-bar 
                :state="currentView" 
                :currentUser="currentUser"
                @navigate="handleNavigate"
                @logout="handleLogout"
                @show-modal="handleShowModal"
            ></nav-bar>
            <component :is="currentView + '-view'"
                v-if="currentUser.isLoggedIn || currentView === 'login' || currentView === 'register'"
                :key="currentView"
                @login="onLogin"
                @registered="onRegistered"
                @post-created="onPostCreated"
                @group-created="onGroupCreated"
                @open-create-group-post-modal="openCreateGroupPostModal"
            ></component>
            <create-post-modal
                v-if="showCreatePostModal"
                @close="showCreatePostModal = false"
                @created="onPostCreated"
            ></create-post-modal>
            <create-group-post-modal
                v-if="showCreateGroupPostModal"
                :groupId="selectedGroupIdForModal"
                @close="closeCreateGroupPostModal"
                @created="onGroupPostCreated"
            ></create-group-post-modal>
            <create-group-modal
                v-if="showCreateGroupModal"
                @close="showCreateGroupModal = false"
                @created="onGroupCreated"
            ></create-group-modal>
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
app.component('create-group-post-modal', CreateGroupPostModal);
// Register main views with correct names for dynamic :is usage
app.component('login-view', LoginView);
app.component('home-view', HomeView);
app.component('groups-view', GroupsView);
app.component('profile-view', ProfileView);
// Stub components for missing group features
app.component('group-posts', { template: '<div>Group Posts (stub)</div>' });
app.component('group-events', { template: '<div>Group Events (stub)</div>' });
app.component('group-chat', GroupChat);
app.component('group-list', GroupList);
app.component('group-main', GroupMain);

// Mount the app
app.mount('#app'); 