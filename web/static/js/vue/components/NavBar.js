// NavBar Component
const NavBar = {
    template: `
        <nav class="navbar" style="display: flex; align-items: center; justify-content: space-between;">
            <div class="nav-left" style="display: flex; align-items: center; gap: 24px; flex: 1;">
                <a href="http://localhost:8080"><span class="navbar-title" style="font-size: 1.3rem; font-weight: bold; color: #fff;">Social Network</span></a>
                <div v-if="currentUser.isLoggedIn" class="notifications-wrapper" style="display: inline-block; position: relative;">
                    <button class="button notification-bell" @click="toggleDropdown" style="font-size: 16px; position: relative;">
                        Notifications
                    </button>
                </div>
                <div v-if="showModal" class="modal-overlay post-card" @click.self="closeModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.2); z-index: 99999; display: flex; align-items: center; justify-content: center;">
                    <div class="modal-content" @click.stop style="border-radius: 10px; padding: 32px; min-width: 350px; max-width: 90vw; max-height: 80vh; overflow-y: auto;">
                        <h2>All Notifications</h2>
                        <!-- <div v-for="n in 10" :key="n" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 500;">Notification {{ n }}</span><br>
                            <span style="font-size: 12px; color: #888;">This is a placeholder notification in the modal.</span>
                        </div> -->
                        <div v-if="!notifications || notifications.length === 0">
                            <p>No notifications</p>
                        </div>
                        <div v-else>
                            <div v-for="notification in notifications" :key="notification.id">
                                <p>{{ notification.message }}</p>
                            </div>
                        </div>
                        <button class="button" @click="closeModal" style="margin-top: 20px;">Close</button>
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
            dropdownPosition: { x: 0, y: 0 },
            notifications: [] // Initialize notifications as empty array
        };
    },
    mounted() {
        // Fetch unread group counts on page load only if user is logged in
        this.fetchUnreadCountsIfLoggedIn();

        window.addEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
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
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                z-index: 99999;
                border: 1px solid #e0e0e0;
            `;
            
            // Build notifications content based on actual data
            let notificationsContent = '';
            if (!this.notifications || this.notifications.length === 0) {
                notificationsContent = '<div style="padding: 12px 16px;"><p>No notifications</p></div>';
            } else {
                notificationsContent = this.notifications.map(notification => 
                    `<div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
                        <p>${notification.message || 'Notification'}</p>
                    </div>`
                ).join('');
            }
            
            dropdown.innerHTML = `
                <div class="dropdown-header" style="position: sticky; top: 0; border-bottom: 1px solid #eee; padding: 10px 16px; font-weight: bold;">
                    <a href="#" id="all-notifications-link" style="color: #1976d2; text-decoration: underline; cursor: pointer; display: block;">All Notifications</a>
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
            this.showModal = true;
            this.showDropdown = false;
            this.removeDropdownElement();
        },
        closeModal() {
            this.showModal = false;
        },
        handleUnreadCountUpdate(event) {
            const { groupId, count } = event.detail;
            this.unreadCounts[groupId] = count;
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
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.handleOutsideClick);
        window.removeEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        this.removeDropdownElement();
    }
};
// No mount here, will be registered globally. 