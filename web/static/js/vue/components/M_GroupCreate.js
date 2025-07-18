// CreateGroupModal Component
const CreateGroupModal = {
    props: {
        show: {
            type: Boolean,
            default: false
        },
        users: {
            type: Array,
            default: () => []
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    template: `
        <teleport to="body">
            <!-- Main Group Creation Modal -->
            <div v-if="show" class="modal-overlay layer-modal" @click.self="$emit('close')">
                <div class="modal-content layer-modal">
                    <h2>Create Group</h2>
                    <form @submit.prevent="createGroup">
                        <div class="form-group">
                            <label for="groupName">Group Name</label>
                            <input 
                                id="groupName"
                                type="text" 
                                v-model="groupName" 
                                placeholder="Enter group name" 
                                required 
                                minlength="3" 
                                maxlength="50"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="groupDescription">Description</label>
                            <textarea 
                                id="groupDescription"
                                v-model="groupDescription" 
                                placeholder="Enter group description" 
                                required 
                                minlength="10" 
                                maxlength="500"
                            ></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="privacySetting">Privacy Setting</label>
                            <select id="privacySetting" v-model="privacySetting" required>
                                <option value="public">🌍 Public - Anyone can see and join</option>
                                <option value="private">🔒 Private - Followers only</option>
                                <option value="custom">👥 Custom - Select specific users</option>
                            </select>
                        </div>
                        
                        <!-- Custom Privacy User Selection -->
                        <div v-if="privacySetting === 'custom'" class="form-group">
                            <label>Selected Users</label>
                            <div class="custom-privacy-section">
                                <a 
                                    href="#" 
                                    @click.prevent="openCustomUserModal"
                                    class="user-selection-link"
                                >
                                    {{ getSelectedUsersText() }}
                                </a>
                            </div>
                        </div>
                        
                        <div v-if="error" class="error-message">{{ error }}</div>
                        
                        <div class="modal-actions">
                            <button 
                                type="submit" 
                                class="button primary-button" 
                                :disabled="loading"
                            >
                                {{ loading ? 'Creating...' : 'Create Group' }}
                            </button>
                            <button 
                                type="button" 
                                class="button secondary-button" 
                                @click="$emit('close')"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Custom User Selection Modal -->
            <div v-if="showCustomUserModal" class="modal-overlay layer-modal" @click.self="closeCustomUserModal">
                <div class="modal-content layer-modal custom-user-modal">
                    <div class="modal-header">
                        <h3>Select Users for Custom Privacy</h3>
                        <button class="close-button" @click="closeCustomUserModal">&times;</button>
                    </div>
                    
                    <div class="search-section">
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            placeholder="Search users..." 
                            class="search-input"
                        >
                    </div>
                    
                    <div class="users-list">
                        <div 
                            v-for="user in getFilteredUsers()" 
                            :key="user.ID || user.id"
                            class="user-item"
                            :class="{ 'selected': isUserSelected(user) }"
                            @click="toggleUserSelection(user)"
                        >
                            <div class="user-info">
                                <img 
                                    :src="user.avatar || user.Avatar || '/static/images/default-avatar.png'" 
                                    :alt="user.username || user.Username"
                                    class="user-avatar"
                                >
                                <span class="username">{{ user.username || user.Username }}</span>
                            </div>
                            <div class="checkbox">
                                <input 
                                    type="checkbox" 
                                    :checked="isUserSelected(user)"
                                    @click.stop
                                    @change="toggleUserSelection(user)"
                                >
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button 
                            type="button" 
                            class="button primary-button" 
                            @click="closeCustomUserModal"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    `,
    data() {
        return {
            groupName: '',
            groupDescription: '',
            privacySetting: 'public',
            showCustomUserModal: false,
            searchQuery: '',
            selectedUsers: [],
            loading: false,
            error: ''
        };
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.resetForm()
            }
        }
    },
    computed: {
        filteredUserList() {
            // Exclude the signed-in user
            return this.users.filter(u => (u.id || u.ID) !== this.currentUser.id && (u.username || u.Username));
        }
    },
    methods: {
        resetForm() {
            this.groupName = ''
            this.groupDescription = ''
            this.privacySetting = 'public'
            this.selectedUsers = []
            this.searchQuery = ''
            this.error = ''
        },
        openCustomUserModal() {
            this.showCustomUserModal = true
        },
        closeCustomUserModal() {
            this.showCustomUserModal = false
            this.searchQuery = ''
        },
        getFilteredUsers() {
            let list = this.filteredUserList;
            if (!this.searchQuery.trim()) {
                return this.sortUsers(list);
            }
            return this.sortUsers(list.filter(user =>
                (user.username || user.Username).toLowerCase().includes(this.searchQuery.toLowerCase())
            ));
        },
        sortUsers(users) {
            // Selected users first, then alphabetically (guard for username)
            return [...users].sort((a, b) => {
                const aSelected = this.selectedUsers.some(u => (u.id || u.ID) === (a.id || a.ID));
                const bSelected = this.selectedUsers.some(u => (u.id || u.ID) === (b.id || b.ID));
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                const aName = (a.username || a.Username || '').toLowerCase();
                const bName = (b.username || b.Username || '').toLowerCase();
                return aName.localeCompare(bName);
            });
        },
        toggleUserSelection(user) {
            const id = user.id || user.ID;
            const index = this.selectedUsers.findIndex(u => (u.id || u.ID) === id);
            if (index > -1) {
                this.selectedUsers.splice(index, 1)
            } else {
                this.selectedUsers.push(user)
            }
        },
        isUserSelected(user) {
            const id = user.id || user.ID;
            return this.selectedUsers.some(u => (u.id || u.ID) === id);
        },
        getSelectedUsersText() {
            if (this.selectedUsers.length === 0) {
                return 'Select specific users'
            }
            return `${this.selectedUsers.length} users selected`
        },
        async createGroup() {
            if (!this.groupName.trim() || !this.groupDescription.trim()) {
                this.error = 'Please fill in all fields'
                return
            }

            if (this.privacySetting === 'custom' && this.selectedUsers.length === 0) {
                this.error = 'Please select at least one user for custom privacy'
                return
            }

            this.loading = true
            this.error = ''

            try {
                const groupData = {
                    name: this.groupName.trim(),
                    description: this.groupDescription.trim(),
                    privacy_setting: this.privacySetting
                }

                // Add selected users for custom privacy
                if (this.privacySetting === 'custom') {
                    groupData.selected_user_ids = this.selectedUsers.map(u => u.id || u.ID)
                }

                const response = await fetch('/api/groups/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(groupData)
                })

                if (response.ok) {
                    const group = await response.json()
                    console.log('✅ Group created successfully:', group)
                    this.$emit('created', group)
                    this.$emit('close')
                } else {
                    const errorData = await response.json()
                    console.error('❌ Group creation failed:', errorData)
                    this.error = errorData.error || errorData.message || 'Failed to create group'
                }
            } catch (error) {
                console.error('Error creating group:', error)
                this.error = 'Failed to create group'
            } finally {
                this.loading = false
            }
        }
    },
    emits: ['close', 'created']
};

// No mount here, will be registered globally.
window.M_GroupCreate = CreateGroupModal; 