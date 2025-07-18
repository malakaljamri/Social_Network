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
            showEventDetailsModal: false,
            upcomingEvents: [],
            pastEvents: [],
            _userInterval: null,
            loggingOut: false,
            _actionQueue: [], // Track sequential actions
            // Loading state management system
            _componentStates: {},
        };
    },
    watch: {
        // REMOVE the watcher on 'currentUser.value.isLoggedIn'
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
            // Always set selectedProfileUserId to current user's ID
            const id = this.currentUser.value.id || this.currentUser.value.ID;
            this.selectedProfileUserId = id;
            if (this.currentView !== 'profile') {
                this.currentView = 'profile';
            } else {
                // If already on profile, force re-render
                this.currentView = null;
                this.$nextTick(() => {
                    this.currentView = 'profile';
                });
            }
        },
        goToLogin() {
            this.currentView = 'login';
        },
        goToRegister() {
            this.showRegisterModal = true;
        },

        async handleLogout() {
            try {
                this.loggingOut = true;
                // Clear all data immediately on logout click
                this.clearAllData();

                // Close websocket before logging out
                if (this.$root && this.$root.websocket && typeof this.$root.websocket.close === 'function') {
                    this.$root.websocket.close();
                }

                await fetch('/api/logout', { method: 'POST', credentials: 'include' });

                // Reset user state
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    ID: null,
                    username: null,
                    Username: null,
                    email: null
                };
                // Clear all other state
                this.users = [];
                this.groups = [];
                this.selectedProfileUserId = null;
                this.currentView = 'login';
                this.loggingOut = false;
                // Clear any stored data
                localStorage.clear();
                sessionStorage.clear();
                // Clear cookies by setting them to expire
                document.cookie.split(';').forEach(function(c) {
                    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
                });
                // Force a full page reload to guarantee a clean state
                window.location.reload();
            } catch (error) {
                console.error('Logout error:', error);
                this.loggingOut = false;
            }
        },

        // Clear all cached data and reset component state
        clearAllData() {
            // Clear main app data
            this.posts = [];
            this.groups = [];
            this.openChats = [];
            this.selectedEvent = null;
            this.showEventDetailsModal = false;
            this.showGroupEventsModal = false;
            this.upcomingEvents = [];
            this.pastEvents = [];
            
            // Clear chat windows
            this.chatWindows.clear();
            this.minimizedChats.clear();
            
            // Reset modals
            this.showRegisterModal = false;
            this.showCreatePostModal = false;
            this.showCreateGroupModal = false;
            this.showCreateGroupPostModal = false;
            this.selectedGroupIdForModal = null;
            
            // Dispatch custom event to clear child component data
            window.dispatchEvent(new CustomEvent('clear-all-data'));
        },

        // Comprehensive data refresh method for core events
        async refreshAllData() {
            if (this.currentUser.value && this.currentUser.value.isLoggedIn) {
                console.log('🔄 Refreshing all data...');
                
                // Prevent multiple simultaneous refreshes
                if (this._refreshingData) {
                    console.log('🔄 Data refresh already in progress, skipping...');
                    return;
                }
                this._refreshingData = true;
                
                try {
                    // Refresh all core data in parallel
                    await Promise.all([
                        this.fetchUsers(),
                        this.fetchGroups(),
                        this.fetchNotificationCount()
                    ]);
                    
                    // Dispatch events to refresh child components
                    window.dispatchEvent(new CustomEvent('refresh-all-data'));
                    
                    console.log('✅ All data refreshed successfully');
                } catch (error) {
                    console.error('❌ Error refreshing data:', error);
                } finally {
                    this._refreshingData = false;
                }
            }
        },

        // Debounced refresh method to prevent excessive API calls
        debouncedRefresh() {
            if (this._refreshTimeout) {
                clearTimeout(this._refreshTimeout);
            }
            this._refreshTimeout = setTimeout(() => {
                this.refreshAllData();
            }, 1000); // Wait 1 second before refreshing
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
            // Remove from open chats
            this.openChats = this.openChats.filter(chat => 
                chat.ID !== userId && chat.id !== userId
            );
            
            // Also clean up old chat window system
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
        async onGroupCreated(newGroup) {
            this.showCreateGroupModal = false;
            console.log('✅ Group created successfully:', newGroup);
            // Refresh the groups list to show the new group
            await this.fetchGroups();
            // Dispatch event to refresh all group-related data
            window.dispatchEvent(new CustomEvent('group-created', { detail: newGroup }));
        },
        onGroupPostCreated(postData) {
            this.closeCreateGroupPostModal();
            // Dispatch event to refresh group posts
            window.dispatchEvent(new CustomEvent('refresh-group-posts', { detail: postData }));
        },
        handleNavigate(view) {
            if (this.currentView === view) {
                // Force a re-render by temporarily setting to null
                this.currentView = null;
                this.$nextTick(() => {
                    this.currentView = view;
                    this.fetchUsers(); // Always refresh users on navigation
                    this.resetUserSearch();
                });
            } else {
                this.currentView = view;
                this.fetchUsers(); // Always refresh users on navigation
                this.resetUserSearch();
            }
        },
        resetUserSearch() {
            // Emit event to reset user search in UsersList
            this.$emit && this.$emit('reset-user-search');
            // If using refs, you could also do:
            // if (this.$refs.usersList && this.$refs.usersList.resetSearch) this.$refs.usersList.resetSearch();
        },
        async onLogin(data) {
            try {
                this.currentUser.value = {
                    isLoggedIn: true,
                    id: data.id,
                    ID: data.id,
                    username: data.username,
                    Username: data.username,
                    email: data.email
                };
                
                // Initialize WebSocket connection after successful login
                console.log('Login successful, checking WebSocket...', {
                    websocket: !!this.websocket,
                    websocketInit: !!this.websocket?.init,
                    currentUser: this.currentUser.value
                });
                
                if (this.websocket && this.websocket.init) {
                    console.log('Initializing WebSocket connection after login...');
                    this.websocket.init();
                } else {
                    console.error('WebSocket not available after login');
                }
                
                this.currentView = 'home';
                await this.fetchUsers();
                await this.fetchGroups();
                await this.fetchNotificationCount();
            } catch (error) {
                console.error('Error in onLogin:', error);
            }
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
            // Normalize user object to ensure consistent ID and Username properties
            const normalizedUser = {
                ...user,
                ID: user.ID || user.id,
                id: user.id || user.ID,
                Username: user.Username || user.username,
                username: user.username || user.Username
            };
            
            // Check if chat is already open
            const existingChatIndex = this.openChats.findIndex(chat => 
                chat.ID === normalizedUser.ID || chat.id === normalizedUser.id
            );
            
            if (existingChatIndex === -1) {
                // Add new chat to open chats
                this.openChats.push(normalizedUser);
            }
            
            // Ensure chat window is visible
            this.$nextTick(() => {
                // Scroll to the chat window if needed
                const chatWindow = document.querySelector('.chat-window-fixed');
                if (chatWindow) {
                    chatWindow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        },
        async checkUserStatus() {
            try {
                const response = await fetch('/api/user', { credentials: 'include' });
                const userData = await response.json();
                const isLoggedIn = userData && (userData.id || userData.ID || userData.userID);
                const id = userData.id || userData.ID || userData.userID;
                const username = userData.username || userData.Username;
                if (isLoggedIn) {
                    this.currentUser.value = {
                        isLoggedIn: true,
                        id: id,
                        ID: id,
                        username: username,
                        Username: username,
                        email: userData.email
                    };
                    this.currentView = 'home';
                } else {
                    this.currentUser.value = {
                        isLoggedIn: false,
                        id: null,
                        ID: null,
                        username: null,
                        Username: null,
                        email: null
                    };
                    this.currentView = 'login';
                }
            } catch (e) {
                console.error('Error fetching user status:', e);
                this.currentUser.value = {
                    isLoggedIn: false,
                    id: null,
                    ID: null,
                    username: null,
                    Username: null,
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
        },
        async fetchUsers() {
            if (!this.currentUser.value || !this.currentUser.value.isLoggedIn) return;
            
            // Prevent multiple simultaneous fetches
            if (this._fetchingUsers) return;
            this._fetchingUsers = true;
            
            try {
                const users = await this.retryApiCall(async () => {
                    const response = await fetch('/api/users', { credentials: 'include' });
                    if (!response.ok) throw new Error('Failed to fetch users');
                    return await response.json();
                });
                
                this.users = users || [];
                console.log('Users fetched successfully:', this.users.length);
            } catch (error) {
                console.error('Error fetching users:', error);
                this.users = [];
            } finally {
                this._fetchingUsers = false;
            }
        },
        async refreshUsers() {
            await this.fetchUsers();
        },
        async fetchGroups() {
            if (!this.currentUser.value || !this.currentUser.value.isLoggedIn) return;
            
            // Prevent multiple simultaneous fetches
            if (this._fetchingGroups) return;
            this._fetchingGroups = true;
            
            try {
                const response = await fetch('/api/groups', { credentials: 'include' });
                if (response.ok) {
                    const groups = await response.json();
                    this.groups = groups || [];
                    console.log('Groups fetched successfully:', this.groups.length);
                } else {
                    console.error('Failed to fetch groups');
                    this.groups = [];
                }
            } catch (error) {
                console.error('Error fetching groups:', error);
                this.groups = [];
            } finally {
                this._fetchingGroups = false;
            }
        },

        async fetchNotificationCount() {
            if (!this.currentUser.value.isLoggedIn) return;
            try {
                const response = await fetch('/api/notifications/count', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    // Update notification count in NavBar if available
                    if (this.$refs.navbar && this.$refs.navbar.updateNotificationCount) {
                        this.$refs.navbar.updateNotificationCount(data.count);
                    }
                }
            } catch (error) {
                console.error('Error fetching notification count:', error);
            }
        },
        getViewProps(view) {
            // Centralize prop passing for all main views
            const base = { currentUser: this.currentUser.value || { id: null } };
            if (view === 'profile') {
                return { ...base, userId: this.selectedProfileUserId };
            }
            if (view === 'home') {
                return base;
            }
            if (view === 'groups') {
                return base;
            }
            if (view === 'login') {
                return base;
            }
            return base;
        },
        // Event sequencing system to ensure proper order of operations
        async executeSequentialAction(actionName, actionFunction) {
            if (this._actionQueue.includes(actionName)) {
                console.log(`🔄 Action ${actionName} already in queue, skipping...`);
                return;
            }
            
            this._actionQueue.push(actionName);
            console.log(`🔄 Starting sequential action: ${actionName}`);
            
            try {
                // Wait for any ongoing data fetches to complete
                if (this._fetchingUsers || this._fetchingGroups || this._refreshingData) {
                    console.log(`⏳ Waiting for ongoing data fetches to complete...`);
                    await this.waitForDataFetches();
                }
                
                // Execute the action
                await actionFunction();
                console.log(`✅ Sequential action completed: ${actionName}`);
            } catch (error) {
                console.error(`❌ Sequential action failed: ${actionName}`, error);
            } finally {
                // Remove from queue
                const index = this._actionQueue.indexOf(actionName);
                if (index > -1) {
                    this._actionQueue.splice(index, 1);
                }
            }
        },
        
        // Wait for ongoing data fetches to complete
        async waitForDataFetches() {
            const maxWaitTime = 10000; // 10 seconds max wait
            const checkInterval = 100; // Check every 100ms
            let waited = 0;
            
            while ((this._fetchingUsers || this._fetchingGroups || this._refreshingData) && waited < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waited += checkInterval;
            }
            
            if (waited >= maxWaitTime) {
                console.warn('⚠️ Timeout waiting for data fetches to complete');
            }
        },
        // Loading state management system
        setComponentReady(componentName, isReady = true) {
            if (!this._componentStates) {
                this._componentStates = {};
            }
            this._componentStates[componentName] = isReady;
            console.log(`📊 Component ${componentName} ready state: ${isReady}`);
        },
        
        isComponentReady(componentName) {
            if (!this._componentStates) {
                return false;
            }
            return this._componentStates[componentName] === true;
        },
        
        waitForComponent(componentName, maxWaitTime = 5000) {
            return new Promise((resolve) => {
                if (this.isComponentReady(componentName)) {
                    resolve();
                    return;
                }
                
                const checkInterval = 100;
                let waited = 0;
                
                const check = () => {
                    if (this.isComponentReady(componentName)) {
                        resolve();
                        return;
                    }
                    
                    waited += checkInterval;
                    if (waited >= maxWaitTime) {
                        console.warn(`⚠️ Timeout waiting for component ${componentName} to be ready`);
                        resolve(); // Resolve anyway to prevent blocking
                        return;
                    }
                    
                    setTimeout(check, checkInterval);
                };
                
                check();
            });
        },
        // Retry mechanism for failed API calls
        async retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await apiCall();
                } catch (error) {
                    console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error);
                    
                    if (attempt === maxRetries) {
                        throw error; // Re-throw on final attempt
                    }
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        },
    },
    mounted() {
        // Initialize data fetching with proper error handling
        const initializeApp = async () => {
            try {
                await this.checkUserStatus();
                
                if (this.currentUser.value && this.currentUser.value.isLoggedIn) {
                    console.log('User is logged in, fetching initial data...');
                    
                    // Fetch all data in parallel for better performance
                    await Promise.all([
                        this.fetchUsers(),
                        this.fetchGroups(),
                        this.fetchNotificationCount()
                    ]);
                    
                    // Initialize WebSocket connection
                    if (this.websocket && this.websocket.init) {
                        console.log('Initializing WebSocket connection...');
                        this.websocket.init();
                    }
                    
                    // Set up periodic user refresh (less frequent to reduce load)
                    this._userInterval = setInterval(() => {
                        if (this.currentUser.value && this.currentUser.value.isLoggedIn) {
                            this.fetchUsers();
                        }
                    }, 60000); // Refresh every minute instead of 30 seconds
                } else {
                    console.log('User not logged in, redirecting to login...');
                    this.currentView = 'login';
                }
            } catch (error) {
                console.error('Error during app initialization:', error);
                this.currentView = 'login';
            }
        };
        
        initializeApp();

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

        // Only fetch groups and notification count if logged in
        if (this.currentUser && this.currentUser.value && this.currentUser.value.isLoggedIn) {
            this.fetchGroups();
            this.fetchNotificationCount();
        }

        // Listen for WebSocket events to refresh user list
        if (this.websocket && this.websocket.eventBus) {
            this.websocket.eventBus.on('follow-status-update', () => {
                this.fetchUsers();
            });
            this.websocket.eventBus.on('user_status', () => {
                this.fetchUsers();
            });
            this.websocket.eventBus.on('profile-privacy-update', () => {
                this.fetchUsers();
            });
            
            // Listen for group-related events to refresh data
            this.websocket.eventBus.on('group-created', (data) => {
                console.log('🔄 Group created event received, scheduling data refresh...');
                this.debouncedRefresh();
            });
            
            this.websocket.eventBus.on('group-updated', (data) => {
                console.log('🔄 Group updated event received, scheduling data refresh...');
                this.debouncedRefresh();
            });
            
            this.websocket.eventBus.on('group-membership-changed', (data) => {
                console.log('🔄 Group membership changed event received, scheduling data refresh...');
                this.debouncedRefresh();
            });
            
            // Listen for notification events
            this.websocket.eventBus.on('notification-count-update', (data) => {
                console.log('🔄 Notification count update received, refreshing notifications...');
                this.fetchNotificationCount();
            });
        }
    },
    beforeUnmount() {
        clearInterval(this._userInterval);
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
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
                :currentUser="currentUser.value || { isLoggedIn: false, username: '' }"
                @navigate="handleNavigate"
                @logout="handleLogout"
                @show-modal="handleShowModal"
            ></nav-bar>
            <component :is="currentView + '-view'"
                v-if="((currentUser.value && currentUser.value.isLoggedIn) || (!currentUser.value && false)) || currentView === 'login' || currentView === 'register'"
                :key="currentView"
                @login="onLogin"
                @registered="onRegistered"
                @show-register="goToRegister"
                @post-created="onPostCreated"
                @group-created="onGroupCreated"
                @open-create-group-post-modal="openCreateGroupPostModal"
                @open-create-group-modal="openCreateGroupModal"
                @show-create-post-modal="openCreatePostModal"
                v-bind="getViewProps(currentView)"
                @event-click="openEventDetailsModal"
            ></component>
            <m-register v-if="showRegisterModal" @close="showRegisterModal = false" @registered="onRegistered"></m-register>
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
                :show="showCreateGroupModal"
                :users="users"
                :current-user="currentUser.value || { isLoggedIn: false }"
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
                    :currentUser="currentUser.value || { isLoggedIn: false }"
                    @close="closeChat(user.ID)"
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
app.component('notifications', Notifications);
app.component('m-register', M_Register);
app.component('m-create-post', M_CreatePost);
app.component('m-group-create', M_GroupCreate);
app.component('m-group-create-post', M_GroupCreatePost);
app.component('m-group-create-event', M_GroupCreateEvent);
app.component('g-group-events-modal', G_GroupEventsModal);
app.component('p-profile-edit-form', P_ProfileEditForm);
app.component('p-follow-request-list', P_FollowRequestList);
app.component('feed-main', FeedMain);
// Stub components for missing group features
app.component('group-posts', { template: '<div>Group Posts (stub)</div>' });
app.component('group-events', { template: '<div>Group Events (stub)</div>' });
app.component('group-chat', GroupChat);

// Mount the app
app.mount('#app'); 