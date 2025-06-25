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
                    <div v-if="showDropdown" class="notifications-dropdown" @click.stop style="position: absolute; left: 0; top: 40px; width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); z-index: 1000;">
                        <div class="dropdown-header" style="position: sticky; top: 0; background: #fff; border-bottom: 1px solid #eee; padding: 10px 16px; font-weight: bold;">
                            <a href="#" @click.prevent="openModal" style="color: #1976d2; text-decoration: underline; cursor: pointer; display: block;">All Notifications</a>
                        </div>
                        <div class="dropdown-list" style="max-height: 220px; overflow-y: auto;">
                            <div v-for="n in 5" :key="n" class="dropdown-item" style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
                                <span style="font-weight: 500;">Notification {{ n }}</span><br>
                                <span style="font-size: 12px; color: #888;">This is a placeholder notification.</span>
                            </div>
                        </div>
                    </div>
                    <div v-if="showModal" class="modal-overlay" @click.self="closeModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.2); z-index: 2000; display: flex; align-items: center; justify-content: center;">
                        <div class="modal-content" @click.stop style="background: #fff; border-radius: 10px; padding: 32px; min-width: 350px; max-width: 90vw; max-height: 80vh; overflow-y: auto;">
                            <h2>All Notifications</h2>
                            <div v-for="n in 10" :key="n" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                                <span style="font-weight: 500;">Notification {{ n }}</span><br>
                                <span style="font-size: 12px; color: #888;">This is a placeholder notification in the modal.</span>
                            </div>
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
            showModal: false
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
        toggleDropdown() {
            this.showDropdown = !this.showDropdown;
            if (this.showDropdown) {
                document.addEventListener('click', this.handleOutsideClick);
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
        openModal() {
            this.showModal = true;
            this.showDropdown = false;
        },
        closeModal() {
            this.showModal = false;
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.handleOutsideClick);
    }
};
// No mount here, will be registered globally. 