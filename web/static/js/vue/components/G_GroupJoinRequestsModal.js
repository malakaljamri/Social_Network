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
            console.log('🔍 Group ID type:', typeof this.groupId);
            console.log('🔍 Group ID value:', this.groupId);
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
                    console.log('✅ First request ID:', data[0].ID);
                    console.log('✅ First request Username:', data[0].Username);
                }
                
                this.joinRequests = data || [];
                console.log('✅ Set joinRequests to:', this.joinRequests);
                console.log('✅ joinRequests length after setting:', this.joinRequests.length);
                console.log('✅ hasRequests computed value:', this.hasRequests);
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
                
                const result = await response.json();
                console.log(`✅ Successfully ${action}ed request for user ${userId}:`, result);
                
                // Show success message
                const requestIndex = this.joinRequests.findIndex(req => req.ID === userId);
                if (requestIndex !== -1) {
                    // Update the status of the request
                    this.joinRequests[requestIndex].status = action === 'accept' ? 'accepted' : 'declined';
                    
                    // Remove the request from the list after a short delay to show the status
                    setTimeout(() => {
                        this.joinRequests = this.joinRequests.filter(req => req.ID !== userId);
                    }, 1500);
                }
                
                // Emit event to notify parent components
                this.$emit('request-handled', { 
                    userId, 
                    action, 
                    groupId: this.groupId,
                    groupAccessInfo: result.group_access_info || null
                });
                
                // Dispatch custom event to update group access and privacy indicators
                if (result.group_access_info) {
                    console.log(`🔍 Dispatching group-access-update event for join request:`, result.group_access_info);
                    window.dispatchEvent(new CustomEvent('group-access-update', {
                        detail: result.group_access_info
                    }));
                }
                
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
                        <!-- Debug section -->
                        <!-- <div style="background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px; border: 1px solid #ddd;">
                            <p><strong>🔍 Debug Info:</strong></p>
                            <p>Loading: {{ loading }}</p>
                            <p>Error: {{ error || 'None' }}</p>
                            <p>Group ID: {{ groupId }} (type: {{ typeof groupId }})</p>
                            <p>Group Name: {{ groupName }}</p>
                            <p>Join Requests Count: {{ joinRequests.length }}</p>
                            <p>Has Requests: {{ hasRequests }}</p>
                            <p>Raw Data: {{ JSON.stringify(joinRequests, null, 2) }}</p>
                        </div> -->
                        
                        <div v-if="loading" class="loading-indicator">
                            <p>Loading join requests...</p>
                        </div>
                        
                        <div v-else-if="error" class="error-message">
                            <p>{{ error }}</p>
                        </div>
                        
                        <div v-else-if="!hasRequests" class="no-requests">
                            <p>No pending join requests</p>
                            <!-- Debug information -->
                            <!-- <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px;">
                                <p><strong>Debug Info:</strong></p>
                                <p>joinRequests length: {{ joinRequests.length }}</p>
                                <p>joinRequests data: {{ JSON.stringify(joinRequests, null, 2) }}</p>
                                <p>hasRequests computed: {{ hasRequests }}</p>
                            </div> -->
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
                                        <div v-if="request.status === 'accepted'" class="status-message success">
                                            <i class="fas fa-check-circle"></i> Well Done!
                                        </div>
                                        <div v-else-if="request.status === 'declined'" class="status-message error">
                                            <i class="fas fa-times-circle"></i> Declined
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="request-actions" v-if="!request.status">
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

// Add styles for the status messages
const style = document.createElement('style');
style.textContent = `
    .status-message {
        margin-top: 5px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 500;
        transition: all 0.3s ease;
    }

    .status-message.success {
        color: #28a745;
        background-color: rgba(40, 167, 69, 0.1);
        border: 1px solid rgba(40, 167, 69, 0.2);
    }

    .status-message.error {
        color: #dc3545;
        background-color: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.2);
    }

    .status-message i {
        margin-right: 4px;
        font-size: 1.1em;
    }
`;
document.head.appendChild(style); 