// WebSocket Plugin
const WebSocketPlugin = {
    install(app) {
        // Create a reactive state for WebSocket data
        const wsState = Vue.reactive({
            connected: false,
            onlineUsers: new Map(),
            chatWindows: new Map(),
            typingUsers: new Set(),
            activeNotifications: new Map(),
            reconnectAttempts: 0,
            MAX_RECONNECT_ATTEMPTS: 5,
            RECONNECT_DELAY: 5000
        });

        let socket;
        let lastErrorTime = 0;

        // Global event bus for cross-component communication
        const eventBus = {
            listeners: {},
            emit(event, data) {
                if (this.listeners[event]) {
                    this.listeners[event].forEach(callback => callback(data));
                }
            },
            on(event, callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event].push(callback);
            },
            off(event, callback) {
                if (this.listeners[event]) {
                    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
                }
            }
        };

        // Initialize WebSocket connection
        function initWebSocket() {
            const root = app._instance?.proxy;
            if (!root || !root.currentUser?.value?.isLoggedIn) {
                console.log('WebSocket not initialized: user not logged in or not loaded');
                return;
            }

            const currentUser = root.currentUser.value;
            if (wsState.reconnectAttempts >= wsState.MAX_RECONNECT_ATTEMPTS) {
                console.error('Max reconnection attempts reached');
                return;
            }

            // Prevent multiple socket creation
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                console.log('WebSocket already open or connecting, skipping init');
                return;
            }

            console.log('Initializing WebSocket connection...');
            const wsUrl = `ws://${window.location.host}/ws`;
            socket = new WebSocket(wsUrl);

            socket.onopen = function(event) {
                console.log('WebSocket connected');
                wsState.connected = true;
                wsState.reconnectAttempts = 0;
                
                // Send user status immediately after connection
                sendUserStatus('online');
                
                // Fetch online users after connection
                fetchOnlineUsers();
            };

            socket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    switch (data.type) {
                        case 'chat':
                            handleChatMessage(data);
                            break;
                        case 'typing':
                            handleTypingIndicator(data);
                            break;
                        case 'user_status':
                            handleUserStatusUpdate(data);
                            break;
                        case 'notification_count_update':
                            handleNotificationCountUpdate(data);
                            break;
                        case 'new_notification':
                            handleNewNotification(data);
                            break;
                        case 'notification_update':
                            handleNotificationUpdate(data);
                            break;
                        case 'group_created':
                            handleGroupCreated(data);
                            break;
                        case 'group_updated':
                            handleGroupUpdated(data);
                            break;
                        case 'group_chat':
                            handleGroupChatMessage(data);
                            break;
                        default:
                            console.log('Unknown message type:', data.type);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            socket.onclose = function(event) {
                console.log('WebSocket connection closed:', event.code, event.reason);
                wsState.connected = false;
                
                if (event.code !== 1000 && wsState.reconnectAttempts < wsState.MAX_RECONNECT_ATTEMPTS) {
                    wsState.reconnectAttempts++;
                    console.log(`Attempting to reconnect... (${wsState.reconnectAttempts}/${wsState.MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(initWebSocket, wsState.RECONNECT_DELAY);
                }
            };

            socket.onerror = function(error) {
                console.error('WebSocket error:', error);
                wsState.connected = false;
            };
        }

        // Handle incoming WebSocket messages
        function handleWebSocketMessage(message) {
            console.log("Handling message:", message);
            switch(message.type) {
                case 'user_status':
                    handleUserStatus(message.content);
                    break;
                case 'chat':
                    handleChatMessage(message.content);
                    break;
                case 'group_chat':
                    handleGroupChatMessage(message.content);
                    break;
                case 'typing_status':
                    handleTypingIndicator(message.content);
                    break;
                case 'new_group':
                    handleNewGroup(message.content);
                    break;
                case 'unread-count-update':
                    window.dispatchEvent(new CustomEvent('unread-count-update', { detail: message.content }));
                    break;
                case 'unread-group-count-update':
                    window.dispatchEvent(new CustomEvent('unread-group-count-update', { detail: message.content }));
                    break;
                case 'error':
                    console.error("Server error:", message.content);
                    break;
                case 'group_created':
                    handleGroupCreated(message.content);
                    break;
                case 'group_member_added':
                case 'group_member_removed':
                    handleGroupMembershipChange(message.content);
                    break;
                case 'group_message':
                    handleGroupMessage(message.content);
                    break;
                case 'notification_count_update':
                    handleNotificationCountUpdate(message.content);
                    break;
                default:
                    console.warn('Unknown message type:', message);
            }
        }

        // Handle user status changes
        function handleUserStatus(data) {
            if (!data.user_id) return;
            
            if (data.status === 'offline') {
                wsState.onlineUsers.delete(data.user_id);
            } else {
                wsState.onlineUsers.set(data.user_id, {
                    online: true,
                    username: data.username || `User ${data.user_id}`,
                    LastMessageTime: Date.now()
                });
            }
            
            // Dispatch event for user status change
            window.dispatchEvent(new CustomEvent('user-status-change', { 
                detail: {
                    userId: data.user_id,
                    status: data.status,
                    username: data.username
                }
            }));
        }

        // Handle chat messages
        function handleChatMessage(data, message) {
            console.log("Handling chat message:", message);
            if (data.Receiver_id === 0) { // Public chat message
                window.dispatchEvent(new CustomEvent('public-chat-message', { 
                    detail: {
                        sender: data.sender_username || `User ${data.sender_id}`,
                        content: data.content,
                        timestamp: data.timestamp
                    }
                }));
            } else { // Private chat message
                if (!wsState.chatWindows.has(data.sender_id)) {
                    wsState.chatWindows.set(data.sender_id, []);
                }
                wsState.chatWindows.get(data.sender_id).push({
                    from: data.sender_id,
                    message: data.content,
                    timestamp: data.timestamp,
                    isRead: false
                });
                
                // Notify about new message
                notifyNewMessage(data);
                
                // Dispatch event for Vue components
                window.dispatchEvent(new CustomEvent('chat-message', { 
                    detail: data 
                }));
            }
        }

        // Handle group chat messages
        function handleGroupChatMessage(data) {
            window.dispatchEvent(new CustomEvent('group-chat-message', { detail: data }));
        }

        // Handle typing indicators
        function handleTypingIndicator(data) {
            if (data.isTyping) {
                wsState.typingUsers.add(data.user_id);
            } else {
                wsState.typingUsers.delete(data.user_id);
            }
            
            window.dispatchEvent(new CustomEvent('chat-typing', { 
                detail: data 
            }));
        }

        // Handle new group notifications
        function handleNewGroup(data) {
            const vueApp = app.config.globalProperties.$root;
            if (vueApp && vueApp.groups) {
                const groupObj = {
                    ID: data.id,
                    Name: data.name,
                    Description: data.description,
                    CreatedAt: data.created_at,
                    Creator: { Username: data.creator.username }
                };
                if (!vueApp.groups.some(g => g.ID === groupObj.ID)) {
                    vueApp.groups.push(groupObj);
                }
            }
        }

        // Handle notification count updates
        function handleNotificationCountUpdate(data) {
            console.log('Notification count update received:', data);
            eventBus.emit('notification-count-update', data);
            
            // Show immediate notification popup
            if (data.count > 0) {
                const message = data.count === 1 ? 'You have 1 new notification' : `You have ${data.count} new notifications`;
                layerManager.showInfo(message, 4000);
            }
            
            // Also try to update NavBar directly if available
            const root = app._instance?.proxy;
            if (root && root.fetchNotificationCount) {
                root.fetchNotificationCount();
            }
        }

        // Handle new individual notifications
        function handleNewNotification(data) {
            console.log('New notification received:', data);
            
            // Show immediate notification popup with specific message
            const message = data.message || 'New notification';
            const type = data.type || 'info';
            
            switch (type) {
                case 'follow_request':
                    layerManager.showInfo(`🔔 ${data.sender_name} wants to follow you`, 5000);
                    break;
                case 'follow_established':
                    layerManager.showSuccess(`✅ ${data.sender_name} is now following you`, 5000);
                    break;
                case 'group_invitation':
                    layerManager.showInfo(`👥 ${data.sender_name} invited you to join a group`, 5000);
                    break;
                case 'new_comment':
                    layerManager.showInfo(`💬 ${data.sender_name} commented on your post`, 5000);
                    break;
                default:
                    layerManager.showInfo(message, 5000);
            }
            
            // Emit event for components to refresh
            eventBus.emit('new-notification', data);
            window.dispatchEvent(new CustomEvent('new-notification', { detail: data }));
        }

        // Handle notification updates (when actions are completed)
        function handleNotificationUpdate(data) {
            console.log('Notification update received:', data);
            
            // Show success message for completed actions
            const message = data.message || 'Action completed';
            const type = data.type || 'info';
            
            switch (type) {
                case 'follow_established':
                    layerManager.showSuccess(`✅ ${message}`, 5000);
                    break;
                case 'group_membership_confirmed':
                    layerManager.showSuccess(`✅ ${message}`, 5000);
                    break;
                default:
                    layerManager.showSuccess(`✅ ${message}`, 5000);
            }
            
            // Emit event for components to refresh
            eventBus.emit('notification-update', data);
            window.dispatchEvent(new CustomEvent('notification-update', { detail: data }));
        }

        // Notification system
        function notifyNewMessage(message) {
            if (message.Receiver_id === app.config.globalProperties.$root?.currentUser?.value?.id && message.username) {
                if (wsState.activeNotifications.has(message.username)) {
                    return;
                }

                const notification = document.createElement('div');
                notification.className = 'floating-notification';
                notification.innerHTML = `
                    <div class="notification-content">
                        <div class="notification-title">${message.username}</div>
                        <div class="notification-body">
                            ${message.content}
                        </div>
                    </div>
                `;
                
                document.body.appendChild(notification);
                wsState.activeNotifications.set(message.username, notification);
                
                setTimeout(() => notification.classList.add('show'), 100);
                
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => {
                        notification.remove();
                        wsState.activeNotifications.delete(message.username);
                    }, 300);
                }, 3000);
            }
        }

        // Fetch online users
        async function fetchOnlineUsers() {
            try {
                const response = await fetch('/api/online-users', { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch online users');
                const data = await response.json();
                const users = data.onlineUsers || [];
                wsState.onlineUsers.clear();
                users.forEach(user => {
                    wsState.onlineUsers.set(user.id, {
                        online: true,
                        username: user.username,
                        LastMessageTime: Date.now()
                    });
                });
            } catch (error) {
                console.error('Error fetching online users:', error);
            }
        }

        // Send user status
        function sendUserStatus(status) {
            if (socket?.readyState === WebSocket.OPEN) {
                const currentUser = app.config.globalProperties.$root?.currentUser?.value;
                if (currentUser?.isLoggedIn) {
                    const message = {
                        type: 'user_status',
                        content: {
                            user_id: currentUser.id,
                            status: status,
                            username: currentUser.username
                        }
                    };
                    socket.send(JSON.stringify(message));
                }
            }
        }

        // Send chat message
        function sendChatMessage(to, message, caller) {
            console.log("Sending chat message:", to, message, caller);
            if (!wsState.connected) return;
            const data = {
                type: 'chat',
                content: message,
                Receiver_id: to,
                caller: caller
            };
            socket.send(JSON.stringify(data));
            console.log("sent chat message:", to, message, caller);
        }

        // Send typing indicator
        function sendTypingIndicator(to, isTyping) {
            if (!wsState.connected) return;
            const data = {
                type: 'typing_status',
                content: {
                    Receiver_id: to,
                    isTyping: isTyping
                }
            };
            socket.send(JSON.stringify(data));
        }

        // Send group chat message
        function sendGroupChatMessage(groupId, message) {
            if (!wsState.connected) return;
            const data = {
                type: 'group_chat',
                content: { group_id: groupId, content: message }
            };
            socket.send(JSON.stringify(data));
        }

        // Handle group creation (batched to avoid spam)
        function handleGroupCreated(data) {
            console.log('New group created:', data.content);
            // Dispatch event to refresh groups list
            window.dispatchEvent(new CustomEvent('group-created', { detail: data.content }));
            eventBus.emit('group-created', data.content);
        }

        // Handle group membership changes
        function handleGroupMembershipChange(data) {
            console.log('Group membership changed:', data.content);
            // Dispatch event to update group access for affected users
            window.dispatchEvent(new CustomEvent('group-membership-changed', { detail: data.content }));
            eventBus.emit('group-membership-changed', data.content);
        }

        // Handle group messages
        function handleGroupMessage(data) {
            console.log('Group message received:', data.content);
            // Dispatch event to update group chat
            window.dispatchEvent(new CustomEvent('group-message', { detail: data.content }));
        }

        // Handle group updates
        function handleGroupUpdated(data) {
            console.log('Group updated event received:', data);
            eventBus.emit('group-updated', data);
            window.dispatchEvent(new CustomEvent('group-updated', { detail: data.content }));
        }

        // Initialize WebSocket connection
        // const ws = initWebSocket(); // Remove this initial call

        // Watch for changes in currentUser.isLoggedIn and initialize websocket
        /*
        app.config.globalProperties.$root.$watch('currentUser.isLoggedIn', (isLoggedIn) => {
            console.log('User login state changed:', isLoggedIn);
            if (isLoggedIn) {
                initWebSocket();
            } else if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
                 // Close socket if user logs out
                 socket.close();
            }
        });
        */ // Remove the watcher

        // Add WebSocket functionality to the app
        app.provide('websocket', {
            state: wsState,
            sendMessage: sendChatMessage,
            sendTyping: sendTypingIndicator,
            sendUserStatus: sendUserStatus,
            sendGroupChatMessage: sendGroupChatMessage,
            init: initWebSocket, // Expose initWebSocket
            close: () => {
                if (socket) {
                    console.log('Closing WebSocket connection...');
                    socket.close();
                    socket = null;
                    wsState.connected = false;
                } else {
                    console.log('No WebSocket connection to close');
                }
            },
            eventBus: eventBus
        });
    }
};
// No export statement, define globally 