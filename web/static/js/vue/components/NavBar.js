// NavBar Component
const NavBar = {
    template: `
        <nav class="navbar" style="display: flex; align-items: center; justify-content: space-between;">
            <div class="nav-left" style="display: flex; align-items: center; gap: 24px; flex: 1;">
                <a href="http://localhost:8080"><span class="navbar-title" style="font-size: 1.3rem; font-weight: bold; color: #fff;">Social Network</span></a>
                <div v-if="currentUserValue.isLoggedIn" class="notifications-wrapper" style="display: inline-block; position: relative;">
                    <button class="button notification-bell" @click="toggleDropdown" style="font-size: 16px; position: relative;">
                        Notifications
                        <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount }}</span>
                    </button>
                    <div v-if="showDropdown" class="notifications-dropdown layer-dropdown" @click.stop style="position: absolute; left: 0; top: 40px; width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); z-index: var(--z-index-dropdown);">
                        <div class="dropdown-header" style="position: sticky; top: 0; background: #fff; border-bottom: 1px solid #eee; padding: 10px 16px; font-weight: bold;">
                            <a href="#" @click.prevent="openModal" style="color: #1976d2; text-decoration: underline; cursor: pointer; display: block;">All Notifications</a>
                        </div>
                        <div class="dropdown-list" style="max-height: 220px; overflow-y: auto;">
                            <div v-if="loading" class="dropdown-item" style="padding: 12px 16px; text-align: center; color: #888;">
                                Loading notifications...
                            </div>
                            <div v-else-if="notifications.length === 0" class="dropdown-item" style="padding: 12px 16px; text-align: center; color: #888;">
                                No notifications
                            </div>
                            <notifications 
                                v-else
                                :notifications="notifications.slice(0, 5)"
                                :show-actions="true"
                                @action-handled="handleNotificationAction"
                                @refresh-notifications="refreshNotifications"
                                @view-profile="viewUserProfile"
                                @view-post="viewPost"
                                @view-event="viewEvent"
                                @view-group="viewGroup">
                            </notifications>
                        </div>
                    </div>
                    <div v-if="showModal" class="modal-overlay" @click.self="closeModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.2); z-index: 2000; display: flex; align-items: center; justify-content: center;">
                        <div class="modal-content" @click.stop style="background: #fff; border-radius: 10px; padding: 32px; min-width: 350px; max-width: 90vw; max-height: 80vh; overflow-y: auto;">
                            <h2>All Notifications</h2>
                            <div v-if="loading" style="text-align: center; color: #888; padding: 20px;">
                                Loading notifications...
                            </div>
                            <notifications 
                                v-else
                                :notifications="allNotifications"
                                :show-actions="true"
                                @action-handled="handleNotificationAction"
                                @refresh-notifications="refreshNotifications"
                                @view-profile="viewUserProfile"
                                @view-post="viewPost"
                                @view-event="viewEvent"
                                @view-group="viewGroup">
                            </notifications>
                            <button class="button" @click="closeModal" style="margin-top: 20px;">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="currentUserValue.isLoggedIn" class="nav-center" style="display: flex; align-items: center; gap: 24px; flex: 1; justify-content: center;">
                <button class="button secondary-button" @click="goToHome">🏠 Home</button>
                <button class="button secondary-button" @click="goToGroups" style="position: relative;">
                    👥 Groups
                    <span v-if="myId && totalUnreadGroupCount > 0" class="unread-badge right-badge">{{ totalUnreadGroupCount }}</span>
                </button>
            </div>
            <div v-if="currentUserValue.isLoggedIn" class="nav-right" style="display: flex; align-items: center; gap: 24px; flex: 1; justify-content: flex-end;">
                <span class="user-greeting">{{ currentUserValue.username }} 👋</span>
                <button class="button secondary-button" @click="goToProfile">My Profile</button>
                <button class="button logout-button" @click="$emit('logout')">Logout</button>
            </div>
        </nav>
    `,
    props: {
        state: {
            type: String,
            default: ''
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    computed: {
        currentView() {
            return this.state;
        },
        currentUserValue() {
            return this.currentUser || { isLoggedIn: false, username: '' };
        },
        myId() {
            return this.currentUserValue.id || null;
        },
        totalUnreadGroupCount() {
            if (!this.myId) return 0;
            const total = Object.values(this.unreadCounts).reduce((a, b) => a + (b || 0), 0);
            console.log('NavBar: Total unread group count calculation:', {
                myId: this.myId,
                unreadCounts: this.unreadCounts,
                total: total
            });
            return total;
        }
    },
    data() {
        return {
            showDropdown: false,
            showModal: false,
            unreadCounts: {}, // Track unread group counts
            notificationCount: 0, // Add this line
            notifications: [],
            allNotifications: [],
            loading: false
        };
    },
    mounted() {
        if (this.currentUserValue && this.currentUserValue.isLoggedIn) {
            this.fetchNotificationCount();
            this.fetchNotifications();
        }
        this.fetchUnreadCountsIfLoggedIn();
        window.addEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        // Listen for notification count updates from WebSocket
        if (this.$root && this.$root.websocket && this.$root.websocket.eventBus) {
            this.$root.websocket.eventBus.on('notification-count-update', (data) => {
                if (this.currentUserValue && this.currentUserValue.isLoggedIn) {
                    this.fetchNotificationCount();
                    this.fetchNotifications();
                }
            });
            
            // Listen for new notifications
            this.$root.websocket.eventBus.on('new-notification', (data) => {
                if (this.currentUserValue && this.currentUserValue.isLoggedIn) {
                    this.fetchNotificationCount();
                    this.fetchNotifications();
                }
            });
            
            // Listen for notification updates
            this.$root.websocket.eventBus.on('notification-update', (data) => {
                if (this.currentUserValue && this.currentUserValue.isLoggedIn) {
                    this.fetchNotificationCount();
                    this.fetchNotifications();
                }
            });
        }
    },
    watch: {
        currentUser: {
            handler() {
                this.fetchUnreadCountsIfLoggedIn();
            },
            deep: true
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
            this.$root.selectedProfileUserId = null;
            this.$emit('navigate', 'profile');
            this.$root.viewUserProfile(this.currentUserValue.id);
        },
        showCreateGroupModal() {
            this.$emit('show-modal', 'createGroup');
        },
        async toggleDropdown() {
            this.showDropdown = !this.showDropdown;
            if (this.showDropdown) {
                document.addEventListener('click', this.handleOutsideClick);
                // Fetch notifications when dropdown opens
                await this.fetchNotifications();
                // Mark notifications as read when dropdown opens
                await this.markNotificationsAsRead();
            } else {
                document.removeEventListener('click', this.handleOutsideClick);
            }
        },
        handleOutsideClick(e) {
            if (!this.$el.contains(e.target)) {
                this.showDropdown = false;
                document.removeEventListener('click', this.handleOutsideClick);
            }
        },
        async openModal() {
            this.showModal = true;
            this.showDropdown = false;
            // Fetch all notifications when modal opens
            await this.fetchAllNotifications();
            
            // Use layer manager for modal stacking
            this.$nextTick(() => {
                const modalElement = this.$el.querySelector('.modal-overlay');
                if (modalElement && window.layerManager) {
                    window.layerManager.openModal(modalElement);
                }
            });
        },
        closeModal() {
            this.showModal = false;
            
            // Use layer manager to close modal
            this.$nextTick(() => {
                const modalElement = this.$el.querySelector('.modal-overlay');
                if (modalElement && window.layerManager) {
                    window.layerManager.closeModal(modalElement);
                }
            });
        },
        handleUnreadCountUpdate(event) {
            const { groupId, count } = event.detail;
            this.unreadCounts[groupId] = count;
        },
        fetchUnreadCountsIfLoggedIn() {
            if (this.currentUserValue.isLoggedIn) {
                console.log('NavBar: Fetching unread group counts for user:', this.currentUserValue.id);
                fetch('/api/unread-group-counts', { credentials: 'include' })
                    .then(res => {
                        if (!res.ok) throw new Error('Network response was not ok');
                        return res.json().catch(() => ({})); // fallback to empty object if not JSON
                    })
                    .then(data => {
                        console.log('NavBar: Received unread group counts:', data);
                        this.unreadCounts = data || {};
                    })
                    .catch((error) => {
                        console.error('NavBar: Error fetching unread group counts:', error);
                        this.unreadCounts = {};
                    });
            }
        },
        
        async fetchNotifications() {
            if (!this.currentUserValue.isLoggedIn) return;
            this.loading = true;
            try {
                const response = await fetch('/api/notifications?limit=30', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    this.notifications = data.notifications || [];
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
            } finally {
                this.loading = false;
            }
        },
        
        async fetchAllNotifications() {
            if (!this.currentUserValue.isLoggedIn) return;
            try {
                const response = await fetch('/api/notifications?limit=100', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    this.allNotifications = data.notifications || [];
                }
            } catch (error) {
                console.error('Error fetching all notifications:', error);
            }
        },
        
        async fetchNotificationCount() {
            if (!this.currentUserValue.isLoggedIn) return;
            try {
                const response = await fetch('/api/notifications/count', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    this.notificationCount = data.count || 0;
                }
            } catch (error) {
                console.error('Error fetching notification count:', error);
            }
        },
        
        async handleNotificationAction({ notificationId, action }) {
            if (!this.currentUserValue.isLoggedIn) return;
            try {
                console.log('NavBar: Handling notification action:', notificationId, action);
                
                // Find the notification to get its type
                const notification = this.notifications.find(n => n.id === notificationId);
                if (!notification) {
                    console.error('Notification not found:', notificationId);
                    return;
                }

                let success = false;
                
                if (notification.type === 'follow_request') {
                    // Handle follow request via user endpoint
                    const response = await fetch(`/api/user/follow-request?follower_id=${notification.sender_id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ action })
                    });
                    success = response.ok;
                    if (success && action === 'accept') {
                        // After accepting, navigate to the follower's profile
                        if (this.$root) {
                            this.$root.selectedProfileUserId = notification.sender_id;
                            this.$root.currentView = 'profile';
                        }
                    }
                } else {
                    // Handle other actionable notifications
                    const response = await fetch('/api/notifications/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ notification_id: notificationId, action })
                    });
                    success = response.ok;
                }

                if (success) {
                    console.log('NavBar: Notification action successful');
                    // Remove the notification from the list
                    this.notifications = this.notifications.filter(n => n.id !== notificationId);
                    // Refresh notification count
                    this.fetchNotificationCount();
                } else {
                    console.error('NavBar: Notification action failed');
                    // Show error to user
                    alert('Failed to process notification action. Please try again.');
                }
            } catch (error) {
                console.error('NavBar: Error handling notification action:', error);
                alert('Error processing notification action. Please try again.');
            }
        },
        
        viewUserProfile(userId) {
            this.$emit('view-profile', userId);
            this.closeDropdown();
        },
        
        viewPost(postId) {
            // Navigate to post (implement as needed)
            console.log('View post:', postId);
            this.closeDropdown();
        },
        
        viewEvent(eventId) {
            // Navigate to event (implement as needed)
            console.log('View event:', eventId);
            this.closeDropdown();
        },
        
        viewGroup(groupId) {
            // Navigate to group (implement as needed)
            console.log('View group:', groupId);
            this.closeDropdown();
        },
        
        closeDropdown() {
            this.showDropdown = false;
            document.removeEventListener('click', this.handleOutsideClick);
        },
        
        async markNotificationsAsRead() {
            if (!this.currentUserValue.isLoggedIn) return;
            try {
                await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    credentials: 'include'
                });
                // Update notification count after marking as read
                await this.fetchNotificationCount();
            } catch (error) {
                console.error('Error marking notifications as read:', error);
            }
        },

        async refreshNotifications() {
            await this.fetchNotifications();
            await this.fetchNotificationCount();
            if (this.showModal) {
                await this.fetchAllNotifications();
            }
        }
    },
    mounted() {
        this.fetchNotificationCount();
        this.fetchNotifications();
        
        // Listen for notification count updates from WebSocket
        if (this.$root && this.$root.websocket && this.$root.websocket.eventBus) {
            this.$root.websocket.eventBus.on('notification-count-update', (data) => {
                console.log('NavBar: Notification count update received:', data);
                this.fetchNotificationCount();
                this.fetchNotifications();
            });
        }
    },
    
    beforeUnmount() {
        // Clean up event listeners
        if (this.$root && this.$root.websocket && this.$root.websocket.eventBus) {
            this.$root.websocket.eventBus.off('notification-count-update');
        }
        window.removeEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
    }
};
// No mount here, will be registered globally. 