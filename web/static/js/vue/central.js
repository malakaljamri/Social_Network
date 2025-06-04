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
            groups: [], // for updating after group creation
            openChats: [] // <-- moved from HomeView
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

        async handleLogout() {
            try {
                // Close websocket before logging out
                this.websocket.close();

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
            this.openChats = this.openChats.filter(u => u.ID !== userId);
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
            // Initialize WebSocket after successful login
            this.websocket.init();

            this.currentView = 'home';
        },
        async onRegistered(data) {
            // Called when register-modal emits 'registered' with user data
            // Try to fetch user status and update state
            try {
                const response = await fetch('/api/user', { credentials: 'include' });
                const text = await response.text();
                let userData = {};
                try {
                    userData = JSON.parse(text);
                } catch (e) {
                    console.error('Error parsing user response as JSON:', text);
                    this.currentView = 'login';
                    this.showRegisterModal = false;
                    return;
                }
                // Handle both response formats
                const isLoggedIn = userData.isLoggedIn || userData.loggedIn;
                const userId = userData.id || userData.userID;
                if (isLoggedIn) {
                    this.currentUser = {
                        isLoggedIn: true,
                        id: userId,
                        username: userData.username,
                        email: userData.email || ''
                    };
                    this.currentView = 'home';
                } else {
                    this.currentView = 'login';
                }
            } catch (e) {
                console.error('Error fetching user status:', e);
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
        },
        openChat(user) {
            if (!this.openChats.some(u => u.ID === user.ID)) {
                this.openChats.push(user);
            }
        }
    },
    mounted() {
        // Check if user is already logged in
        fetch('/api/user', { credentials: 'include' })
            .then(async response => {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    // Handle both response formats
                    const isLoggedIn = data.isLoggedIn || data.loggedIn;
                    const userId = data.id || data.userID;
                    if (isLoggedIn) {
                        this.currentUser.isLoggedIn = true;
                        this.currentUser.id = userId;
                        this.currentUser.username = data.username;
                        this.currentUser.email = data.email || '';
                        // Initialize WebSocket if user is already logged in on refresh
                        this.websocket.init();
                        this.goToHome();
                    } else {
                        this.currentUser.isLoggedIn = false;
                        this.currentUser.id = null;
                        this.currentUser.username = null;
                        this.currentUser.email = null;
                        this.goToLogin();
                    }
                } catch (e) {
                    console.error('Error parsing user response:', e);
                    this.currentUser.isLoggedIn = false;
                    this.currentUser.id = null;
                    this.currentUser.username = null;
                    this.currentUser.email = null;
                    this.goToLogin();
                }
            })
            .catch(error => {
                console.error('Error fetching user status:', error);
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

        // Listen for open-chat events from any users-list
        window.addEventListener('open-chat', (e) => {
            this.openChat(e.detail);
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
                @open-create-group-modal="openCreateGroupModal"
                @show-create-post-modal="openCreatePostModal"
            ></component>
            <m-create-post
                v-if="showCreatePostModal"
                @close="showCreatePostModal = false"
                @created="onPostCreated"
            ></m-create-post>
            <m-group-create-post
                v-if="showCreateGroupPostModal"
                :groupId="selectedGroupIdForModal"
                @close="closeCreateGroupPostModal"
                @created="onGroupPostCreated"
            ></m-group-create-post>
            <m-group-create
                v-if="showCreateGroupModal"
                @close="showCreateGroupModal = false"
                @created="onGroupCreated"
            ></m-group-create>
            <div id="chat-section">
                <chat-window v-for="user in openChats" :key="user.ID" :user="user" :currentUser="currentUser" :onClose="() => closeChat(user.ID)"></chat-window>
            </div>
        </div>
    `,
    setup() {
        // Inject the websocket service
        const websocket = Vue.inject('websocket');

        return {
            websocket,
        };
    },
});

// Use WebSocket plugin
app.use(WebSocketPlugin);

// Register all components and views globally
app.component('nav-bar', NavBar);
app.component('users-list', UsersList);
app.component('filters-sidebar', FiltersSidebar);
app.component('chat-window', ChatWindow);
app.component('m-register', M_Register);
app.component('m-create-post', M_CreatePost);
app.component('m-group-create', M_GroupCreate);
app.component('m-group-create-post', M_GroupCreatePost);
// Register main views with correct names for dynamic :is usage
app.component('login-view', LoginView);
app.component('home-view', HomeView);
app.component('groups-view', GroupsView);
app.component('profile-view', ProfileView);
// Stub components for missing group features
app.component('group-posts', { template: '<div>Group Posts (stub)</div>' });
app.component('group-events', { template: '<div>Group Events (stub)</div>' });
app.component('group-chat', GroupChat);
app.component('g-group-list', G_GroupList);
app.component('g-group-main', G_GroupMain);
app.component('g-group-chat', G_GroupChat);

// Mount the app
app.mount('#app'); 