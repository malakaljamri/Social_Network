// FollowRequestList Component
const P_FollowRequestList = {
    template: `
        <div class="follow-requests">
            <h3>Follow Requests</h3>
            <div v-if="loading" class="loading">Loading follow requests...</div>
            <div v-else-if="requests.length === 0" class="no-requests">
                No pending follow requests
            </div>
            <div v-else class="request-list">
                <div v-for="request in requests" :key="request.id" class="request-item">
                    <div class="user-info">
                        <img :src="request.avatar || '/static/images/default-avatar.png'" 
                             :alt="request.username" 
                             class="avatar">
                        <div class="user-details">
                            <h4>{{ request.username }}</h4>
                            <p>{{ request.email }}</p>
                        </div>
                    </div>
                    <div class="request-actions">
                        <button @click="handleRequest(request.id, 'accept')" 
                                class="btn btn-success">
                            Accept
                        </button>
                        <button @click="handleRequest(request.id, 'decline')" 
                                class="btn btn-danger">
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            requests: [],
            loading: true
        };
    },
    methods: {
        async loadFollowRequests() {
            try {
                const response = await fetch('/api/profile/follow-requests', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error('Failed to load follow requests');
                }
                this.requests = await response.json();
            } catch (error) {
                console.error('Error loading follow requests:', error);
            } finally {
                this.loading = false;
            }
        },
        async handleRequest(followerId, action) {
            try {
                const response = await fetch(`/api/profile/follow-request?follower_id=${followerId}`, {
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
                this.requests = this.requests.filter(req => req.id !== followerId);
                
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