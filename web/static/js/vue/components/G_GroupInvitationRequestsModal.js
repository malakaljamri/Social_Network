// Group Invitation Requests Modal Component
const G_GroupInvitationRequestsModal = {
    template: `
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Invitation Requests</h2>
                    <button class="close-btn" @click="closeModal">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div v-if="loading" class="loading">
                        Loading invitation requests...
                    </div>
                    
                    <div v-else-if="!invitationRequests || invitationRequests.length === 0" class="no-requests">
                        <p>No pending invitation requests</p>
                    </div>
                    
                    <div v-else class="invitation-requests-list">
                        <div v-for="request in invitationRequests" :key="request.id" class="invitation-request-item">
                            <div class="request-info">
                                <div class="request-header">
                                    <span class="inviter-name">{{ request.inviter_username }}</span>
                                    <span class="request-date">{{ formatDate(request.created_at) }}</span>
                                </div>
                                <div class="request-message">
                                    wants to invite <strong>{{ request.invitee_username }}</strong> to <strong>{{ request.group_name }}</strong>
                                </div>
                            </div>
                            
                            <div class="request-actions">
                                <button class="approve-btn" @click="handleRequest(request.id, 'approve')" :disabled="processing">
                                    Approve
                                </button>
                                <button class="reject-btn" @click="handleRequest(request.id, 'reject')" :disabled="processing">
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="button secondary-button" @click="closeModal">Close</button>
                </div>
            </div>
        </div>
    `,
    
    props: {
        showModal: {
            type: Boolean,
            default: false
        },
        groupId: {
            type: Number,
            default: null
        }
    },
    
    data() {
        return {
            invitationRequests: [],
            loading: false,
            processing: false
        };
    },
    
    watch: {
        showModal(newVal) {
            if (newVal && this.groupId) {
                this.fetchInvitationRequests();
            }
        }
    },
    
    methods: {
        async fetchInvitationRequests() {
            if (!this.groupId) return;
            
            this.loading = true;
            try {
                const response = await fetch(`/api/groups/invitation-requests?group_id=${this.groupId}`, {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.invitationRequests = data;
                console.log('G_GroupInvitationRequestsModal: Fetched invitation requests:', data);
            } catch (error) {
                console.error('G_GroupInvitationRequestsModal: Error fetching invitation requests:', error);
                alert('Failed to fetch invitation requests: ' + error.message);
            } finally {
                this.loading = false;
            }
        },
        
        async handleRequest(requestId, action) {
            this.processing = true;
            try {
                const response = await fetch('/api/groups/invitation-requests/handle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        request_id: requestId,
                        action: action
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('G_GroupInvitationRequestsModal: Request handled:', data);
                
                // Remove the handled request from the list
                this.invitationRequests = this.invitationRequests.filter(req => req.id !== requestId);
                
                // Show success message
                const actionText = action === 'approve' ? 'approved' : 'rejected';
                alert(`Invitation request ${actionText} successfully`);
                
                // Emit event to refresh notifications
                this.$emit('request-handled', { requestId, action, groupId: this.groupId });
                
            } catch (error) {
                console.error('G_GroupInvitationRequestsModal: Error handling request:', error);
                alert('Failed to handle request: ' + error.message);
            } finally {
                this.processing = false;
            }
        },
        
        formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        },
        
        closeModal() {
            this.$emit('close');
        }
    }
};

// Make component available globally
window.G_GroupInvitationRequestsModal = G_GroupInvitationRequestsModal;
