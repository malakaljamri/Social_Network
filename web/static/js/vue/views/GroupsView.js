// GroupsView orchestrates the groups page layout and data
const GroupsView = {
    data() {
        return {
            groups: [],
            selectedGroupId: null,
            selectedGroup: null,
            groupPosts: [],
            groupEvents: { upcoming: [], past: [] },
            categories: []
        };
    },
    methods: {
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
                this.groupPosts = Array.isArray(data) ? data : [];
            } catch (e) {
                this.groupPosts = [];
            }
        },
        async fetchGroupEvents(groupId) {
            try {
                const response = await this.$root.apiFetch(`/api/groups/events?group_id=${groupId}`);
                const data = await response.json();
                this.groupEvents = {
                    upcoming: data.upcoming || [],
                    past: data.past || []
                };
            } catch (e) {
                this.groupEvents = { upcoming: [], past: [] };
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
        }
    },
    mounted() {
        this.fetchGroups();
        this.fetchCategories();
    },
    template: `
        <div class="layout-grid groups-layout">
            <group-list
                :groups="groups"
                :selected-group-id="selectedGroupId"
                @group-selected="handleGroupSelected"
                class="sidebar"
            ></group-list>
            <div class="main-content">
                <group-main
                    :selected-group="selectedGroup"
                    :group-posts="groupPosts"
                    :group-events="groupEvents"
                    :categories="categories"
                    @create-group-post="handleCreateGroupPost"
                ></group-main>
            </div>
            <users-list class="sidebar"></users-list>
        </div>
    `
};
window.GroupsView = GroupsView; 