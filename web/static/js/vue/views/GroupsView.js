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
            categories: [],
            openChats: [], // Track open private chats
            chatTimestamps: {} // Optional: for z-index or ordering
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
                const data = await response.json();
                this.groups = data || [];
            } catch (e) {
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
                    file_path: post.file_path,
                    UserID: post.user_id,
                    Categories: post.category_ids || [],
                    Privacy: post.privacy_setting
                }));
            } catch (e) {
                console.error('❌ Error fetching group posts:', e);
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
                const formData = new FormData();
                formData.append('Title', postData.title);
                formData.append('Text', postData.content);
                formData.append('CategoryIDs', JSON.stringify([postData.category_id]));
                formData.append('Privacy', postData.privacy_setting);
                formData.append('GroupID', this.selectedGroupId.toString());
                
                const response = await this.$root.apiFetch('/api/posts', {
                    method: 'POST',
                    body: formData
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
        
        handleOpenJoinRequestsModal(event) {
            console.log('GroupsView: Received open-join-requests-modal event:', event.detail);
            const { groupId } = event.detail;
            
            // Find the group and select it
            const group = this.groups.find(g => g.ID === groupId);
            if (group) {
                this.handleGroupSelected(group.ID);
                
                // Wait a bit for the group to be selected, then open the modal
                setTimeout(() => {
                    if (this.$refs.groupMain) {
                        this.$refs.groupMain.openGroupJoinRequestsModal();
                    }
                }, 200);
            } else {
                console.log('GroupsView: Group not found for ID:', groupId);
            }
        },
        openChat(user) {
            console.log('🔍 GroupsView openChat called with user:', user);
            if (!user || !user.ID) return;
            if (!this.openChats.some(u => u.ID === user.ID)) {
                this.openChats.push(user);
            }
            // Optionally update chatTimestamps for z-index
            this.chatTimestamps[user.ID] = Date.now();
        },
        closeChat(userId) {
            this.openChats = this.openChats.filter(u => u.ID !== userId);
            // Optionally clean up chatTimestamps
            if (this.chatTimestamps[userId]) {
                delete this.chatTimestamps[userId];
            }
        },
        handleGroupMembershipChanged(data) {
            // Pass the membership change to the group list component
            this.$refs.groupList?.updateGroupMembershipStatus(data.groupId, data.membershipStatus);
        },
        viewUserProfile(userId) {
            console.log('🔍 GroupsView viewUserProfile called with userId:', userId);
            // Use the root method to view user profile
            this.$root.viewUserProfile(userId);
        }
    },
    mounted() {
        this.fetchGroups();
        this.fetchCategories();
        
        // Listen for custom event to open join requests modal
        window.addEventListener('open-join-requests-modal', this.handleOpenJoinRequestsModal);
    },
    beforeUnmount() {
        // Clean up event listener
        window.removeEventListener('open-join-requests-modal', this.handleOpenJoinRequestsModal);
    },
    template: `
        <div class="layout-grid groups-layout">
            <g-group-list
                :groups="groups"
                :selected-group-id="selectedGroupId"
                :current-user="$root.currentUser.value"
                @group-selected="handleGroupSelected"
                @show-create-group-modal="handleOpenCreateGroupModal"
                @group-membership-changed="handleGroupMembershipChanged"
                ref="groupList"
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
                    @group-membership-changed="handleGroupMembershipChanged"
                    @view-user-profile="viewUserProfile"
                    @open-chat="openChat"
                    ref="groupMain"
                ></g-group-main>
            </div>
            <users-list class="sidebar" @open-chat="openChat"></users-list>
            <div id="chat-section chat-window-fixed">
                <chat-window v-for="user in openChats" :key="user.ID" :user="user" :currentUser="$root.currentUser.value" :onClose="() => closeChat(user.ID)" :style="{ zIndex: chatTimestamps[user.ID] || 1 }"></chat-window>
            </div>
            <m-group-create
                v-if="showCreateGroupModal"
                @created="handleGroupCreated"
                @close="showCreateGroupModal = false"
            />
        </div>
    `
};
window.GroupsView = GroupsView; 