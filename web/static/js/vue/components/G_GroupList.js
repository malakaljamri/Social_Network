// GroupList Component
const GroupList = {
    props: ['groups', 'selectedGroupId', 'onGroupSelected', 'currentUser'],
    data() {
        return {
            searchQuery: '',
            groupAccess: new Map(), // Store access status for each group
            groupMembership: new Map() // Store membership status for each group
        };
    },
    computed: {
        filteredGroups() {
            if (!this.searchQuery) return this.groups;
            const query = this.searchQuery.toLowerCase();
            return this.groups.filter(group => group.Name.toLowerCase().includes(query));
        }
    },
    mounted() {
        this.fetchAllGroupAccess();
    },
    watch: {
        groups: {
            handler() {
                this.fetchAllGroupAccess();
            },
            immediate: true
        },
        currentUser: {
            handler() {
                this.fetchAllGroupAccess();
            },
            deep: true
        }
    },
    methods: {
        async fetchAllGroupAccess() {
            if (!this.currentUser || !this.currentUser.isLoggedIn || !this.groups.length) {
                this.groupAccess = new Map();
                this.groupMembership = new Map();
                return;
            }
            const groupIds = this.groups.map(g => g.ID);
            try {
                const response = await fetch('/api/groups/access/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group_ids: groupIds }),
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
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
            } catch (error) {
                console.error('Error fetching batch group access:', error);
            }
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
            }
            return ''; // Public group, no indicator needed
        }
    },
    template: `
        <div class="group-list-container">
            <h3 class="group-list-header">List of Groups</h3>
            <button class="button" style="margin-bottom: 10px; width: 100%;" @click="showCreateGroupModal">➕ Create Group</button>
            <input type="text" placeholder="Search groups..." class="group-search" v-model="searchQuery">
            <div class="group-list">
                <div v-for="group in filteredGroups" :key="group.ID"
                    :class="['group-list-item', { 'active': selectedGroupId === group.ID }]"
                    @click="selectGroup(group.ID)">
                    <span>{{ group.Name }}</span>
                    <span v-if="getPrivacyIndicator(group)" class="privacy-indicator">{{ getPrivacyIndicator(group) }}</span>
                </div>
            </div>
        </div>
    `
};
window.G_GroupList = GroupList; 