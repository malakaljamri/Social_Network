// GroupsView orchestrates the groups page layout and data
const GroupsView = {
    data() {
        return {
            groups: [],
            selectedGroupId: null,
            showCreateGroupModal: false,
            showGroupInvitationsModal: false,
            showGroupInvitationRequestsModal: false,
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
            console.log('GroupsView: handleGroupSelected called with groupId:', groupId);
            this.selectedGroupId = groupId;
            this.selectedGroup = this.groups.find(g => g.ID === groupId) || null;
            console.log('GroupsView: Set selectedGroupId to:', this.selectedGroupId);
            console.log('GroupsView: Set selectedGroup to:', this.selectedGroup);
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
                
                // No need to manually refresh since real-time updates will handle it
                console.log('🔔 GroupsView: Group post created successfully, waiting for real-time update');
            } catch (e) {
                console.error('❌ Failed to create group post:', e);
                alert('Failed to create group post');
            }
        },
        handleOpenCreateGroupPostModal(groupId) {
            this.$emit('open-create-group-post-modal', groupId);
        },
        handleOpenCreateGroupModal() {
            this.showCreateGroupModal = true;
        },
        openGroupInvitationsModal() {
            this.showGroupInvitationsModal = true;
        },
        closeGroupInvitationsModal() {
            this.showGroupInvitationsModal = false;
        },
        handleEventClick(event) {
            this.$emit('event-click', event);
        },
        
        async handleOpenJoinRequestsModal(event) {
            console.log('GroupsView: Received open-join-requests-modal event:', event.detail);
            const { groupId } = event.detail;
            console.log('GroupsView: Looking for group with ID:', groupId);
            
            // Find the group and select it
            const group = this.groups.find(g => g.ID === groupId);
            console.log('GroupsView: Found group:', group);
            
            if (group) {
                console.log('GroupsView: Selecting group:', group.Name);
                this.handleGroupSelected(group.ID);
                
                // Wait for the group selection to complete
                await this.$nextTick();
                
                // Wait a bit more to ensure all async operations complete
                setTimeout(() => {
                    console.log('GroupsView: Attempting to open modal, groupMain ref:', this.$refs.groupMain);
                    console.log('GroupsView: Current selectedGroup:', this.selectedGroup);
                    console.log('GroupsView: Current selectedGroupId:', this.selectedGroupId);
                    
                    if (this.$refs.groupMain && this.selectedGroup) {
                        console.log('GroupsView: Opening join requests modal for group:', this.selectedGroup.Name);
                        this.$refs.groupMain.openGroupJoinRequestsModal();
                    } else {
                        console.log('GroupsView: groupMain ref or selectedGroup not available');
                        console.log('GroupsView: groupMain ref:', this.$refs.groupMain);
                        console.log('GroupsView: selectedGroup:', this.selectedGroup);
                    }
                }, 300);
            } else {
                console.log('GroupsView: Group not found for ID:', groupId);
                console.log('GroupsView: Available groups:', this.groups.map(g => ({ ID: g.ID, Name: g.Name })));
            }
        },
        handleOpenGroupInvitationsModal(event) {
            console.log('GroupsView: Received open-group-invitations-modal event');
            this.openGroupInvitationsModal();
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
        },
        handleInvitationHandled(event) {
            console.log('🔍 Invitation handled:', event);
            const { invitationId, action, groupId, updatedCount, groupAccessInfo } = event;
            
            // If we have an updated count, dispatch event to refresh invitation counter
            if (updatedCount !== undefined) {
                console.log(`🔍 Dispatching invitation-count-update event with count: ${updatedCount}`);
                window.dispatchEvent(new CustomEvent('invitation-count-update', {
                    detail: { count: updatedCount }
                }));
            }
            
            // If we have group access info, dispatch event to update privacy indicators
            if (groupAccessInfo) {
                console.log(`🔍 Dispatching group-access-update event with info:`, groupAccessInfo);
                window.dispatchEvent(new CustomEvent('group-access-update', {
                    detail: groupAccessInfo
                }));
            }
            
            // Could refresh groups or show success message
        },
        
        handleOpenInvitationRequestsModal(event) {
            console.log('GroupsView: Received open-invitation-requests-modal event:', event.detail);
            const { groupId } = event.detail;
            console.log('GroupsView: Setting selectedGroupId to:', groupId);
            this.selectedGroupId = groupId;
            this.selectedGroup = this.groups.find(g => g.ID === groupId) || null;
            console.log('GroupsView: Setting showGroupInvitationRequestsModal to true');
            this.showGroupInvitationRequestsModal = true;
            console.log('GroupsView: showGroupInvitationRequestsModal is now:', this.showGroupInvitationRequestsModal);
        },
        
        closeGroupInvitationRequestsModal() {
            this.showGroupInvitationRequestsModal = false;
        },
        
        handleInvitationRequestHandled(event) {
            console.log('🔍 Invitation request handled:', event);
            // Refresh notifications and close modal
            this.showGroupInvitationRequestsModal = false;
            
            // Emit event to refresh notifications in NavBar
            this.$emit('refresh-notifications');
            
            // Also dispatch a custom window event for the NavBar to catch
            window.dispatchEvent(new CustomEvent('refresh-notifications'));
        },
        
        // Real-time post update handlers
        handleNewPost(event) {
            const newPost = event.detail;
            console.log('🔔 GroupsView: New post received:', newPost);
            
            // Check if this is a group post for the currently selected group
            if (newPost.GroupID && newPost.GroupID.toString() === this.selectedGroupId?.toString()) {
                console.log('🔔 GroupsView: Adding new group post to current group:', newPost);
                
                // Transform the post to match the expected format
                const transformedPost = {
                    ID: newPost.ID || newPost.id,
                    Title: newPost.Title || newPost.title,
                    Content: newPost.Text || newPost.content,
                    Author: newPost.Username || newPost.username,
                    CreatedAt: newPost.CreatedAt || newPost.created_at,
                    file_path: newPost.Image || newPost.file_path,
                    UserID: newPost.UserID || newPost.user_id,
                    Categories: newPost.Categories || newPost.category_ids || [],
                    Privacy: newPost.Privacy || newPost.privacy_setting
                };
                
                // Add the new post to the beginning of the group posts list
                this.groupPosts.unshift(transformedPost);
                
                // Show success notification
                this.showPostNotification('New group post created!', 'success');
            }
        },
        
        handlePostUpdated(event) {
            const updatedPost = event.detail;
            console.log('🔔 GroupsView: Post updated:', updatedPost);
            
            // Check if this is a group post for the currently selected group
            if (updatedPost.GroupID && updatedPost.GroupID.toString() === this.selectedGroupId?.toString()) {
                // Find and update the post in the list
                const index = this.groupPosts.findIndex(post => post.ID === updatedPost.ID);
                if (index !== -1) {
                    // Update the post while preserving the transformed format
                    this.groupPosts[index] = {
                        ...this.groupPosts[index],
                        Title: updatedPost.Title || updatedPost.title,
                        Content: updatedPost.Text || updatedPost.content,
                        Categories: updatedPost.Categories || updatedPost.category_ids || [],
                        Privacy: updatedPost.Privacy || updatedPost.privacy_setting
                    };
                    
                    this.showPostNotification('Group post updated!', 'info');
                }
            }
        },
        
        handlePostDeleted(event) {
            const deletedPost = event.detail;
            console.log('🔔 GroupsView: Post deleted:', deletedPost);
            
            // Check if this is a group post for the currently selected group
            if (deletedPost.GroupID && deletedPost.GroupID.toString() === this.selectedGroupId?.toString()) {
                // Remove the deleted post from the list
                this.groupPosts = this.groupPosts.filter(post => post.ID !== deletedPost.post_id);
                
                this.showPostNotification('Group post deleted!', 'warning');
            }
        },
        
        showPostNotification(message, type = 'info') {
            // Create a simple notification
            const notification = document.createElement('div');
            notification.className = `alert alert-${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                padding: 15px;
                border-radius: 5px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    notification.remove();
                }
            }, 3000);
        }
    },
    mounted() {
        this.fetchGroups();
        this.fetchCategories();
        
        // Listen for custom event to open join requests modal
        window.addEventListener('open-join-requests-modal', this.handleOpenJoinRequestsModal);
        
        // Listen for custom event to open group invitations modal
        window.addEventListener('open-group-invitations-modal', this.handleOpenGroupInvitationsModal);
        
        // Listen for custom event to open invitation requests modal
        window.addEventListener('open-invitation-requests-modal', this.handleOpenInvitationRequestsModal);
        
        // Listen for real-time post updates
        window.addEventListener('new-post', this.handleNewPost);
        window.addEventListener('post-updated', this.handlePostUpdated);
        window.addEventListener('post-deleted', this.handlePostDeleted);
    },
    beforeUnmount() {
        // Clean up event listeners
        window.removeEventListener('open-join-requests-modal', this.handleOpenJoinRequestsModal);
        window.removeEventListener('open-group-invitations-modal', this.handleOpenGroupInvitationsModal);
        window.removeEventListener('open-invitation-requests-modal', this.handleOpenInvitationRequestsModal);
        
        // Clean up real-time post update listeners
        window.removeEventListener('new-post', this.handleNewPost);
        window.removeEventListener('post-updated', this.handlePostUpdated);
        window.removeEventListener('post-deleted', this.handlePostDeleted);
    },
    template: `
        <style>
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        </style>
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
            <g-group-invitations-modal
                v-if="showGroupInvitationsModal"
                @close="closeGroupInvitationsModal"
                @invitation-handled="handleInvitationHandled"
            />
            <g-group-invitation-requests-modal
                v-if="showGroupInvitationRequestsModal"
                :show-modal="showGroupInvitationRequestsModal"
                :group-id="selectedGroupId"
                @close="closeGroupInvitationRequestsModal"
                @request-handled="handleInvitationRequestHandled"
            />
        </div>
    `
};
window.GroupsView = GroupsView; 