// Central Vue App 111
const app = Vue.createApp({
    delimiters: ['[[', ']]'],
    data() {
        return {
            currentView: 'home',
            currentUser: Vue.ref({
                isLoggedIn: false,
                id: null,
                username: null,
                email: null
            }),
            isAuthenticated: false,
            showLoginModal: false,
            showRegisterModal: false,
            showCreatePostModal: false,
            showCreateGroupModal: false,
            showCreateEventModal: false,
            showGroupEventsModal: false,
            selectedGroupId: null,
            selectedGroup: null,
            selectedEvent: null,
            showFilters: false,
            filters: {
                status: 'all',
                minAge: 18,
                maxAge: 100,
                distance: 50,
                tags: []
            },
            users: [],
            loading: false,
            error: null,
            ws: null,
            messages: [],
            newMessage: '',
            groups: [],
            selectedGroupForEvents: null,
            events: [],
            chatWindows: new Map(),
            minimizedChats: new Set(),
            selectedChatUser: null,
            chatMessages: [],
            newChatMessage: '',
            unreadMessages: {},
            notifications: [],
            showNotifications: false,
            notificationCount: 0,
            showProfileEdit: false,
            showFollowRequests: false,
            followRequests: [],
            showCreateGroupPostModal: false,
            selectedGroupIdForModal: null,
            posts: [],
            openChats: [],
            selectedProfileUserId: null,
            posts: [], // for updating after post creation
            groups: [], // for updating after group creation
            openChats: [], // <-- moved from HomeView
            selectedEvent: null,
            showEventDetailsModal: false,
            showGroupEventsModal: false,
            upcomingEvents: [],
            pastEvents: []
        };
    },
    watch: {
        'currentUser.value.isLoggedIn'(val) {
            if (val) {
                this.websocket.init();
            }
        }
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
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
                this.goToLogin();
                
                // Refresh page to ensure clean state for new user
                window.location.reload();
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
            console.log('Handling show modal:', modalType, 'Current user:', this.currentUser.value);
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
            this.currentUser.value = {
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
                    this.currentUser.value = {
                        isLoggedIn: true,
                        id: userId,
                        username: userData.username,
                        email: userData.email || ''
                    };
                    this.currentView = 'home';
                } else {
                    this.currentUser.value = {
                        isLoggedIn: false,
                        id: null,
                        username: null,
                        email: null
                    };
                    this.currentView = 'login';
                }
            } catch (e) {
                console.error('Error fetching user status:', e);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
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
            // Close all other chat windows before opening a new one
            this.openChats = [user];
        },
        async checkUserStatus() {
            try {
                const response = await fetch('/api/user', { credentials: 'include' });
                const userData = await response.json();
                const isLoggedIn = userData && userData.id;
                const userId = userData.id || userData.userID;
                if (isLoggedIn) {
                    this.currentUser.value = {
                        isLoggedIn: true,
                        id: userId,
                        username: userData.username,
                        email: userData.email
                    };
                    this.currentView = 'home';
                } else {
                    this.currentUser.value = {
                        isLoggedIn: false,
                        id: null,
                        username: null,
                        email: null
                    };
                    this.currentView = 'login';
                }
            } catch (e) {
                console.error('Error fetching user status:', e);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
                this.currentView = 'login';
            }
        },
        async handleUserResponse(response) {
            try {
                const data = await response.json();
                const isLoggedIn = data && (data.id || data.userID);
                const userId = data.id || data.userID;
                if (isLoggedIn) {
                    this.currentUser.value = {
                        isLoggedIn: true,
                        id: userId,
                        username: data.username,
                        email: data.email
                    };
                    this.goToHome();
                } else {
                    this.currentUser.value = {
                        isLoggedIn: false,
                        id: null,
                        username: null,
                        email: null
                    };
                    this.currentView = 'login';
                }
            } catch (e) {
                console.error('Error parsing user response:', e);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
                this.currentView = 'login';
            }
        },
        async fetchUserStatus() {
            try {
                const response = await fetch('/api/user', { credentials: 'include' });
                await this.handleUserResponse(response);
            } catch (error) {
                console.error('Error fetching user status:', error);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
                this.currentView = 'login';
            }
        },
        viewUserProfile(userId) {
            this.selectedProfileUserId = userId;
            this.currentView = 'profile';
        },
        openEventDetailsModal(event) {
            this.selectedEvent = event;
            this.showEventDetailsModal = true;
        },
        closeEventDetailsModal() {
            this.showEventDetailsModal = false;
            this.selectedEvent = null;
        },
        closeGroupEventsModal() {
            this.showGroupEventsModal = false;
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
                        this.currentUser.value = {
                            isLoggedIn: true,
                            id: userId,
                            username: data.username,
                            email: data.email || ''
                        };
                        this.goToHome();
                    } else {
                        this.currentUser.value = {
                            isLoggedIn: false,
                            id: null,
                            username: null,
                            email: null
                        };
                        this.goToLogin();
                    }
                } catch (e) {
                    console.error('Error parsing user response:', e);
                    this.currentUser.value = {
                        isLoggedIn: false,
                        id: null,
                        username: null,
                        email: null
                    };
                    this.goToLogin();
                }
            })
            .catch(error => {
                console.error('Error fetching user status:', error);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    username: null,
                    email: null
                };
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
                :state="currentView || 'home'" 
                :currentUser="currentUser.value || { isLoggedIn: false, username: '' }"
                @navigate="handleNavigate"
                @logout="handleLogout"
                @show-modal="handleShowModal"
            ></nav-bar>
            <component :is="currentView + '-view'"
                v-if="(currentUser.value && currentUser.value.isLoggedIn) || currentView === 'login' || currentView === 'register'"
                :key="currentView"
                @login="onLogin"
                @registered="onRegistered"
                @show-register="goToRegister"
                @post-created="onPostCreated"
                @group-created="onGroupCreated"
                @open-create-group-post-modal="openCreateGroupPostModal"
                @open-create-group-modal="openCreateGroupModal"
                @show-create-post-modal="openCreatePostModal"
                v-bind="currentView === 'profile' ? { userId: selectedProfileUserId } : {}"
                @event-click="openEventDetailsModal"
            ></component>
            <m-register v-if="showRegisterModal" @close="showRegisterModal = false" @registered="onRegistered"></m-register>
            <m-create-post
                v-if="showCreatePostModal"
                @close="showCreatePostModal = false"
                @created="onPostCreated"
            ></m-create-post>
            <m-create-post
                v-if="showCreateGroupPostModal"
                :groupId="selectedGroupIdForModal"
                @close="closeCreateGroupPostModal"
                @created="onGroupPostCreated"
            ></m-create-post>
            <m-group-create
                v-if="showCreateGroupModal"
                @close="showCreateGroupModal = false"
                @created="onGroupCreated"
            ></m-group-create>
            <div v-if="showEventDetailsModal" style="display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 3000; background: rgba(0,0,0,0.15);">
                <G_GroupEventDetailsModal
                    :event="selectedEvent"
                    @close="closeEventDetailsModal"
                />
            </div>
            <G_GroupEventsModal
                v-if="showGroupEventsModal"
                :upcomingEvents="upcomingEvents"
                :pastEvents="pastEvents"
                @close="closeGroupEventsModal"
                @event-click="openEventDetailsModal"
            />
            <div v-if="openChats.length > 0" class="chat-window-fixed">
                <chat-window
                    v-for="user in openChats"
                    :key="user.ID"
                    :user="user"
                    :currentUser="currentUser.value"
                    @close="openChats = []"
                ></chat-window>
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
    components: {
        G_GroupEventDetailsModal: window.G_GroupEventDetailsModal,
        G_GroupEventsModal: window.G_GroupEventsModal,
    },
});

// Use WebSocket plugin
app.use(WebSocketPlugin);

// Register all components and views globally
app.component('nav-bar', NavBar);
app.component('users-list', window.UsersList);
app.component('filters-sidebar', FiltersSidebar);
app.component('chat-window', ChatWindow);
app.component('g-group-list', G_GroupList);
app.component('g-group-main', G_GroupMain);
app.component('g-group-chat', G_GroupChat);
app.component('login-view', LoginView);
app.component('home-view', HomeView);
app.component('groups-view', GroupsView);
app.component('profile-view', ProfileView);
app.component('create-post-modal', CreatePostModal);
app.component('comment-section', CommentSection);
app.component('m-register', M_Register);
app.component('m-create-post', M_CreatePost);
app.component('m-group-create', M_GroupCreate);
app.component('m-group-create-event', M_GroupCreateEvent);
app.component('g-group-events-modal', G_GroupEventsModal);
app.component('g-group-join-requests-modal', window.G_GroupJoinRequestsModal);
app.component('p-profile-edit-form', P_ProfileEditForm);
app.component('p-follow-request-list', P_FollowRequestList);
app.component('feed-main', FeedMain);
app.component('post-card', PostCard);
// Stub components for missing group features
app.component('group-posts', { template: '<div>Group Posts (stub)</div>' });
app.component('group-events', { template: '<div>Group Events (stub)</div>' });
app.component('group-chat', GroupChat);

// Mount the app
app.mount('#app'); 