// NavBar Component
const NavBar = {
    template: `
        <nav class="navbar" style="display: flex; align-items: center; justify-content: space-between;">
            <div class="nav-left" style="display: flex; align-items: center; gap: 24px; flex: 1;">
                <a href="http://localhost:8080"><span class="navbar-title" style="font-size: 1.3rem; font-weight: bold; color: #fff;">Social Network</span></a>
                <div v-if="currentUser.isLoggedIn" class="notifications-wrapper" style="display: inline-block; position: relative;">
                    <button class="button notification-bell" @click="toggleDropdown" style="font-size: 16px; position: relative;">
                        Notifications
                        <span v-if="unreadNotificationCount > 0" class="unread-badge right-badge">{{ unreadNotificationCount }}</span>
                    </button>
                </div>
                <div v-if="showModal" class="modal-overlay post-card" @click.self="closeModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: var(--overlay-color); z-index: var(--z-index-modal); display: flex; align-items: center; justify-content: center;">
                    <div class="modal-content" @click.stop style="border-radius: var(--border-radius-lg); padding: var(--spacing-xl); min-width: 350px; max-width: 90vw; max-height: 80vh; overflow-y: auto; background: var(--card-color); color: var(--text-color); box-shadow: var(--shadow-xl);">
                        <h2 style="color: var(--text-color); margin-bottom: var(--spacing-lg);">All Notifications</h2>
                        <!-- <div v-for="n in 10" :key="n" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 500;">Notification {{ n }}</span><br>
                            <span style="font-size: 12px; color: #888;">This is a placeholder notification in the modal.</span>
                        </div> -->
                        <div v-if="!notifications || notifications.length === 0" style="color: var(--text-secondary); text-align: center; padding: var(--spacing-xl);">
                            <p>No notifications</p>
                        </div>
                        <div v-else>
                            <!-- Unread notifications -->
                            <div v-for="notification in unreadNotifications" :key="notification.id" 
                                 @click="handleNotificationClick(notification)"
                                 :style="{ 
                                     padding: 'var(--spacing-md) 0', 
                                     borderBottom: '1px solid var(--surface-alt-color)', 
                                     cursor: 'pointer',
                                     backgroundColor: 'var(--sub-card-color)',
                                     transition: 'var(--transition-colors)',
                                     borderRadius: 'var(--border-radius-sm)',
                                     marginBottom: 'var(--spacing-xs)'
                                 }">
                                <p style="margin: 0; font-weight: var(--font-weight-medium); color: var(--text-color);">{{ notification.message || 'Notification' }}</p>
                                <small style="font-size: var(--font-size-xs); color: var(--text-muted);">{{ new Date(notification.created_at).toLocaleString() }}</small>
                            </div>
                            
                            <!-- Read notifications separator -->
                            <div v-if="unreadNotifications.length > 0 && readNotifications.length > 0" 
                                 style="padding: var(--spacing-md) 0; border-bottom: 2px solid var(--surface-alt-color); margin: var(--spacing-md) 0;">
                                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--text-muted); text-align: center; font-style: italic;">
                                    Read notifications (will not persist after page refresh)
                                </p>
                            </div>
                            
                            <!-- Read notifications -->
                            <div v-for="notification in readNotifications" :key="notification.id" 
                                 @click="handleNotificationClick(notification)"
                                 :style="{ 
                                     padding: 'var(--spacing-md) 0', 
                                     borderBottom: '1px solid var(--surface-alt-color)', 
                                     cursor: 'pointer',
                                     backgroundColor: 'transparent',
                                     transition: 'var(--transition-colors)',
                                     borderRadius: 'var(--border-radius-sm)',
                                     marginBottom: 'var(--spacing-xs)',
                                     opacity: '0.7'
                                 }">
                                <p style="margin: 0; font-weight: var(--font-weight-medium); color: var(--text-color);">{{ notification.message || 'Notification' }}</p>
                                <small style="font-size: var(--font-size-xs); color: var(--text-muted);">{{ new Date(notification.created_at).toLocaleString() }}</small>
                            </div>
                        </div>
                        <div style="margin-top: var(--spacing-lg); display: flex; gap: var(--spacing-sm);">
                            <button class="button" @click="closeModal" style="background: var(--button-primary); color: var(--text-on-primary); border: none; padding: var(--spacing-sm) var(--spacing-lg); border-radius: var(--border-radius); font-weight: var(--font-weight-medium); cursor: pointer; transition: var(--transition-colors);">Close</button>
                            <!-- <button class="button secondary-button" @click="debugNotifications" style="background: var(--button-secondary); color: var(--button-secondary-text); border: 1px solid var(--surface-alt-color); padding: var(--spacing-sm) var(--spacing-lg); border-radius: var(--border-radius); font-weight: var(--font-weight-medium); cursor: pointer; transition: var(--transition-colors);">Debug</button> -->
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
            
            <!-- Group Invitations Modal -->
            <g-group-invitations-modal
                v-if="showGroupInvitationsModal"
                @close="showGroupInvitationsModal = false"
                @invitation-handled="handleInvitationHandled"
            />
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
        },
        myId() {
            return this.$root.currentUser?.id || this.$root.currentUser?.value?.id || null;
        },
        totalUnreadGroupCount() {
            if (!this.myId) return 0;
            const total = Object.values(this.unreadCounts).reduce((a, b) => a + (b || 0), 0) + this.pendingInvitationsData;
            console.log('NavBar: Total unread group count calculation:', {
                myId: this.myId,
                unreadCounts: this.unreadCounts,
                pendingInvitations: this.pendingInvitationsData,
                total: total
            });
            return total;
        },
        unreadNotifications() {
            return this.notifications.filter(notification => !notification.is_read);
        },
        readNotifications() {
            return this.notifications.filter(notification => notification.is_read);
        },

    },
    data() {
        return {
            showDropdown: false,
            showModal: false,
            showGroupInvitationsModal: false,
            unreadCounts: {}, // Track unread group counts
            dropdownPosition: { x: 0, y: 0 },
            notifications: [], // Initialize notifications as empty array
            unreadNotificationCount: 0,
            pendingInvitationsData: 0
        };
    },
    mounted() {
        // Fetch unread group counts on page load only if user is logged in
        this.fetchUnreadCountsIfLoggedIn();
        
        // Fetch notifications on page load
        this.fetchNotifications();
        this.fetchUnreadNotificationCount();

        window.addEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        window.addEventListener('invitation-count-update', this.handleInvitationCountUpdate);
        // Listen for websocket notification updates
        this._notificationUpdateHandler = () => {
            console.log('NavBar: Received notification-update event, refreshing notifications.');
            this.fetchNotifications();
            this.fetchUnreadNotificationCount();
        };
        window.addEventListener('notification-update', this._notificationUpdateHandler);
        
        // Listen for real-time group join request notifications
        this._groupJoinRequestNotificationHandler = (event) => {
            console.log('NavBar: Received real-time group join request notification:', event.detail);
            // Immediately add the new notification to the list
            this.addRealTimeNotification(event.detail);
            // Also refresh the unread count
            this.fetchUnreadNotificationCount();
        };
        window.addEventListener('group-join-request-notification', this._groupJoinRequestNotificationHandler);
        
        // Listen for refresh notifications event (from invitation request handling)
        this._refreshNotificationsHandler = () => {
            console.log('NavBar: Received refresh-notifications event, refreshing notifications.');
            
            // Fetch notifications and then refresh dropdown if needed
            this.fetchNotifications().then(() => {
                // Only refresh dropdown after notifications are actually fetched
                if (this.showDropdown) {
                    console.log('NavBar: Refreshing notification dropdown after notifications fetched');
                    this.removeDropdownElement();
                    setTimeout(() => {
                        this.createDropdownElement();
                    }, 100);
                }
            });
            
            this.fetchUnreadNotificationCount();
        };
        window.addEventListener('refresh-notifications', this._refreshNotificationsHandler);
        
        // Note: Removed interval-based notification refresh since we now have real-time WebSocket notifications
        // Real-time notifications will update the UI immediately when they arrive
    },
    watch: {
        currentUser: {
            handler(newVal, oldVal) {
                this.fetchUnreadCountsIfLoggedIn();
                if (newVal && newVal.isLoggedIn && (!oldVal || !oldVal.isLoggedIn)) {
                    console.log('NavBar: Detected login, fetching notifications and unread count.');
                    this.fetchNotifications();
                    this.fetchUnreadNotificationCount();
                }
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
        toggleDropdown() {
            this.showDropdown = !this.showDropdown;
            if (this.showDropdown) {
                this.calculateDropdownPosition();
                document.addEventListener('click', this.handleOutsideClick);
                // Create and append dropdown to body
                this.$nextTick(() => {
                    this.createDropdownElement();
                });
            } else {
                document.removeEventListener('click', this.handleOutsideClick);
                this.removeDropdownElement();
            }
        },
        calculateDropdownPosition() {
            const button = this.$el.querySelector('.notification-bell');
            if (button) {
                const rect = button.getBoundingClientRect();
                this.dropdownPosition = {
                    x: rect.left,
                    y: rect.bottom + 10
                };
            }
        },
        createDropdownElement() {
            // Remove existing dropdown if any
            this.removeDropdownElement();
            
            // Create dropdown container
            const dropdown = document.createElement('div');
            dropdown.id = 'notifications-dropdown';
            dropdown.className = 'notifications-dropdown';
            dropdown.style.cssText = `
                position: fixed;
                left: ${this.dropdownPosition.x}px;
                top: ${this.dropdownPosition.y}px;
                width: 320px;
                background: var(--card-color);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-lg);
                z-index: var(--z-index-dropdown);
                border: 1px solid var(--surface-alt-color);
                color: var(--text-color);
            `;
            
            // Build notifications content based on actual data
            let notificationsContent = '';
            if (!this.notifications || this.notifications.length === 0) {
                notificationsContent = `<div style="padding: var(--spacing-md) var(--spacing-lg); color: var(--text-secondary); text-align: center;"><p>No notifications</p></div>`;
            } else {
                // Get unread and read notifications
                const unreadNotifications = this.notifications.filter(n => !n.is_read);
                const readNotifications = this.notifications.filter(n => n.is_read);
                
                // Build unread notifications
                const unreadContent = unreadNotifications.slice(0, 5).map(notification => 
                    `<div class="notification-item" data-notification-id="${notification.id}" style="padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid var(--surface-alt-color); cursor: pointer; transition: var(--transition-colors); background-color: var(--sub-card-color);">
                        <p style="margin: 0; font-size: var(--font-size-sm); color: var(--text-color); font-weight: var(--font-weight-medium);">${notification.message || 'Notification'}</p>
                        <small style="color: var(--text-muted); font-size: var(--font-size-xs);">${new Date(notification.created_at).toLocaleDateString()}</small>
                    </div>`
                ).join('');
                
                // Build read notifications (show fewer in dropdown)
                const readContent = readNotifications.slice(0, 2).map(notification => 
                    `<div class="notification-item" data-notification-id="${notification.id}" style="padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid var(--surface-alt-color); cursor: pointer; transition: var(--transition-colors); opacity: 0.7;">
                        <p style="margin: 0; font-size: var(--font-size-sm); color: var(--text-color); font-weight: var(--font-weight-medium);">${notification.message || 'Notification'}</p>
                        <small style="color: var(--text-muted); font-size: var(--font-size-xs);">${new Date(notification.created_at).toLocaleDateString()}</small>
                    </div>`
                ).join('');
                
                // Combine content
                notificationsContent = unreadContent;
                if (unreadContent && readContent) {
                    notificationsContent += `<div style="padding: var(--spacing-sm) var(--spacing-lg); border-bottom: 1px solid var(--surface-alt-color); text-align: center;"><small style="color: var(--text-muted); font-style: italic;">Read notifications</small></div>`;
                }
                notificationsContent += readContent;
            }
            
            dropdown.innerHTML = `
                <div class="dropdown-header" style="position: sticky; top: 0; border-bottom: 1px solid var(--surface-alt-color); padding: var(--spacing-sm) var(--spacing-lg); font-weight: var(--font-weight-semibold); background: var(--card-color); border-radius: var(--border-radius) var(--border-radius) 0 0;">
                    <a href="#" id="all-notifications-link" style="color: var(--primary-color); text-decoration: underline; cursor: pointer; display: block; font-size: var(--font-size-sm);">All Notifications</a>
                </div>
                <div class="dropdown-list" style="max-height: 220px; overflow-y: auto;">
                    ${notificationsContent}
                </div>
            `;
            
            document.body.appendChild(dropdown);
            
            // Add event listener for "All Notifications" link
            const allNotificationsLink = dropdown.querySelector('#all-notifications-link');
            if (allNotificationsLink) {
                allNotificationsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openModal();
                });
            }
            
            // Add event listeners for notification items
            const notificationItems = dropdown.querySelectorAll('.notification-item');
            notificationItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const notificationId = parseInt(item.dataset.notificationId);
                    if (notificationId) {
                        // Find the notification object to pass to handler
                        const notification = this.notifications.find(n => n.id === notificationId);
                        if (notification) {
                            this.handleNotificationClick(notification);
                        }
                        this.markNotificationAsRead(notificationId);
                        // Add visual feedback
                        item.style.backgroundColor = 'var(--accent-color)';
                        item.style.color = 'var(--text-on-primary)';
                    }
                });
            });
        },
        removeDropdownElement() {
            const existingDropdown = document.getElementById('notifications-dropdown');
            if (existingDropdown) {
                existingDropdown.remove();
            }
        },
        handleOutsideClick(e) {
            const dropdown = document.getElementById('notifications-dropdown');
            if (dropdown && !dropdown.contains(e.target) && !this.$el.contains(e.target)) {
                this.showDropdown = false;
                document.removeEventListener('click', this.handleOutsideClick);
                this.removeDropdownElement();
            }
        },
        openModal() {
            console.log('NavBar: Opening notifications modal');
            console.log('NavBar: Current notifications array:', this.notifications);
            console.log('NavBar: Notifications length:', this.notifications ? this.notifications.length : 0);
            
            this.showModal = true;
            this.showDropdown = false;
            this.removeDropdownElement();
            
            // Refresh notifications when modal opens
            this.fetchNotifications();
        },
        closeModal() {
            this.showModal = false;
        },
        handleUnreadCountUpdate(event) {
            console.log('NavBar: Received unread group count update:', event.detail);
            const { groupId, count } = event.detail;
            this.unreadCounts[groupId] = count;
            console.log('NavBar: Updated unread counts:', this.unreadCounts);
        },
        handleInvitationCountUpdate(event) {
            console.log('NavBar: Received invitation count update:', event.detail);
            const { count } = event.detail;
            this.pendingInvitationsData = count;
            console.log('NavBar: Updated invitation count:', this.pendingInvitationsData);
        },
        fetchUnreadCountsIfLoggedIn() {
            if (this.currentUserValue.isLoggedIn) {
                console.log('NavBar: Fetching unread group counts for user:', this.currentUserValue.id);
                fetch('/api/unread-group-counts', { credentials: 'include' })
                    .then(res => res.json())
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
        
        fetchNotifications() {
            if (this.currentUserValue.isLoggedIn) {
                console.log('NavBar: Fetching notifications for user:', this.currentUserValue.id);
                return fetch('/api/notifications', { credentials: 'include' })
                    .then(res => {
                        console.log('NavBar: Notifications response status:', res.status);
                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                        }
                        return res.json();
                    })
                    .then(data => {
                        console.log('NavBar: Received notifications data:', data);
                        console.log('NavBar: Notifications array length:', data ? data.length : 0);
                        if (data && data.length > 0) {
                            console.log('NavBar: First notification object:', data[0]);
                            console.log('NavBar: First notification keys:', Object.keys(data[0]));
                        }
                        this.notifications = data || [];
                        console.log('NavBar: Set notifications array:', this.notifications);
                        console.log('NavBar: Updated notifications count:', this.notifications.length);
                        
                        // Debug: Log the current state after updating
                        console.log('NavBar: Current notifications state after fetch:', {
                            arrayLength: this.notifications.length,
                            showDropdown: this.showDropdown,
                            notifications: this.notifications
                        });
                        
                        return data; // Return the data for chaining
                    })
                    .catch((error) => {
                        console.error('NavBar: Error fetching notifications:', error);
                        this.notifications = [];
                        throw error; // Re-throw for chaining
                    });
            } else {
                console.log('NavBar: User not logged in, skipping notification fetch');
                return Promise.resolve([]); // Return resolved promise for consistency
            }
        },
        
        fetchUnreadNotificationCount() {
            if (this.currentUserValue.isLoggedIn) {
                fetch('/api/notifications/unread-count', { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => {
                        console.log('NavBar: Received unread notification count:', data);
                        this.unreadNotificationCount = data.count || 0;
                    })
                    .catch((error) => {
                        console.error('NavBar: Error fetching unread notification count:', error);
                        this.unreadNotificationCount = 0;
                    });
            }
        },

        
        markNotificationAsRead(notificationId) {
            fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ notification_id: notificationId })
            })
            .then(res => res.json())
            .then(data => {
                console.log('NavBar: Marked notification as read:', data);
                // Refresh notifications and count
                this.fetchNotifications().then(() => {
                    this.fetchUnreadNotificationCount();
                });
            })
            .catch((error) => {
                console.error('NavBar: Error marking notification as read:', error);
            });
        },
        
        handleNotificationClick(notification) {
            console.log('NavBar: Notification clicked:', notification);
            console.log('NavBar: Notification type:', notification.type);
            console.log('NavBar: Notification reference_id:', notification.reference_id);
            
            // Mark notification as read first
            this.markNotificationAsRead(notification.id);
            
            // Check notification type and navigate accordingly
            switch (notification.type) {
                case 'group_join_request':
                    console.log('NavBar: Group join request notification detected, navigating to groups');
                    console.log('NavBar: Notification details:', notification);
                    console.log('NavBar: Group ID from notification:', notification.reference_id);
                    
                    // Navigate to groups view and emit event to open join requests modal
                    this.$emit('navigate', 'groups');
                    
                    // Dispatch a custom event that GroupsView can listen to
                    setTimeout(() => {
                        console.log('NavBar: Dispatching open-join-requests-modal event for group:', notification.reference_id);
                        window.dispatchEvent(new CustomEvent('open-join-requests-modal', {
                            detail: { groupId: notification.reference_id }
                        }));
                    }, 100);
                    break;
                    
                case 'group_invitation':
					console.log('NavBar: Group invitation notification detected, opening invitations modal');
					// Open the invitations modal
					this.showGroupInvitationsModal = true;
					break;
					
				case 'group_invitation_request':
					console.log('NavBar: Group invitation request notification detected, navigating to groups');
					// Navigate to groups view and emit event to open invitation requests modal
					this.$emit('navigate', 'groups');
					
					// Dispatch a custom event that GroupsView can listen to
					setTimeout(() => {
						window.dispatchEvent(new CustomEvent('open-invitation-requests-modal', {
							detail: { groupId: notification.reference_id }
						}));
					}, 100);
					break;
                    
                case 'follow_request':
                    console.log('NavBar: Follow request notification detected, navigating to profile');
                    // Navigate to profile view to show pending follow requests
                    this.$emit('navigate', 'profile');
                    
                    // Dispatch event to open follow requests modal
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-follow-requests-modal', {
                            detail: { userId: this.currentUserValue.id }
                        }));
                    }, 100);
                    break;
                    
                case 'follow_accepted':
                case 'follow_declined':
                case 'new_follower':
                    console.log('NavBar: Follow-related notification detected, navigating to profile');
                    // Navigate to profile view
                    this.$emit('navigate', 'profile');
                    break;
                    
                case 'group_event':
                    console.log('NavBar: Group event notification detected, navigating to groups');
                    // Navigate to groups view
                    this.$emit('navigate', 'groups');
                    break;
                    
                default:
                    console.log('NavBar: Unknown notification type, staying on current view');
                    // For unknown types, just mark as read and stay on current view
                    break;
            }
        },
        debugNotifications() {
            console.log('NavBar: Debugging notifications...');
            console.log('NavBar: Current notifications array:', this.notifications);
            console.log('NavBar: Notifications length:', this.notifications ? this.notifications.length : 0);
            console.log('NavBar: Unread notification count:', this.unreadNotificationCount);
            console.log('NavBar: Unread group counts:', this.unreadCounts);
            console.log('NavBar: Current user:', this.currentUserValue);
            console.log('NavBar: My ID:', this.myId);
            
            // Call debug endpoint
            fetch('/api/notifications/debug', { credentials: 'include' })
                .then(res => {
                    console.log('NavBar: Debug response status:', res.status);
                    return res.json();
                })
                .then(data => {
                    console.log('NavBar: Debug endpoint response:', data);
                    alert(`Debug Info:\nUser ID: ${data.user_id}\nRaw notifications: ${data.count}\nCheck console for details`);
                })
                .catch(error => {
                    console.error('NavBar: Debug endpoint error:', error);
                    alert('Debug endpoint error: ' + error.message);
                });
        },
        
        handleInvitationHandled(event) {
            console.log('NavBar: Invitation handled:', event);
            const { invitationId, action, groupId } = event;
            
            // Refresh notifications to update the count
            console.log('NavBar: Refreshing notifications after invitation handled');
            this.fetchNotifications();
            this.fetchUnreadNotificationCount();
            
            // Close the invitations modal since the invitation was handled
            this.showGroupInvitationsModal = false;
            
            // Force refresh the notification dropdown if it's open
            if (this.showDropdown) {
                console.log('NavBar: Refreshing notification dropdown');
                this.removeDropdownElement();
                setTimeout(() => {
                    this.createDropdownElement();
                }, 100);
            }
            
            // If invitation was accepted, we might want to navigate to the group
            if (action === 'accept' && groupId) {
                console.log('NavBar: Invitation accepted, navigating to groups');
                this.$emit('navigate', 'groups');
            }
        },
        
        addRealTimeNotification(notificationData) {
            console.log('NavBar: Adding real-time notification:', notificationData);
            
            // Create a notification object that matches the expected format
            const newNotification = {
                id: Date.now(), // Temporary ID for real-time notifications
                user_id: this.currentUserValue.id,
                type: 'group_join_request',
                reference_id: notificationData.group_id,
                requester_id: notificationData.requester_id,
                is_read: false,
                created_at: notificationData.timestamp || new Date().toISOString(),
                message: notificationData.message
            };
            
            // Add to the beginning of notifications array
            if (!this.notifications) {
                this.notifications = [];
            }
            this.notifications.unshift(newNotification);
            
            // Update unread count immediately
            this.unreadNotificationCount++;
            
            // Show a toast notification for immediate feedback
            this.showToastNotification(notificationData.message);
            
            // Force refresh the notification dropdown if it's open
            if (this.showDropdown) {
                console.log('NavBar: Refreshing notification dropdown after real-time notification');
                this.removeDropdownElement();
                setTimeout(() => {
                    this.createDropdownElement();
                }, 100);
            }
        },
        
        showToastNotification(message) {
            // Create a simple toast notification
            const toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--button-primary);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 100);
            
            // Animate out and remove after 5 seconds
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, 5000);
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.handleOutsideClick);
        window.removeEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        window.removeEventListener('invitation-count-update', this.handleInvitationCountUpdate);
        // Remove websocket notification event listener
        if (this._notificationUpdateHandler) {
            window.removeEventListener('notification-update', this._notificationUpdateHandler);
        }
        // Remove group join request notification event listener
        if (this._groupJoinRequestNotificationHandler) {
            window.removeEventListener('group-join-request-notification', this._groupJoinRequestNotificationHandler);
        }
        // Remove refresh notifications event listener
        if (this._refreshNotificationsHandler) {
            window.removeEventListener('refresh-notifications', this._refreshNotificationsHandler);
        }
        this.removeDropdownElement();
        
        // Note: No interval to clear since we removed interval-based refresh in favor of real-time WebSocket notifications
    }
};
// No mount here, will be registered globally. 
// No mount here, will be registered globally. 