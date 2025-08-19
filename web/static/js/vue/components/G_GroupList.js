// GroupList Component
const GroupList = {
    props: ['groups', 'selectedGroupId', 'onGroupSelected', 'currentUser'],
    data() {
        return {
            searchQuery: '',
            groupAccess: new Map(), // Store access status for each group
            groupMembership: new Map(), // Store membership status for each group
            unreadCounts: {}, // Track unread counts by group ID
            pendingInvitationsCount: 0
        };
    },
    computed: {
        filteredGroups() {
            if (!this.searchQuery) return this.groups;
            const query = this.searchQuery.toLowerCase();
            return this.groups.filter(group => group.Name.toLowerCase().includes(query));
        },
        myId() {
            return this.$root.currentUser?.id || this.$root.currentUser?.value?.id || null;
        }
    },
    mounted() {
        this.fetchAllGroupAccess();
        window.addEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        window.addEventListener('refresh-invitation-count', this.fetchPendingInvitationsCount);
        window.addEventListener('invitation-count-update', this.handleInvitationCountUpdate);
        window.addEventListener('group-access-update', this.handleGroupAccessUpdate);

        // Fetch unread group counts on page load only if user is logged in
        if (this.$root.currentUser?.value?.isLoggedIn || this.$root.currentUser?.isLoggedIn) {
            fetch('/api/unread-group-counts', { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    this.unreadCounts = data || {};
                })
                .catch(() => {
                    this.unreadCounts = {};
                });
        }

        // Fetch pending invitations count
        this.fetchPendingInvitationsCount();
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
        },
        pendingInvitationsCount: {
            handler(newCount, oldCount) {
                console.log(`G_GroupList: pendingInvitationsCount changed from ${oldCount} to ${newCount}`);
            },
            immediate: true
        },
        groupAccess: {
            handler(newAccess, oldAccess) {
                console.log('G_GroupList: groupAccess changed:', newAccess);
            },
            deep: true
        },
        groupMembership: {
            handler(newMembership, oldMembership) {
                console.log('G_GroupList: groupMembership changed:', newMembership);
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
            const hasAccess = this.groupAccess.get(group.ID);
            const membershipStatus = this.groupMembership.get(group.ID);
            
            console.log(`G_GroupList: getPrivacyIndicator called for group ${group.ID}: hasAccess=${hasAccess}, membershipStatus=${membershipStatus}, privacy=${group.PrivacySetting}`);
            
            if (group.PrivacySetting === 'private') {
                if (hasAccess) {
                    return '🔒✅'; // Private group, has access
                } else if (membershipStatus === 'pending') {
                    return '🔒⏳'; // Private group, pending approval
                } else {
                    return '🔒❌'; // Private group, no access
                }
            } else {
                // Public group
                if (hasAccess) {
                    return '✅'; // Public group, has access
                } else if (membershipStatus === 'pending') {
                    return '⏳'; // Public group, pending approval
                } else {
                    return '❌'; // Public group, no access
                }
            }
        },
        handleUnreadCountUpdate(event) {
            const { groupId, count } = event.detail;
            this.unreadCounts[groupId] = count;
        },
        updateGroupMembershipStatus(groupId, membershipStatus) {
            // Update the membership status for a specific group immediately
            this.groupMembership.set(groupId, membershipStatus);
            
            // If membership is pending, update access status to false (no access yet)
            if (membershipStatus === 'pending') {
                this.groupAccess.set(groupId, false);
            }
        },
        openGroupInvitations() {
            // Dispatch event to open group invitations modal
            window.dispatchEvent(new CustomEvent('open-group-invitations-modal'));
        },
        fetchPendingInvitationsCount() {
            if (this.$root.currentUser?.value?.isLoggedIn || this.$root.currentUser?.isLoggedIn) {
                fetch('/api/groups/invitations', { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => {
                        console.log('G_GroupList: Received pending invitations count:', data);
                        this.pendingInvitationsCount = Array.isArray(data) ? data.length : 0;
                        // Dispatch event to update NavBar counter
                        window.dispatchEvent(new CustomEvent('invitation-count-update', {
                            detail: { count: this.pendingInvitationsCount }
                        }));
                    })
                    .catch((error) => {
                        console.error('G_GroupList: Error fetching pending invitations count:', error);
                        this.pendingInvitationsCount = 0;
                        window.dispatchEvent(new CustomEvent('invitation-count-update', {
                            detail: { count: 0 }
                        }));
                    });
            }
        },
        handleInvitationCountUpdate(event) {
            console.log('G_GroupList: Received invitation-count-update event with count:', event.detail.count);
            this.pendingInvitationsCount = event.detail.count;
            // Dispatch event to update NavBar counter as well
            window.dispatchEvent(new CustomEvent('invitation-count-update', {
                detail: { count: this.pendingInvitationsCount }
            }));
        },
        handleGroupAccessUpdate(event) {
            const { group_id, has_access, membership_status, user_id, message } = event.detail;
            console.log(`G_GroupList: Received group-access-update event for group ${group_id}: hasAccess=${has_access}, membershipStatus=${membership_status}, userID=${user_id || 'N/A'}`);
            
            // Only update if this is for the current user
            const currentUserId = this.$root.currentUser?.value?.id || this.$root.currentUser?.id;
            if (user_id && user_id !== currentUserId) {
                console.log(`G_GroupList: Ignoring access update for different user: ${user_id} vs ${currentUserId}`);
                return;
            }
            
            // Update the group access and membership maps immediately
            this.groupAccess.set(group_id, has_access);
            this.groupMembership.set(group_id, membership_status);
            
            console.log(`G_GroupList: Updated group ${group_id} access: ${has_access}, membership: ${membership_status}`);
            
            // Show success message if provided
            if (message) {
                console.log(`G_GroupList: ${message}`);
            }
            
            // Force a re-render of the privacy indicators
            this.$forceUpdate();
        }
    },
    beforeUnmount() {
        window.removeEventListener('unread-group-count-update', this.handleUnreadCountUpdate);
        window.removeEventListener('refresh-invitation-count', this.fetchPendingInvitationsCount);
        window.removeEventListener('invitation-count-update', this.handleInvitationCountUpdate);
        window.removeEventListener('group-access-update', this.handleGroupAccessUpdate);
    },
    template: `
        <div class="group-list-container">
            <h3 class="group-list-header">List of Groups</h3>
            <button class="button" style="margin-bottom: 10px; width: 100%;" @click="showCreateGroupModal">➕ Create Group</button>
            <button class="button" style="margin-bottom: 10px; width: 100%;" @click="openGroupInvitations">
                📨 Invitations
                <span v-if="pendingInvitationsCount > 0" class="unread-badge right-badge">{{ pendingInvitationsCount }}</span>
            </button>
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