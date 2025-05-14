// GroupsView Component
const GroupsView = {
    template: `
        <div class="groups-view">
            <groups-list :groups="groups" :selected-group-id="selectedGroupId" @select-group="selectGroup"></groups-list>
            <group-main v-if="selectedGroup">
                <group-posts :group="selectedGroup"></group-posts>
                <group-events :group="selectedGroup"></group-events>
                <group-chat :group="selectedGroup"></group-chat>
            </group-main>
            <div v-else class="no-group-selected">Select a group to view its details.</div>
        </div>
    `,
    data() {
        return {
            groups: [],
            selectedGroupId: null
        };
    },
    computed: {
        selectedGroup() {
            return this.groups.find(g => g.ID === this.selectedGroupId) || null;
        }
    },
    methods: {
        async fetchGroups() {
            try {
                const response = await fetch('/api/groups');
                const data = await response.json();
                this.groups = data;
            } catch (error) {
                console.error('Error fetching groups:', error);
            }
        },
        selectGroup(groupId) {
            this.selectedGroupId = groupId;
        }
    },
    mounted() {
        this.fetchGroups();
    }
};

// No mount here, will be registered globally. 