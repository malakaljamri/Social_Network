// FollowRequestList Component
const P_FollowRequestList = {
    template: `
        <div class="expandable-section follow-requests">
            <button class="btn btn-link" @click="showRequests = !showRequests">
                {{ showRequests ? 'Hide' : 'Show' }} Follow Requests ({{ requests ? requests.length : 0 }})
            </button>
            <div v-if="showRequests">
                <div v-if="loading" class="loading">Loading follow requests...</div>
                <div v-else-if="!requests || requests.length === 0" class="no-requests">
                    No pending follow requests
                </div>
                <div v-else class="request-list">
                    <div v-for="request in requests" :key="request.ID" class="request-item">
                        <div class="user-info">
                            <img :src="request.Avatar || '/static/images/default-avatar.png'" 
                                 :alt="request.Username" 
                                 class="avatar avatar-large profile-avatar-img">
                            <div class="user-details">
                                <h4>{{ request.Username }}</h4>
                                <p>{{ request.Email }}</p>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button @click="handleRequest(request.ID, 'accept')" 
                                    class="btn btn-success">
                                Accept
                            </button>
                            <button @click="handleRequest(request.ID, 'decline')" 
                                    class="btn btn-danger">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            requests: [],
            loading: true,
            showRequests: false
        };
    },
    methods: {
        async loadFollowRequests() {
            try {
                const response = await fetch('/api/user/follow-requests', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error('Failed to load follow requests');
                }
                const data = await response.json();
                // Ensure requests is always an array
                this.requests = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Error loading follow requests:', error);
                // Ensure requests is an empty array on error
                this.requests = [];
            } finally {
                this.loading = false;
            }
        },
        async handleRequest(followerId, action) {
            try {
                const response = await fetch(`/api/user/follow-request?follower_id=${followerId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`Failed to ${action} follow request`);
                }

                // Remove the handled request from the list
                this.requests = this.requests.filter(req => req.ID !== followerId);
                
                // Emit event for parent components
                this.$emit('request-handled', { followerId, action });
            } catch (error) {
                console.error(`Error handling follow request:`, error);
                alert(`Failed to ${action} follow request. Please try again.`);
            }
        }
    },
    mounted() {
        this.loadFollowRequests();
    }
};

// No mount here, will be registered globally 