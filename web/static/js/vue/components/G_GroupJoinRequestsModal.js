// GroupJoinRequestsModal Component
const GroupJoinRequestsModal = {
    props: {
        groupId: {
            type: Number,
            required: true
        },
        groupName: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            joinRequests: [],
            loading: false,
            error: '',
            processingRequests: new Set() // Track which requests are being processed
        };
    },
    computed: {
        hasRequests() {
            return this.joinRequests.length > 0;
        }
    },
    methods: {
        async fetchJoinRequests() {
            console.log('🔍 Fetching join requests for group:', this.groupId);
            this.loading = true;
            this.error = '';
            
            try {
                const response = await fetch(`/api/groups/join-requests?group_id=${this.groupId}`, {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('✅ Received join requests data:', data);
                console.log('✅ Data type:', typeof data);
                console.log('✅ Data length:', Array.isArray(data) ? data.length : 'Not an array');
                if (Array.isArray(data) && data.length > 0) {
                    console.log('✅ First request structure:', data[0]);
                    console.log('✅ First request keys:', Object.keys(data[0]));
                }
                
                this.joinRequests = data || [];
                console.log('✅ Set joinRequests to:', this.joinRequests);
            } catch (error) {
                console.error('❌ Error fetching join requests:', error);
                this.error = 'Failed to load join requests';
                this.joinRequests = [];
            } finally {
                this.loading = false;
            }
        },
        
        async handleRequest(userId, action) {
            console.log(`🔍 Handling ${action} request for user ${userId} in group ${this.groupId}`);
            
            if (this.processingRequests.has(userId)) {
                console.log('⚠️ Request already being processed for user:', userId);
                return;
            }
            
            this.processingRequests.add(userId);
            
            try {
                const response = await fetch('/api/groups/handle-join-request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        group_id: this.groupId,
                        user_id: userId,
                        action: action
                    }),
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                console.log(`✅ Successfully ${action}ed request for user ${userId}`);
                
                // Remove the request from the list
                this.joinRequests = this.joinRequests.filter(req => req.ID !== userId);
                
                // Emit event to notify parent components
                this.$emit('request-handled', { userId, action, groupId: this.groupId });
                
            } catch (error) {
                console.error(`❌ Error ${action}ing request:`, error);
                alert(`Failed to ${action} request. Please try again.`);
            } finally {
                this.processingRequests.delete(userId);
            }
        },
        
        getAvatarUrl(avatar) {
            if (!avatar) {
                return '/static/images/default-avatar.png';
            }
            if (avatar.startsWith('http')) {
                return avatar;
            }
            return `/web/${avatar}`;
        },
        
        close() {
            console.log('🔍 Closing join requests modal');
            this.$emit('close');
        }
    },
    
    mounted() {
        console.log('🔍 GroupJoinRequestsModal mounted for group:', this.groupId);
        console.log('🔍 GroupJoinRequestsModal groupId type:', typeof this.groupId);
        console.log('🔍 GroupJoinRequestsModal groupId value:', this.groupId);
        this.fetchJoinRequests();
    },
    
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content" @click.stop style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Join Requests - {{ groupName }}</h2>
                        <button class="modal-close" @click="close" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div v-if="loading" class="loading-indicator">
                            <p>Loading join requests...</p>
                        </div>
                        
                        <div v-else-if="error" class="error-message">
                            <p>{{ error }}</p>
                        </div>
                        
                        <div v-else-if="!hasRequests" class="no-requests">
                            <p>No pending join requests</p>
                            <!-- Debug information -->
                            <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px;">
                                <p><strong>Debug Info:</strong></p>
                                <p>joinRequests length: {{ joinRequests.length }}</p>
                                <p>joinRequests data: {{ JSON.stringify(joinRequests, null, 2) }}</p>
                                <p>hasRequests computed: {{ hasRequests }}</p>
                            </div>
                        </div>
                        
                        <div v-else class="requests-list">
                            <div v-for="request in joinRequests" :key="request.ID" class="request-item">
                                <div class="request-user-info">
                                    <img 
                                        :src="getAvatarUrl(request.Avatar)" 
                                        :alt="request.Username + ' avatar'"
                                        class="request-avatar"
                                    >
                                    <div class="request-details">
                                        <strong>{{ request.Username }}</strong>
                                        <span v-if="request.Nickname" class="nickname">({{ request.Nickname }})</span>
                                    </div>
                                </div>
                                
                                <div class="request-actions">
                                    <button 
                                        @click="handleRequest(request.ID, 'accept')"
                                        :disabled="processingRequests.has(request.ID)"
                                        class="button accept-btn"
                                        :class="{ 'loading': processingRequests.has(request.ID) }"
                                    >
                                        <i v-if="processingRequests.has(request.ID)" class="fas fa-spinner fa-spin"></i>
                                        <i v-else class="fas fa-check"></i>
                                        Accept
                                    </button>
                                    
                                    <button 
                                        @click="handleRequest(request.ID, 'decline')"
                                        :disabled="processingRequests.has(request.ID)"
                                        class="button decline-btn"
                                        :class="{ 'loading': processingRequests.has(request.ID) }"
                                    >
                                        <i v-if="processingRequests.has(request.ID)" class="fas fa-times"></i>
                                        <i v-else class="fas fa-times"></i>
                                        Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button @click="close" class="button secondary-button">Close</button>
                    </div>
                </div>
            </div>
        </teleport>
    `,
    
    emits: ['close', 'request-handled']
};

window.G_GroupJoinRequestsModal = GroupJoinRequestsModal; 