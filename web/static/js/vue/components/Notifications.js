// Notifications Component
const Notifications = {
    props: {
        notifications: {
            type: Array,
            default: () => []
        },
        showActions: {
            type: Boolean,
            default: true
        }
    },
    template: `
        <div class="notifications-container">
            <div v-if="notifications.length === 0" class="no-notifications">
                No notifications
            </div>
            <div v-else class="notifications-list">
                <div v-for="notification in notifications" 
                     :key="notification.id" 
                     class="notification-item"
                     :class="{ 'unread': !notification.is_read }">
                    
                    <div class="notification-content">
                        <div class="notification-header">
                            <img v-if="notification.sender && notification.sender.avatar" 
                                 :src="getAvatarUrl(notification.sender.avatar)" 
                                 :alt="notification.sender.username"
                                 class="notification-avatar">
                            <img v-else 
                                 src="/static/images/default-avatar.png" 
                                 alt="Default avatar"
                                 class="notification-avatar">
                            
                            <div class="notification-info">
                                <span v-if="notification.sender" class="sender-name">
                                    <a href="#" @click.prevent="viewProfile(notification.sender.id)" class="profile-link">
                                        {{ notification.sender.username }}
                                    </a>
                                </span>
                                <span v-else class="sender-name">System</span>
                                
                                <span class="notification-message">
                                    {{ getNotificationMessage(notification) }}
                                </span>
                                
                                <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
                            </div>
                        </div>
                        
                        <!-- Action buttons for actionable notifications -->
                        <div v-if="notification.action_required && showActions" class="notification-actions">
                            <button @click="handleAction(notification.id, 'accept')" 
                                    class="action-btn accept-btn">
                                Accept
                            </button>
                            <button @click="handleAction(notification.id, 'decline')" 
                                    class="action-btn decline-btn">
                                Decline
                            </button>
                        </div>
                        
                        <!-- Hyperlinks for different notification types -->
                        <div v-if="!notification.action_required" class="notification-links">
                            <a v-if="notification.type === 'new_comment' && notification.action_data" 
                               href="#" @click.prevent="viewPost(notification.action_data.post_id)" 
                               class="notification-link">
                                View Post
                            </a>
                            <a v-if="notification.type === 'group_event' && notification.reference_id" 
                               href="#" @click.prevent="viewEvent(notification.reference_id)" 
                               class="notification-link">
                                View Event
                            </a>
                            <a v-if="notification.type === 'group_invitation' && notification.reference_id" 
                               href="#" @click.prevent="viewGroup(notification.reference_id)" 
                               class="notification-link">
                                View Group
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    methods: {
        getNotificationMessage(notification) {
            const senderName = notification.sender ? notification.sender.username : 'Someone';
            
            switch (notification.type) {
                case 'follow_request':
                    return `${senderName} wants to follow you`;
                case 'follow_established':
                    if (notification.message.includes('you are now following')) {
                        return `You are now following ${senderName}`;
                    } else if (notification.message.includes('accepted your follow request')) {
                        return `${senderName} accepted your follow request`;
                    } else if (notification.message.includes('you are now following each other')) {
                        return `You and ${senderName} are now following each other`;
                    } else {
                        return `${senderName} is now following you`;
                    }
                case 'group_invitation':
                    return `${senderName} invited you to join a group`;
                case 'group_membership_confirmed':
                    return `You are now a member of the group`;
                case 'new_comment':
                    return `${senderName} commented on your post`;
                case 'group_event':
                    return `A new event was created in a group you're part of`;
                default:
                    return notification.message || 'New notification';
            }
        },
        
        getAvatarUrl(avatarPath) {
            if (!avatarPath) return '/static/images/default-avatar.png';
            if (avatarPath.startsWith('http')) return avatarPath;
            return `/web/${avatarPath}`;
        },
        
        formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        },
        
        async handleAction(notificationId, action) {
            try {
                console.log('Notifications: Handling action:', notificationId, action);
                
                // Find the notification to get its type
                const notification = this.notifications.find(n => n.id === notificationId);
                if (!notification) {
                    console.error('Notification not found:', notificationId);
                    return;
                }

                let success = false;

                // All actionable notification types now use the unified endpoint
                const response = await fetch('/api/notifications/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ notification_id: notificationId, action })
                });
                success = response.ok;

                if (success) {
                    console.log('Notifications: Action successful');
                    // Emit action handled event to parent (parent will update notifications list)
                    this.$emit('action-handled', { notificationId, action });
                } else {
                    console.error('Notifications: Action failed');
                    // Show error to user
                    alert('Failed to process notification action. Please try again.');
                }
            } catch (error) {
                console.error('Notifications: Error handling action:', error);
                alert('Error processing notification action. Please try again.');
            }
        },
        
        viewProfile(userId) {
            this.$emit('view-profile', userId);
        },
        
        viewPost(postId) {
            this.$emit('view-post', postId);
        },
        
        viewEvent(eventId) {
            this.$emit('view-event', eventId);
        },
        
        viewGroup(groupId) {
            this.$emit('view-group', groupId);
        },
        
        showSuccessMessage(message) {
            // Create a temporary success message
            const successDiv = document.createElement('div');
            successDiv.className = 'notification-success-message';
            successDiv.textContent = message;
            successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            `;
            
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                successDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    document.body.removeChild(successDiv);
                }, 300);
            }, 2000);
        },
        
        showErrorMessage(message) {
            // Create a temporary error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'notification-error-message';
            errorDiv.textContent = message;
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            `;
            
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                errorDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    document.body.removeChild(errorDiv);
                }, 300);
            }, 3000);
        },
        // Helper to fetch latest notifications (parent should provide this as a prop or via emit)
        async fetchLatestNotifications() {
            // This method should be provided by the parent component (NavBar) via prop or event
            // For now, emit an event so the parent can refresh notifications
            this.$emit('refresh-notifications');
        }
    },
    emits: ['action-handled', 'view-profile', 'view-post', 'view-event', 'view-group']
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

window.Notifications = Notifications; 