// // GroupsView Component
// const GroupsView = {
//     template: `
//         <div id="group-main" class="groups-view">
//             <div class="group-list-container">
//                 <h3 class="group-list-header">List of Groups</h3>
//                 <input type="text" placeholder="Search groups..." class="group-search" v-model="groupSearchQuery">
//                 <div class="group-list">
//                     <div v-for="group in filteredGroups" :key="group.ID"
//                         :class="['group-list-item', { 'active': selectedGroupId === group.ID }]"
//                         @click="selectGroupById(group.ID)">
//                         {{ group.Name }}
//                     </div>
//                 </div>
//             </div>
//             <div class="group-description">
//                 <h2>Group Description</h2>
//                 <template v-if="!selectedGroup">
//                     <p style="color: grey;"><span style="color: blue;">↖</span> Click on a group</p>
//                 </template>
//                 <template v-else>
//                     <button @click="showGroupEventsModal = true" class="group-events-btn" style="margin-bottom: 16px;">
//                         <i class="fas fa-calendar-alt"></i> Group Events
//                     </button>
//                     <p><strong>created by:</strong> {{ selectedGroup.Creator?.Username || 'unknown' }}</p>
//                     <p><strong>created on:</strong> {{ formatDate(selectedGroup.CreatedAt) }}</p>
//                     <p>{{ selectedGroup.Description }}</p>
//                 </template>
//             </div>
//             <div v-if="showGroupEventsModal" class="modal-overlay" @click.self="showGroupEventsModal = false">
//                 <div class="modal-content">
//                     <h2>Group Events</h2>
//                     <div class="form-group">
//                         <h3>Upcoming Events</h3>
//                         <div v-if="groupEvents.upcoming.length === 0" style="color: #888; padding: 8px;">No upcoming events</div>
//                         <div v-for="event in groupEvents.upcoming" :key="event.id" class="event-item">
//                             <strong>{{ event.title }}</strong> - {{ formatDate(event.date) }}
//                         </div>
//                     </div>
//                     <div class="form-group">
//                         <h3>Past Events</h3>
//                         <div v-if="groupEvents.past.length === 0" style="color: #888; padding: 8px;">No past events</div>
//                         <div v-for="event in groupEvents.past" :key="event.id" class="event-item">
//                             <strong>{{ event.title }}</strong> - {{ formatDate(event.date) }}
//                         </div>
//                     </div>
//                     <button type="button" class="cancel-btn" @click="showGroupEventsModal = false">Close</button>
//                 </div>
//             </div>
//             <div class="group-posts">
//                 <h2>{{ selectedGroup ? (selectedGroup.Name + ' Posts') : 'Group Posts' }}</h2>
//                 <div v-if="!selectedGroup">
//                     <p style="color: grey;">Select a group to view its posts</p>
//                 </div>
//                 <div v-else>
//                     <div v-if="groupPosts.length === 0" class="no-posts">No posts in this group yet</div>
//                     <div v-for="post in groupPosts" :key="post.ID" class="post-card">
//                         <div class="post-header">
//                             <h3>{{ post.Title }}</h3>
//                             <div class="post-meta">
//                                 <span class="post-author">Posted by {{ post.Author }}</span>
//                                 <span class="post-date">{{ formatDate(post.CreatedAt) }}</span>
//                             </div>
//                         </div>
//                         <div class="post-content">{{ post.Content }}</div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     `,
//     data() {
//         return {
//             groups: [],
//             groupSearchQuery: '',
//             selectedGroupId: null,
//             selectedGroup: null,
//             showGroupEventsModal: false,
//             groupEvents: { upcoming: [], past: [] },
//             groupPosts: [],
//         };
//     },
//     computed: {
//         filteredGroups() {
//             if (!this.groupSearchQuery) return this.groups;
//             const query = this.groupSearchQuery.toLowerCase();
//             return this.groups.filter(group => group.Name.toLowerCase().includes(query));
//         }
//     },
//     methods: {
//         async fetchGroups() {
//             try {
//                 const response = await this.$root.apiFetch('/api/groups');
//                 const data = await response.json();
//                 this.groups = data || [];
//             } catch (e) {
//                 this.groups = [];
//             }
//         },
//         selectGroupById(groupId) {
//             this.selectedGroupId = groupId;
//             this.selectedGroup = this.groups.find(g => g.ID === groupId) || null;
//             this.fetchGroupPosts(groupId);
//             this.fetchGroupEvents(groupId);
//         },
//         async fetchGroupPosts(groupId) {
//             try {
//                 const response = await this.$root.apiFetch(`/api/groups/posts?group_id=${groupId}`);
//                 const data = await response.json();
//                 this.groupPosts = Array.isArray(data) ? data : [];
//             } catch (e) {
//                 this.groupPosts = [];
//             }
//         },
//         async fetchGroupEvents(groupId) {
//             try {
//                 const response = await this.$root.apiFetch(`/api/groups/events?group_id=${groupId}`);
//                 const data = await response.json();
//                 this.groupEvents = {
//                     upcoming: data.upcoming || [],
//                     past: data.past || []
//                 };
//             } catch (e) {
//                 this.groupEvents = { upcoming: [], past: [] };
//             }
//         },
//         formatDate(dateStr) {
//             return new Date(dateStr).toLocaleString();
//         }
//     },
//     mounted() {
//         this.fetchGroups();
//     }
// };

// window.GroupsView = GroupsView; 