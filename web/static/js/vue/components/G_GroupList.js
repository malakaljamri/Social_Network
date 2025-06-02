// GroupList Component
const GroupList = {
    props: ['groups', 'selectedGroupId', 'onGroupSelected'],
    data() {
        return {
            searchQuery: ''
        };
    },
    computed: {
        filteredGroups() {
            if (!this.searchQuery) return this.groups;
            const query = this.searchQuery.toLowerCase();
            return this.groups.filter(group => group.Name.toLowerCase().includes(query));
        }
    },
    methods: {
        selectGroup(groupId) {
            this.$emit('group-selected', groupId);
        },
        showCreateGroupModal() {
            this.$emit('show-create-group-modal');
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
                    {{ group.Name }}
                </div>
            </div>
        </div>
    `
};
window.G_GroupList = GroupList; 