// NavBar Component
const NavBar = {
    template: `
        <nav class="navbar" style="display: flex; align-items: center; justify-content: space-between;">
            <div class="nav-left" style="display: flex; align-items: center; gap: 24px; flex: 1;">
                <a href="http://localhost:8080"><span class="navbar-title" style="font-size: 1.3rem; font-weight: bold; color: #fff;">Social Network</span></a>
                <div v-if="currentUser.isLoggedIn" class="notifications-wrapper" style="display: inline-block; position: relative;">
                    <button class="button notification-bell" @click="toggleDropdown" style="font-size: 16px; position: relative;">
                        Notifications
                        <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount }}</span>
                    </button>
                    <div v-if="showDropdown" class="notifications-dropdown" @click.stop style="position: absolute; left: 0; top: 40px; width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); z-index: 1000;">
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
                <button class="button secondary-button" @click="goToGroups">👥 Groups</button>
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
        },
        currentUserValue() {
            return this.currentUser || { isLoggedIn: false, username: '' };
        }
    },
    data() {
        return {
            showDropdown: false,
            showModal: false,
            notifications: [],
            allNotifications: [],
            notificationCount: 0,
            loading: false
        };
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
        },
        closeModal() {
            this.showModal = false;
        },
        
        async fetchNotifications() {
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
            // Refresh notifications after action
            await this.fetchNotifications();
            await this.fetchNotificationCount();
            
            // If modal is open, refresh all notifications too
            if (this.showModal) {
                await this.fetchAllNotifications();
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
    async mounted() {
        // Fetch initial notification count
        await this.fetchNotificationCount();
    },
    beforeUnmount() {
        document.removeEventListener('click', this.handleOutsideClick);
    }
};
// No mount here, will be registered globally. 