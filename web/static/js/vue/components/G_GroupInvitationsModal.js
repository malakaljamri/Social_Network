// GroupInvitationsModal Component
const GroupInvitationsModal = {
    data() {
        return {
            invitations: [],
            loading: false,
            error: '',
            processingRequests: new Set() // Track which requests are being processed
        };
    },
    computed: {
        hasInvitations() {
            return this.invitations.length > 0;
        }
    },
    methods: {
        async fetchInvitations() {
            console.log('🔍 Fetching group invitations');
            this.loading = true;
            this.error = '';
            
            try {
                const response = await fetch('/api/groups/invitations', {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('✅ Received group invitations:', data);
                this.invitations = data || [];
            } catch (error) {
                console.error('❌ Error fetching group invitations:', error);
                this.error = 'Failed to load group invitations';
                this.invitations = [];
            } finally {
                this.loading = false;
            }
        },
        
        async handleInvitation(invitationId, action) {
            console.log(`🔍 Handling ${action} invitation ${invitationId}`);
            
            if (this.processingRequests.has(invitationId)) {
                console.log('⚠️ Invitation already being processed:', invitationId);
                return;
            }
            
            this.processingRequests.add(invitationId);
            
            try {
                const response = await fetch('/api/groups/handle-invitation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        invitation_id: invitationId,
                        action: action
                    }),
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                console.log(`✅ Successfully ${action}ed invitation ${invitationId}`);
                
                // Remove the invitation from the list
                this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
                
                // Emit event to notify parent components
                this.$emit('invitation-handled', { invitationId, action });
                
                // Dispatch event to refresh invitation count in G_GroupList
                window.dispatchEvent(new CustomEvent('refresh-invitation-count'));
                
            } catch (error) {
                console.error(`❌ Error ${action}ing invitation:`, error);
                alert(`Failed to ${action} invitation. Please try again.`);
            } finally {
                this.processingRequests.delete(invitationId);
            }
        },
        
        formatDate(dateStr) {
            return window.formatDate ? window.formatDate(dateStr, "YYYY-MM-DD HH:MM") : new Date(dateStr).toLocaleString();
        },
        
        close() {
            console.log('🔍 Closing group invitations modal');
            this.$emit('close');
        }
    },
    
    mounted() {
        console.log('🔍 GroupInvitationsModal mounted');
        this.fetchInvitations();
    },
    
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content" @click.stop style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Group Invitations</h2>
                        <button class="modal-close" @click="close" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div v-if="loading" class="loading-indicator">
                            <p>Loading group invitations...</p>
                        </div>
                        
                        <div v-else-if="error" class="error-message">
                            <p>{{ error }}</p>
                        </div>
                        
                        <div v-else-if="!hasInvitations" class="no-invitations">
                            <p>No pending group invitations</p>
                        </div>
                        
                        <div v-else class="invitations-list">
                            <div v-for="invitation in invitations" :key="invitation.id" class="invitation-item">
                                <div class="invitation-info">
                                    <div class="invitation-header">
                                        <strong>{{ invitation.group_name }}</strong>
                                        <span class="invitation-date">{{ formatDate(invitation.created_at) }}</span>
                                    </div>
                                    <div class="invitation-details">
                                        <p>Invited by: <strong>{{ invitation.inviter_name }}</strong></p>
                                    </div>
                                </div>
                                
                                <div class="invitation-actions">
                                    <button 
                                        @click="handleInvitation(invitation.id, 'accept')"
                                        :disabled="processingRequests.has(invitation.id)"
                                        class="button accept-btn"
                                        :class="{ 'loading': processingRequests.has(invitation.id) }"
                                    >
                                        <i v-if="processingRequests.has(invitation.id)" class="fas fa-spinner fa-spin"></i>
                                        <i v-else class="fas fa-check"></i>
                                        Accept
                                    </button>
                                    
                                    <button 
                                        @click="handleInvitation(invitation.id, 'decline')"
                                        :disabled="processingRequests.has(invitation.id)"
                                        class="button decline-btn"
                                        :class="{ 'loading': processingRequests.has(invitation.id) }"
                                    >
                                        <i v-if="processingRequests.has(invitation.id)" class="fas fa-spinner fa-spin"></i>
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
    
    emits: ['close', 'invitation-handled']
};

window.G_GroupInvitationsModal = GroupInvitationsModal; 