// WebSocket Plugin - Improved Version with Event Standardization and Sequencing
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
            RECONNECT_DELAY: 5000,
            // New: Event sequencing and connection management
            eventQueue: [],
            isProcessingEvents: false,
            connectionState: 'disconnected', // disconnected, connecting, connected, reconnecting
            lastHeartbeat: null,
            heartbeatInterval: null
        });

        let socket;
        let lastErrorTime = 0;

        // Enhanced event bus with priority and sequencing
        const eventBus = {
            listeners: {},
            highPriorityListeners: {}, // For critical events like authentication
            emit(event, data, priority = 'normal') {
                const targetListeners = priority === 'high' ? this.highPriorityListeners : this.listeners;
                if (targetListeners[event]) {
                    targetListeners[event].forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error(`Error in event listener for ${event}:`, error);
                        }
                    });
                }
            },
            on(event, callback, priority = 'normal') {
                const targetListeners = priority === 'high' ? this.highPriorityListeners : this.listeners;
                if (!targetListeners[event]) {
                    targetListeners[event] = [];
                }
                targetListeners[event].push(callback);
            },
            off(event, callback, priority = 'normal') {
                const targetListeners = priority === 'high' ? this.highPriorityListeners : this.listeners;
                if (targetListeners[event]) {
                    targetListeners[event] = targetListeners[event].filter(cb => cb !== callback);
                }
            }
        };

        // Event sequencing system
        const eventSequencer = {
            queue: [],
            processing: false,
            
            addEvent(event, priority = 0) {
                this.queue.push({ event, priority, timestamp: Date.now() });
                this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
                this.processQueue();
            },
            
            async processQueue() {
                if (this.processing || this.queue.length === 0) return;
                
                this.processing = true;
                
                while (this.queue.length > 0) {
                    const { event } = this.queue.shift();
                    
                    try {
                        await this.processEvent(event);
                        // Small delay to prevent overwhelming the system
                        await new Promise(resolve => setTimeout(resolve, 10));
                    } catch (error) {
                        console.error('Error processing event:', error);
                    }
                }
                
                this.processing = false;
            },
            
            async processEvent(event) {
                // Process events based on type
                switch (event.type) {
                    case 'user_status':
                        await this.handleUserStatus(event.data);
                        break;
                    case 'chat':
                        await this.handleChatMessage(event.data);
                        break;
                    case 'group_chat':
                        await this.handleGroupChatMessage(event.data);
                        break;
                    case 'notification_count_update':
                        await this.handleNotificationCountUpdate(event.data);
                        break;
                    case 'new_notification':
                        await this.handleNewNotification(event.data);
                        break;
                    case 'group_created':
                        await this.handleGroupCreated(event.data);
                        break;
                    case 'group_updated':
                        await this.handleGroupUpdated(event.data);
                        break;
                    case 'pong':
                        await this.handlePong(event.data);
                        break;
                    case 'ping':
                        await this.handlePing(event.data);
                        break;
                    default:
                        console.warn('Unknown event type:', event.type);
                }
            },
            
            // Event handlers with proper sequencing
            async handleUserStatus(data) {
                if (!data.user_id) return;
                
                if (data.status === 'offline') {
                    wsState.onlineUsers.delete(data.user_id);
                } else {
                    wsState.onlineUsers.set(data.user_id, {
                        online: true,
                        username: data.username || `User ${data.user_id}`,
                        lastMessageTime: Date.now()
                    });
                }
                
                // Dispatch standardized event
                window.dispatchEvent(new CustomEvent('user-status-change', { 
                    detail: {
                        userId: data.user_id,
                        status: data.status,
                        username: data.username
                    }
                }));
            },
            
            async handleChatMessage(data) {
                console.log("Processing chat message:", data);
                
                const messageData = data.content || data;
                const chatMessage = {
                    sender_id: messageData.sender_id || messageData.user_id,
                    receiver_id: messageData.receiver_id || messageData.Receiver_id,
                    content: messageData.content,
                    timestamp: messageData.timestamp || new Date().toISOString(),
                    username: messageData.username || messageData.sender_username
                };
                
                // Update chat windows state
                if (!wsState.chatWindows.has(chatMessage.sender_id)) {
                    wsState.chatWindows.set(chatMessage.sender_id, []);
                }
                wsState.chatWindows.get(chatMessage.sender_id).push({
                    from: chatMessage.sender_id,
                    message: chatMessage.content,
                    timestamp: chatMessage.timestamp,
                    isRead: false
                });
                
                // Notify about new message
                this.notifyNewMessage(chatMessage);
                
                // Dispatch standardized event
                window.dispatchEvent(new CustomEvent('chat-message', { 
                    detail: chatMessage 
                }));
            },
            
            async handleGroupChatMessage(data) {
                window.dispatchEvent(new CustomEvent('group-chat-message', { detail: data }));
            },
            
            async handleNotificationCountUpdate(data) {
                console.log('Processing notification count update:', data);
                eventBus.emit('notification-count-update', data, 'high');
                
                // Show immediate notification popup
                if (data.count > 0) {
                    const message = data.count === 1 ? 'You have 1 new notification' : `You have ${data.count} new notifications`;
                    if (window.layerManager) {
                        window.layerManager.showInfo(message, 4000);
                    }
                }
                
                // Update NavBar directly if available
                const root = app._instance?.proxy;
                if (root && root.fetchNotificationCount) {
                    root.fetchNotificationCount();
                }
            },
            
            async handleNewNotification(data) {
                console.log('Processing new notification:', data);
                
                const message = data.message || 'New notification';
                const type = data.type || 'info';
                
                // Show appropriate notification based on type
                if (window.layerManager) {
                    switch (type) {
                        case 'follow_request':
                            window.layerManager.showInfo(`🔔 ${data.sender_name} wants to follow you`, 5000);
                            break;
                        case 'follow_established':
                            window.layerManager.showSuccess(`✅ ${data.sender_name} is now following you`, 5000);
                            break;
                        case 'group_invitation':
                            window.layerManager.showInfo(`👥 ${data.sender_name} invited you to join a group`, 5000);
                            break;
                        case 'new_comment':
                            window.layerManager.showInfo(`💬 ${data.sender_name} commented on your post`, 5000);
                            break;
                        default:
                            window.layerManager.showInfo(message, 5000);
                    }
                }
                
                // Emit events for components to refresh
                eventBus.emit('new-notification', data, 'high');
                window.dispatchEvent(new CustomEvent('new-notification', { detail: data }));
            },
            
            async handleGroupCreated(data) {
                const vueApp = app.config.globalProperties.$root;
                if (vueApp && vueApp.groups) {
                    const groupObj = {
                        ID: data.id,
                        Name: data.name,
                        Description: data.description,
                        CreatedAt: data.created_at,
                        Creator: { Username: data.creator?.username }
                    };
                    if (!vueApp.groups.some(g => g.ID === groupObj.ID)) {
                        vueApp.groups.push(groupObj);
                    }
                }
                
                window.dispatchEvent(new CustomEvent('group-created', { detail: data }));
            },
            
            async handleGroupUpdated(data) {
                window.dispatchEvent(new CustomEvent('group-updated', { detail: data }));
            },
            
            async handlePong(data) {
                // Update last heartbeat time
                wsState.lastHeartbeat = Date.now();
                console.log('Pong received, connection healthy');
            },
            
            async handlePing(data) {
                // Respond to ping with pong
                const pongMessage = {
                    type: 'pong',
                    content: {
                        timestamp: Date.now()
                    }
                };
                sendMessage(pongMessage, 'low');
            },
            
            notifyNewMessage(message) {
                const root = app._instance?.proxy;
                if (message.receiver_id === root?.currentUser?.value?.userId && message.username) {
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
                            if (notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }
                            wsState.activeNotifications.delete(message.username);
                        }, 300);
                    }, 5000);
                }
            }
        };

        // Initialize WebSocket connection with improved error handling
        function initWebSocket() {
            const root = app._instance?.proxy;
            console.log('WebSocket Plugin: initWebSocket called, root:', !!root, 'currentUser:', root?.currentUser?.value);
            
            if (!root || !root.currentUser?.value?.isLoggedIn) {
                console.log('WebSocket not initialized: user not logged in');
                return;
            }

            const currentUser = root.currentUser.value;
            console.log('WebSocket Plugin: Current user:', currentUser);
            
            // Check connection state to prevent multiple connections
            if (wsState.connectionState === 'connecting') {
                console.log('WebSocket already connecting, skipping init');
                return;
            }
            
            // If already connected, don't reinitialize unless there's an issue
            if (wsState.connectionState === 'connected' && wsState.connected) {
                console.log('WebSocket already connected, skipping init');
                return;
            }

            // Check reconnection limits
            if (wsState.reconnectAttempts >= wsState.MAX_RECONNECT_ATTEMPTS) {
                console.log('Max reconnection attempts reached, user may have logged out');
                return;
            }

            // Check if user is still logged in
            if (!root.currentUser?.value?.isLoggedIn) {
                console.log('User no longer logged in, skipping WebSocket init');
                return;
            }

            console.log('WebSocket Plugin: Initializing connection...');
            wsState.connectionState = 'connecting';
            
            // Update central state to show connecting
            updateCentralWebSocketState({
                connecting: true,
                error: null,
                connectionAttempts: wsState.reconnectAttempts
            }).catch(err => console.warn('Failed to update central state:', err));
            
            const wsUrl = `ws://${window.location.host}/ws`;
            console.log('WebSocket Plugin: Connecting to:', wsUrl);
            socket = new WebSocket(wsUrl);
            
            // Add connection timeout
            const connectionTimeout = setTimeout(() => {
                if (wsState.connectionState === 'connecting') {
                    console.warn('WebSocket Plugin: Connection timeout, resetting state');
                    wsState.connectionState = 'disconnected';
                    wsState.connected = false;
                    updateCentralWebSocketState({
                        connected: false,
                        connecting: false,
                        error: 'Connection timeout',
                        connectionAttempts: wsState.reconnectAttempts
                    }).catch(err => console.warn('Failed to update central state:', err));
                }
            }, 10000); // 10 second timeout

            socket.onopen = function(event) {
                clearTimeout(connectionTimeout); // Clear the connection timeout
                console.log('WebSocket Plugin: Connection established successfully');
                wsState.connected = true;
                wsState.connectionState = 'connected';
                wsState.reconnectAttempts = 0;
                wsState.lastHeartbeat = Date.now();
                
                // Update central state
                updateCentralWebSocketState({
                    connected: true,
                    connecting: false,
                    error: null,
                    lastConnected: Date.now(),
                    connectionAttempts: wsState.reconnectAttempts
                }).catch(err => console.warn('Failed to update central state:', err));
                
                // Start heartbeat
                startHeartbeat();
                
                // Send user status immediately after connection
                sendUserStatus('online');
                
                // Fetch online users after connection
                fetchOnlineUsers();
                
                // Process any queued events
                eventSequencer.processQueue();
                
                console.log('WebSocket Plugin: Connection setup completed');
            };

            socket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    // Add to event sequencer for proper processing
                    eventSequencer.addEvent({
                        type: data.type,
                        data: data.content || data
                    }, getEventPriority(data.type));
                    
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            socket.onclose = function(event) {
                clearTimeout(connectionTimeout); // Clear the connection timeout
                console.log('WebSocket Plugin: Connection closed - Code:', event.code, 'Reason:', event.reason);
                wsState.connected = false;
                wsState.connectionState = 'disconnected';
                
                // Update central state
                updateCentralWebSocketState({
                    connected: false,
                    connecting: false,
                    error: event.reason || 'Connection closed',
                    connectionAttempts: wsState.reconnectAttempts
                }).catch(err => console.warn('Failed to update central state:', err));
                
                // Stop heartbeat
                stopHeartbeat();
                
                // Only attempt reconnection if user is still logged in and it's not a normal close
                const root = app._instance?.proxy;
                if (event.code !== 1000 && 
                    wsState.reconnectAttempts < wsState.MAX_RECONNECT_ATTEMPTS &&
                    root?.currentUser?.value?.isLoggedIn) {
                    
                    wsState.connectionState = 'reconnecting';
                    wsState.reconnectAttempts++;
                    console.log(`WebSocket Plugin: Attempting to reconnect... (${wsState.reconnectAttempts}/${wsState.MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(initWebSocket, wsState.RECONNECT_DELAY);
                } else if (event.code === 1000) {
                    console.log('WebSocket Plugin: Connection closed normally (logout or user action)');
                } else {
                    console.log('WebSocket Plugin: Reconnection stopped - user may have logged out or max attempts reached');
                }
            };

            socket.onerror = function(error) {
                clearTimeout(connectionTimeout); // Clear the connection timeout
                const root = app._instance?.proxy;
                if (root?.currentUser?.value?.isLoggedIn) {
                    console.error('WebSocket Plugin: Connection error:', error);
                }
                wsState.connected = false;
                wsState.connectionState = 'disconnected';
                
                // Update central state
                updateCentralWebSocketState({
                    connected: false,
                    connecting: false,
                    error: 'WebSocket connection error',
                    connectionAttempts: wsState.reconnectAttempts
                }).catch(err => console.warn('Failed to update central state:', err));
                
                console.log('WebSocket Plugin: Connection error occurred, will attempt reconnection if needed');
            };
        }

        // Event priority system
        function getEventPriority(eventType) {
            const priorities = {
                'user_status': 3,
                'notification_count_update': 4,
                'new_notification': 4,
                'chat': 2,
                'group_chat': 2,
                'typing': 1,
                'group_created': 3,
                'group_updated': 3,
                'ping': 1,
                'pong': 1
            };
            return priorities[eventType] || 0;
        }

        // Heartbeat system for connection health
        function startHeartbeat() {
            if (wsState.heartbeatInterval) {
                clearInterval(wsState.heartbeatInterval);
            }
            
            wsState.heartbeatInterval = setInterval(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    wsState.lastHeartbeat = Date.now();
                    // Send a ping message to keep connection alive
                    socket.send(JSON.stringify({ type: 'ping', content: { timestamp: Date.now() } }));
                }
            }, 30000); // 30 seconds
        }

        function stopHeartbeat() {
            if (wsState.heartbeatInterval) {
                clearInterval(wsState.heartbeatInterval);
                wsState.heartbeatInterval = null;
            }
        }

        // Enhanced message sending with error handling
        function sendMessage(message, priority = 'normal') {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn('WebSocket not connected, queuing message:', message);
                // Queue message for later sending
                wsState.eventQueue.push({ message, priority, timestamp: Date.now() });
                return false;
            }

            try {
                socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                return false;
            }
        }

        // Wait for central state to be ready
        function waitForCentralState(maxAttempts = 10) {
            return new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                    const root = app._instance?.proxy;
                    if (root && root.websocketState && root.websocketState.value) {
                        resolve(true);
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(check, 100);
                    } else {
                        resolve(false);
                    }
                };
                check();
            });
        }

        // Update central.js WebSocket state
        async function updateCentralWebSocketState(newState) {
            const root = app._instance?.proxy;
            if (root && root.websocketState && root.websocketState.value) {
                try {
                    Object.assign(root.websocketState.value, newState);
                    console.log('WebSocket Plugin: Updated central state:', newState);
                } catch (error) {
                    console.warn('WebSocket Plugin: Failed to update central state:', error);
                }
            } else {
                // Try to wait for central state to be ready
                const stateReady = await waitForCentralState();
                if (stateReady) {
                    try {
                        Object.assign(app._instance.proxy.websocketState.value, newState);
                        console.log('WebSocket Plugin: Updated central state (delayed):', newState);
                    } catch (error) {
                        console.warn('WebSocket Plugin: Failed to update central state after waiting:', error);
                    }
                } else {
                    // Don't warn during initial setup - this is expected
                    if (wsState.connectionState !== 'connecting' || !wsState.connected) {
                        console.debug('WebSocket Plugin: Central state not ready yet (this is normal during initialization)');
                    }
                }
            }
        }

        // Standardized message sending functions
        function sendUserStatus(status) {
            const root = app._instance?.proxy;
            if (!root?.currentUser?.value?.isLoggedIn) return;

            const message = {
                type: 'user_status',
                content: {
                    user_id: root.currentUser.value.userId,
                    status: status,
                    username: root.currentUser.value.username
                }
            };
            sendMessage(message, 'high');
        }

        // FIXED: Renamed from sendMessage to sendChatMessage to avoid function name conflict
        function sendChatMessage(to, message, caller) {
            const root = app._instance?.proxy;
            if (!root?.currentUser?.value?.isLoggedIn) {
                console.warn('Cannot send chat message: user not logged in');
                return false;
            }

            if (!wsState.connected) {
                console.warn('Cannot send chat message: WebSocket not connected');
                return false;
            }

            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn('Cannot send chat message: WebSocket socket not ready');
                return false;
            }

            const chatMessage = {
                type: 'chat',
                Receiver_id: to,
                content: {
                    Receiver_id: to,
                    content: message
                }
            };
            
            try {
                const success = sendMessage(chatMessage);
                if (success) {
                    console.log(`Chat message sent successfully to user ${to}`);
                } else {
                    console.error(`Failed to send chat message to user ${to} - message queued`);
                }
                return success;
            } catch (error) {
                console.error(`Error sending chat message to user ${to}:`, error);
                return false;
            }
        }

        function sendTyping(to, isTyping) {
            const root = app._instance?.proxy;
            if (!root?.currentUser?.value?.isLoggedIn) return;

            const message = {
                type: 'typing',
                Receiver_id: to,
                content: {
                    Receiver_id: to,
                    is_typing: isTyping,
                    username: root.currentUser.value.username
                }
            };
            sendMessage(message, 'low');
        }

        function sendGroupMessage(groupId, message) {
            const root = app._instance?.proxy;
            if (!root?.currentUser?.value?.isLoggedIn) return;

            const groupMessage = {
                type: 'group_chat',
                content: {
                    group_id: groupId,
                    content: message
                }
            };
            sendMessage(groupMessage);
        }

        // Enhanced online users fetching
        async function fetchOnlineUsers() {
            try {
                const response = await fetch('/api/online-users', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    data.onlineUsers.forEach(user => {
                        wsState.onlineUsers.set(user.ID, {
                            online: true,
                            username: user.Username,
                            lastMessageTime: user.LastMessageTime
                        });
                    });
                }
            } catch (error) {
                console.error('Error fetching online users:', error);
            }
        }

        // Cleanup function
        function cleanup() {
            stopHeartbeat();
            if (socket) {
                socket.close(1000, 'Plugin cleanup');
            }
            wsState.connected = false;
            wsState.connectionState = 'disconnected';
            wsState.onlineUsers.clear();
            wsState.chatWindows.clear();
            wsState.typingUsers.clear();
            wsState.activeNotifications.clear();
            wsState.eventQueue = [];
            
            // Reset central state
            updateCentralWebSocketState({
                connected: false,
                connecting: false,
                error: null,
                lastConnected: null,
                connectionAttempts: 0
            }).catch(err => console.warn('Failed to update central state:', err));
        }

        // Function to check WebSocket connection status
        function getConnectionStatus() {
            return {
                connected: wsState.connected,
                connectionState: wsState.connectionState,
                socketReadyState: socket ? socket.readyState : null,
                reconnectAttempts: wsState.reconnectAttempts
            };
        }

        // Watch for changes in currentUser.isLoggedIn and initialize websocket
        const setupUserWatcher = () => {
            const root = app._instance?.proxy;
            if (root && root.currentUser) {
                // Watch for changes in currentUser.isLoggedIn
                root.$watch('currentUser.isLoggedIn', (isLoggedIn) => {
                    console.log('WebSocket Plugin: User login status changed:', isLoggedIn);
                    if (isLoggedIn) {
                        // Longer delay to ensure central state is ready
                        setTimeout(() => {
                            console.log('WebSocket Plugin: Initializing WebSocket after login...');
                            initWebSocket();
                        }, 500);
                    } else {
                        console.log('WebSocket Plugin: User logged out, cleaning up...');
                        cleanup();
                    }
                });
                
                // Also check if user is already logged in
                if (root.currentUser.value?.isLoggedIn) {
                    console.log('WebSocket Plugin: User already logged in, initializing...');
                    setTimeout(() => {
                        console.log('WebSocket Plugin: Initializing WebSocket for already logged-in user...');
                        initWebSocket();
                    }, 500);
                }
            } else {
                // Retry after a short delay if root is not ready
                setTimeout(setupUserWatcher, 100);
            }
        };
        
        // Start watching for user changes
        setupUserWatcher();

        // Provide WebSocket functionality to components
        app.provide('websocket', {
            state: wsState,
            eventBus,
            sendMessage,
            sendChatMessage,
            sendTyping,
            sendGroupMessage,
            sendUserStatus,
            getConnectionStatus,
            init: initWebSocket,
            close: cleanup
        });

        // Make WebSocket available globally
        app.config.globalProperties.websocket = {
            state: wsState,
            eventBus,
            sendMessage,
            sendChatMessage,
            sendTyping,
            sendGroupMessage,
            sendUserStatus,
            getConnectionStatus,
            init: initWebSocket,
            close: cleanup
        };
    }
};

// Export for use
window.WebSocketPlugin = WebSocketPlugin;

// Global debug function for checking WebSocket status
window.checkWebSocketStatus = function() {
    const app = document.querySelector('#app')?.__vue_app__;
    if (app && app._instance?.proxy?.websocket) {
        return app._instance.proxy.websocket.getConnectionStatus();
    } else {
        console.log('WebSocket not available');
        return null;
    }
};

// Global function to manually initialize WebSocket
window.initWebSocket = function() {
    const app = document.querySelector('#app')?.__vue_app__;
    if (app && app._instance?.proxy?.websocket?.init) {
        console.log('Manually initializing WebSocket...');
        app._instance.proxy.websocket.init();
    } else {
        console.log('WebSocket not available');
    }
};

// Global function to reset WebSocket state
window.resetWebSocket = function() {
    const app = document.querySelector('#app')?.__vue_app__;
    if (app && app._instance?.proxy?.websocket) {
        console.log('Resetting WebSocket state...');
        // Force reset the connection state
        app._instance.proxy.websocket.state.connectionState = 'disconnected';
        app._instance.proxy.websocket.state.connected = false;
        app._instance.proxy.websocket.state.reconnectAttempts = 0;
        
        // Update central state
        if (app._instance.proxy.websocketState) {
            app._instance.proxy.websocketState.value = {
                connected: false,
                connecting: false,
                error: null,
                lastConnected: null,
                connectionAttempts: 0
            };
        }
        
        console.log('WebSocket state reset, you can now call initWebSocket()');
    } else {
        console.log('WebSocket not available');
    }
}; 