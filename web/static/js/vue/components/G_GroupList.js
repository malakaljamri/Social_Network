// GroupList Component
const GroupList = {
    props: {
        groups: Array,
        selectedGroupId: [String, Number],
        currentUser: {
            type: Object,
            required: true
        }
    },
    data() {
        return {
            searchQuery: '',
            groupAccess: new Map(), // Store access status for each group
            groupMembership: new Map(), // Store membership status for each group
            unreadCounts: {}, // Track unread counts by group ID
            accessFetchPromise: null // Prevent duplicate access fetches
        };
    },
    computed: {
        filteredGroups() {
            if (!this.searchQuery) return this.groups;
            const query = this.searchQuery.toLowerCase();
            return this.groups.filter(group => group.Name.toLowerCase().includes(query));
        },
        myId() {
            return (this.currentUser && this.currentUser.id) || null;
        }
    },
    mounted() {
        this.fetchAllGroupAccess();
        
        // Initialize unread count service
        if (window.unreadCountService) {
            window.unreadCountService.addListener((counts) => {
                this.unreadCounts = counts;
            });
        }
        
        // Listen for data clearing events
        window.addEventListener('clear-all-data', this.clearAllData);
        window.addEventListener('session-expired', this.handleSessionExpired);
    },
    beforeUnmount() {
        window.removeEventListener('clear-all-data', this.clearAllData);
        window.removeEventListener('session-expired', this.handleSessionExpired);
        
        // Clean up unread count service listener
        if (window.unreadCountService) {
            window.unreadCountService.removeListener((counts) => {
                this.unreadCounts = counts;
            });
        }
    },
    watch: {
        groups: {
            handler() {
                // Debounce the access fetch to prevent excessive API calls
                if (this.accessFetchTimeout) {
                    clearTimeout(this.accessFetchTimeout);
                }
                this.accessFetchTimeout = setTimeout(() => {
                    this.fetchAllGroupAccess();
                }, 300);
            },
            immediate: true
        },
        currentUser: {
            handler() {
                // Debounce the access fetch to prevent excessive API calls
                if (this.accessFetchTimeout) {
                    clearTimeout(this.accessFetchTimeout);
                }
                this.accessFetchTimeout = setTimeout(() => {
                    this.fetchAllGroupAccess();
                }, 300);
            },
            deep: true
        }
    },
    methods: {
        clearAllData() {
            this.groupAccess = new Map();
            this.groupMembership = new Map();
            this.searchQuery = '';
            this.unreadCounts = {};
            if (this.accessFetchTimeout) {
                clearTimeout(this.accessFetchTimeout);
            }
            if (this.accessFetchPromise) {
                this.accessFetchPromise = null;
            }
        },
        handleSessionExpired() {
            this.clearAllData();
        },
        async fetchAllGroupAccess() {
            // Prevent multiple simultaneous fetches
            if (this.accessFetchPromise) {
                return this.accessFetchPromise;
            }

            if (!this.currentUser || !this.currentUser.isLoggedIn || !this.groups.length) {
                this.groupAccess = new Map();
                this.groupMembership = new Map();
                return;
            }

            const groupIds = this.groups.map(g => g.ID);
            
            this.accessFetchPromise = fetch('/api/groups/access/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_ids: groupIds }),
                credentials: 'include'
            })
            .then(response => {
                if (response.status === 401) {
                    window.dispatchEvent(new CustomEvent('session-expired'));
                    return null;
                }
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to fetch group access');
            })
            .then(data => {
                if (data) {
                    const accessMap = new Map();
                    const membershipMap = new Map();
                    for (const groupId of groupIds) {
                        const info = data[groupId] || {};
                        accessMap.set(groupId, info.has_access);
                        membershipMap.set(groupId, info.membership_status || '');
                    }
                    this.groupAccess = accessMap;
                    this.groupMembership = membershipMap;
                }
            })
            .catch(error => {
                console.error('Error fetching batch group access:', error);
            })
            .finally(() => {
                this.accessFetchPromise = null;
            });

            return this.accessFetchPromise;
        },
        selectGroup(groupId) {
            this.$emit('group-selected', groupId);
        },
        showCreateGroupModal() {
            this.$emit('show-create-group-modal');
        },
        getPrivacyIndicator(group) {
            if (group.PrivacySetting === 'private') {
                const hasAccess = this.groupAccess.get(group.ID);
                const membershipStatus = this.groupMembership.get(group.ID);
                if (hasAccess) {
                    return '🔒✅'; // Private group, has access
                } else if (membershipStatus === 'pending') {
                    return '🔒⏳'; // Private group, pending approval
                } else {
                    return '🔒❌'; // Private group, no access
                }
            } else if (group.PrivacySetting === 'custom') {
                const hasAccess = this.groupAccess.get(group.ID);
                const membershipStatus = this.groupMembership.get(group.ID);
                if (hasAccess) {
                    return '🔒✅'; // Custom group, has access
                } else if (membershipStatus === 'pending') {
                    return '🔒⏳'; // Custom group, pending approval
                } else {
                    return '🔒❌'; // Custom group, no access
                }
            }
            return ''; // Public group, no indicator needed
        },
        // Unread count updates are now handled by the centralized service
    },
    // Cleanup is handled in the main beforeUnmount method
    template: `
        <div class="group-list-container">
            <h3 class="group-list-header">List of Groups</h3>
            <button class="button" style="margin-bottom: 10px; width: 100%;" @click="showCreateGroupModal">➕ Create Group</button>
            <input type="text" placeholder="Search groups..." class="group-search" v-model="searchQuery">
            <div class="group-list">
                <div v-for="group in filteredGroups" :key="group.ID"
                    :class="['group-list-item', { 'active': selectedGroupId === group.ID }, 'group-item-flex']"
                    @click="selectGroup(group.ID)">
                    <span>{{ group.Name }}</span>
                    <span v-if="getPrivacyIndicator(group)" class="privacy-indicator">{{ getPrivacyIndicator(group) }}</span>
                    <span v-if="unreadCounts[group.ID] > 0" class="unread-badge right-badge">{{ unreadCounts[group.ID] }}</span>
                </div>
            </div>
        </div>
    `
};
window.G_GroupList = GroupList;