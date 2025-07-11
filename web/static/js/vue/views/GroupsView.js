// GroupsView orchestrates the groups page layout and data
const GroupsView = {
    data() {
        return {
            groups: [],
            selectedGroupId: null,
            showCreateGroupModal: false,
            selectedGroup: null,
            groupPosts: [],
            groupEvents: [],
            categories: []
        };
    },
    methods: {
        handleGroupCreated() {
            this.fetchGroups();
            this.showCreateGroupModal = false;
        },
        async fetchGroups() {
            try {
                const response = await this.$root.apiFetch('/api/groups');
                if (response.status === 401) {
                    window.dispatchEvent(new CustomEvent('session-expired'));
                    return;
                }
                const data = await response.json();
                this.groups = data || [];
            } catch (e) {
                if (e.message === 'Unauthorized') {
                    window.dispatchEvent(new CustomEvent('session-expired'));
                    return;
                }
                this.groups = [];
            }
        },
        async fetchGroupPosts(groupId) {
            try {
                const response = await this.$root.apiFetch(`/api/groups/posts?group_id=${groupId}`);
                const data = await response.json();
                this.groupPosts = (Array.isArray(data) ? data : []).map(post => ({
                    ID: post.id,
                    Title: post.title,
                    Content: post.content,
                    Author: post.username,
                    CreatedAt: post.created_at,
                    // add other fields as needed
                }));
            } catch (e) {
                this.groupPosts = [];
            }
        },
        async fetchGroupEvents(groupId) {
            try {
                const response = await this.$root.apiFetch(`/api/groups/events?group_id=${groupId}`);
                const data = await response.json();
                this.groupEvents = Array.isArray(data.events) ? data.events : [];
            } catch (e) {
                this.groupEvents = [];
            }
        },
        async fetchCategories() {
            try {
                const response = await this.$root.apiFetch('/api/categories');
                const data = await response.json();
                this.categories = data || [];
            } catch (e) {
                this.categories = [];
            }
        },
        handleGroupSelected(groupId) {
            this.selectedGroupId = groupId;
            this.selectedGroup = this.groups.find(g => g.ID === groupId) || null;
            this.fetchGroupPosts(groupId);
            this.fetchGroupEvents(groupId);
        },
        async handleCreateGroupPost(postData) {
            try {
                const payload = {
                    ...postData,
                    group_id: this.selectedGroupId
                };
                const response = await this.$root.apiFetch('/api/groups/posts/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('Failed to create group post');
                this.fetchGroupPosts(this.selectedGroupId);
            } catch (e) {
                alert('Failed to create group post');
            }
        },
        handleOpenCreateGroupPostModal(groupId) {
            this.$emit('open-create-group-post-modal', groupId);
        },
        handleOpenCreateGroupModal() {
            this.showCreateGroupModal = true;
        },
        handleEventClick(event) {
            this.$emit('event-click', event);
        },
        clearAllData() {
            this.groups = [];
            this.selectedGroupId = null;
            this.selectedGroup = null;
            this.groupPosts = [];
            this.groupEvents = [];
            this.categories = [];
        },
        handleSessionExpired() {
            this.clearAllData();
            this.$root.goToLogin();
        },
        handleGroupCreated(event) {
            // Refresh groups list when a new group is created
            this.fetchGroups();
        },
        handleGroupMembershipChanged(event) {
            // Refresh groups list to update privacy indicators
            this.fetchGroups();
        }
    },
    mounted() {
        this.fetchGroups();
        this.fetchCategories();
        
        // Listen for data clearing events
        window.addEventListener('clear-all-data', this.clearAllData);
        
        // Listen for session expiry
        window.addEventListener('session-expired', this.handleSessionExpired);
        
        // Listen for WebSocket group events
        window.addEventListener('group-created', this.handleGroupCreated);
        window.addEventListener('group-membership-changed', this.handleGroupMembershipChanged);
    },
    beforeUnmount() {
        window.removeEventListener('clear-all-data', this.clearAllData);
        window.removeEventListener('session-expired', this.handleSessionExpired);
        window.removeEventListener('group-created', this.handleGroupCreated);
        window.removeEventListener('group-membership-changed', this.handleGroupMembershipChanged);
    },
    template: `
        <div class="layout-grid groups-layout">
            <g-group-list
                :groups="groups"
                :selected-group-id="selectedGroupId"
                :current-user="$root.currentUser.value"
                @group-selected="handleGroupSelected"
                @show-create-group-modal="handleOpenCreateGroupModal"
                class="sidebar"
            ></g-group-list>
            <div class="main-content">
                <g-group-main
                    :selected-group="selectedGroup"
                    :group-posts="groupPosts"
                    :group-events="groupEvents"
                    :categories="categories"
                    :current-user="$root.currentUser.value"
                    @create-group-post="handleCreateGroupPost"
                    @open-create-group-post-modal="handleOpenCreateGroupPostModal"
                    @refresh-group-events="fetchGroupEvents(selectedGroupId)"
                    @event-click="handleEventClick"
                ></g-group-main>
            </div>
            <users-list class="sidebar"></users-list>
            <m-group-create
                v-if="showCreateGroupModal"
                @created="handleGroupCreated"
                @close="showCreateGroupModal = false"
            />
        </div>
    `
};
window.GroupsView = GroupsView; 