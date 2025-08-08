// GroupInvitationsModal Component
const GroupInvitationsModal = {
    data() {
        return {
            invitations: [],
            loading: false,
            error: '',
            processingInvitations: new Set() // Track which invitations are being processed
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
                
                if (response.ok) {
                    this.invitations = await response.json();
                    console.log('✅ Fetched invitations:', this.invitations);
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || 'Failed to fetch invitations';
                    console.error('❌ Failed to fetch invitations:', errorData);
                }
            } catch (error) {
                console.error('❌ Error fetching invitations:', error);
                this.error = 'Failed to fetch invitations';
            } finally {
                this.loading = false;
            }
        },
        
        async handleInvitation(invitationId, action) {
            console.log(`🔍 Handling invitation ${invitationId} with action: ${action}`);
            
            if (this.processingInvitations.has(invitationId)) {
                return; // Already processing
            }
            
            this.processingInvitations.add(invitationId);
            
            try {
                const response = await fetch('/api/groups/invitations/handle', {
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
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ Invitation ${action}ed successfully:`, result);
                    
                    // Remove the invitation from the list
                    this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
                    
                    // Emit event to notify parent
                    this.$emit('invitation-handled', { 
                        invitationId, 
                        action, 
                        groupId: this.invitations.find(inv => inv.id === invitationId)?.group_id 
                    });
                    
                    // Show success message
                    this.showSuccessMessage(`Invitation ${action}ed successfully`);
                } else {
                    const errorData = await response.json();
                    this.error = errorData.error || `Failed to ${action} invitation`;
                    console.error(`❌ Failed to ${action} invitation:`, errorData);
                }
            } catch (error) {
                console.error(`❌ Error ${action}ing invitation:`, error);
                this.error = `Failed to ${action} invitation`;
            } finally {
                this.processingInvitations.delete(invitationId);
            }
        },
        
        showSuccessMessage(message) {
            // You could implement a toast notification here
            console.log('✅', message);
        },
        
        formatDate(dateStr) {
            return window.formatDate ? window.formatDate(dateStr, "YYYY-MM-DD HH:MM") : dateStr;
        },
        
        close() {
            console.log('🔍 Closing invitations modal');
            this.$emit('close');
        }
    },
    
    mounted() {
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
                            <p>Loading invitations...</p>
                        </div>
                        
                        <div v-else-if="error" class="error-message">
                            <p>{{ error }}</p>
                            <button @click="fetchInvitations" class="button">Retry</button>
                        </div>
                        
                        <div v-else-if="!hasInvitations" class="no-invitations">
                            <p>No pending group invitations</p>
                        </div>
                        
                        <div v-else class="invitations-list">
                            <div v-for="invitation in invitations" :key="invitation.id" class="invitation-item">
                                <div class="invitation-info">
                                    <div class="invitation-header">
                                        <h3>{{ invitation.group_name }}</h3>
                                        <span class="invitation-date">{{ formatDate(invitation.created_at) }}</span>
                                    </div>
                                    <p class="invitation-message">
                                        <strong>{{ invitation.inviter_username }}</strong> invited you to join this group
                                    </p>
                                </div>
                                
                                <div class="invitation-actions">
                                    <button 
                                        @click="handleInvitation(invitation.id, 'accept')"
                                        :disabled="processingInvitations.has(invitation.id)"
                                        class="button accept-btn"
                                    >
                                        <i v-if="processingInvitations.has(invitation.id)" class="fas fa-spinner fa-spin"></i>
                                        <i v-else class="fas fa-check"></i>
                                        Accept
                                    </button>
                                    <button 
                                        @click="handleInvitation(invitation.id, 'decline')"
                                        :disabled="processingInvitations.has(invitation.id)"
                                        class="button decline-btn"
                                    >
                                        <i v-if="processingInvitations.has(invitation.id)" class="fas fa-spinner fa-spin"></i>
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