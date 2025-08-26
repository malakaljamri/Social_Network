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

            try {
                if (socket?.readyState === WebSocket.OPEN) {
                    socket.close();
                }

                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsHost = window.location.host;
                socket = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
                
                socket.onopen = async function() {
                    console.log('WebSocket connected');
                    wsState.connected = true;
                    wsState.reconnectAttempts = 0;
                    
                    try {
                        if (currentUser?.isLoggedIn) {
                            sendUserStatus('online');
                        }
                        // console.time("fetchOnlineUsers");
                        await fetchOnlineUsers();
                        // console.timeEnd("fetchOnlineUsers");
                    } catch (error) {
                        console.error('Error in WebSocket onopen:', error);
                    }
                };

                socket.onclose = function(event) {
                    console.log(`Connection closed: ${event.code} ${event.reason}`);
                    wsState.connected = false;
                    
                    // Only attempt reconnection if user is still logged in and it's not a normal closure
                    if (currentUser?.isLoggedIn && event.code !== 1000) {
                        wsState.reconnectAttempts++;
                        setTimeout(initWebSocket, wsState.RECONNECT_DELAY);
                    }
                };

                socket.onerror = function(error) {
                    const now = Date.now();
                    if (now - lastErrorTime > 30000) {
                        console.warn('WebSocket error:', error);
                        lastErrorTime = now;
                    }
                };

                socket.onmessage = function(event) {
                    try {
                        const message = JSON.parse(event.data);
                        handleWebSocketMessage(message);
                    } catch (error) {
                        console.error('Error handling WebSocket message:', error);
                    }
                };

                return socket;
            } catch (error) {
                console.error('Error initializing WebSocket:', error);
                return null;
            }
        }

        // Handle incoming WebSocket messages
        function handleWebSocketMessage(message) {
            console.log('🔔 WebSocket: Received message type:', message.type, message);
            
            switch(message.type) {
                case 'user_status':
                    console.log('🔔 WebSocket: Received user_status message:', message);
                    handleUserStatus(message.content);
                    break;
                case 'chat':
                    handleChatMessage(message.content);
                    break;
                case 'group_chat':
                    handleGroupChatMessage(message.content);
                    break;
                case 'private_message_notification':
                    handlePrivateMessageNotification(message.content);
                    break;
                case 'typing_status':
                    handleTypingIndicator(message.content);
                    break;
                case 'new_group':
                    handleNewGroup(message.content);
                    break;
                // New real-time post and comment handlers
                case 'new_post':
                    console.log('🔔 WebSocket: New post received:', message.content);
                    window.dispatchEvent(new CustomEvent('new-post', { detail: message.content }));
                    break;
                case 'post_updated':
                    console.log('🔔 WebSocket: Post updated:', message.content);
                    window.dispatchEvent(new CustomEvent('post-updated', { detail: message.content }));
                    break;
                case 'post_deleted':
                    console.log('🔔 WebSocket: Post deleted:', message.content);
                    window.dispatchEvent(new CustomEvent('post-deleted', { detail: message.content }));
                    break;
                case 'new_comment':
                    console.log('🔔 WebSocket: New comment received:', message.content);
                    window.dispatchEvent(new CustomEvent('new-comment', { detail: message.content }));
                    break;
                case 'comment_updated':
                    console.log('🔔 WebSocket: Comment updated:', message.content);
                    window.dispatchEvent(new CustomEvent('comment-updated', { detail: message.content }));
                    break;
                case 'comment_deleted':
                    console.log('🔔 WebSocket: Comment deleted:', message.content);
                    window.dispatchEvent(new CustomEvent('comment-deleted', { detail: message.content }));
                    break;
                case 'unread-count-update':
                    window.dispatchEvent(new CustomEvent('unread-count-update', { detail: message.content }));
                    break;
                case 'unread-group-count-update':
                    window.dispatchEvent(new CustomEvent('unread-group-count-update', { detail: message.content }));
                    break;
                case 'error':
                    console.error("Server error:", message.content);
                    // Show user-friendly error message
                    if (typeof message.content === 'string') {
                        showToastNotification({
                            type: 'error',
                            message: message.content,
                            duration: 5000
                        });
                    }
                    break;
                case 'notification':
                case 'new_notification':
                    console.log('WebSocket: Received notification event:', message);
                    window.dispatchEvent(new CustomEvent('notification-update', { detail: message.content }));
                    
                    // Dispatch specific events for follow-related notifications
                    if (message.content && message.content.type) {
                        console.log('WebSocket: Processing notification type:', message.content.type);
                        switch (message.content.type) {
                            case 'follow_accepted':
                                console.log('WebSocket: Dispatching follow-accepted event with content:', message.content);
                                window.dispatchEvent(new CustomEvent('follow-accepted', { detail: message.content }));
                                break;
                            case 'follow_declined':
                                console.log('WebSocket: Dispatching follow-declined event with content:', message.content);
                                window.dispatchEvent(new CustomEvent('follow-declined', { detail: message.content }));
                                break;
                            case 'follow_request':
                                console.log('WebSocket: Dispatching follow-request event with content:', message.content);
                                window.dispatchEvent(new CustomEvent('follow-request', { detail: message.content }));
                                break;
                            case 'new_follower':
                                console.log('WebSocket: Dispatching new-follower event with content:', message.content);
                                window.dispatchEvent(new CustomEvent('new-follower', { detail: message.content }));
                                break;
                        }
                    }
                    break;
                case 'group_join_request_notification':
                    console.log('WebSocket: Received group join request notification:', message);
                    // Dispatch event for group join request notifications
                    window.dispatchEvent(new CustomEvent('group-join-request-notification', { detail: message.content }));
                    // Also dispatch general notification update for consistency
                    window.dispatchEvent(new CustomEvent('notification-update', { detail: message.content }));
                    break;
                case 'group_access_update':
                    console.log('WebSocket: Received group access update:', message);
                    // Dispatch event for group access updates
                    window.dispatchEvent(new CustomEvent('group-access-update', { detail: message.content }));
                    break;
                default:
                    console.warn('Unknown message type:', message);
            }
        }

        // Handle user status changes
        function handleUserStatus(data) {
            console.log('🔔 WebSocket: Handling user status change:', data);
            if (!data.user_id) {
                console.warn('WebSocket: User status message missing user_id:', data);
                return;
            }
            
            if (data.status === 'offline') {
                wsState.onlineUsers.delete(data.user_id);
                console.log(`🔔 WebSocket: User ${data.user_id} went offline`);
            } else {
                wsState.onlineUsers.set(data.user_id, {
                    online: true,
                    username: data.username || `User ${data.user_id}`,
                    LastMessageTime: Date.now()
                });
                console.log(`🔔 WebSocket: User ${data.user_id} came online`);
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
            console.log('WebSocket: Handling group chat message:', data);
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
            console.log("New group created:", data);
            const root = app._instance?.proxy;
            if (!root) return;

            // Add the new group to the list
            if (root.chat && root.chat.groups) {
                root.chat.groups.unshift(data); // Add to the top of the list
            }

            // Show a toast notification
            const notificationText = `New group created: "${data.title}"`;
            showToastNotification(notificationText);
        }

        function handlePrivateMessageNotification(data) {
            const notificationText = `New message from: ${data.sender_name}`;
            showToastNotification(notificationText);
        }

        function showToastNotification(message) {
            const toast = document.createElement('div');
            toast.className = 'toast-notification';

            const messageText = document.createElement('span');
            messageText.textContent = message;

            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';

            toast.appendChild(messageText);
            toast.appendChild(progressBar);

            document.body.appendChild(toast);

            // Animate in
            setTimeout(() => {
                toast.classList.add('show');
            }, 100);

            // Animate out and remove after 8 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        document.body.removeChild(toast);
                    }
                }, 500); // Corresponds to the transition duration
            }, 8000); // 8 seconds
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
            if (!wsState.connected) {
                console.error('WebSocket: Cannot send group chat message - not connected');
                return;
            }
            const data = {
                type: 'group_chat',
                content: { group_id: groupId, content: message }
            };
            console.log('WebSocket: Sending group chat message:', data);
            socket.send(JSON.stringify(data));
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
            close: () => socket?.close(), // Expose a close function
        });
    }
};
// No export statement, define globally 