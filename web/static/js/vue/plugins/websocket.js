// WebSocket Plugin
const WebSocketPlugin = {
    install(app) {
        // Create a reactive state for WebSocket data
        const wsState = Vue.reactive({
            connected: false,
            onlineUsers: [],
            chatWindows: new Map(),
            typingUsers: new Set()
        });

        // Initialize WebSocket connection
        function initWebSocket() {
            const ws = new WebSocket(`ws://${window.location.host}/ws`);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                wsState.connected = true;
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                wsState.connected = false;
                // Attempt to reconnect after 5 seconds
                setTimeout(initWebSocket, 5000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };

            return ws;
        }

        // Handle incoming WebSocket messages
        function handleWebSocketMessage(data) {
            switch (data.type) {
                case 'online_users':
                    wsState.onlineUsers = data.users;
                    break;
                case 'chat_message':
                    handleChatMessage(data);
                    break;
                case 'typing':
                    handleTypingIndicator(data);
                    break;
                case 'user_status':
                    handleUserStatus(data);
                    break;
            }
        }

        // Handle chat messages
        function handleChatMessage(data) {
            const { from, message, timestamp } = data;
            if (!wsState.chatWindows.has(from)) {
                wsState.chatWindows.set(from, []);
            }
            wsState.chatWindows.get(from).push({
                from,
                message,
                timestamp,
                isRead: false
            });
        }

        // Handle typing indicators
        function handleTypingIndicator(data) {
            const { user, isTyping } = data;
            if (isTyping) {
                wsState.typingUsers.add(user);
            } else {
                wsState.typingUsers.delete(user);
            }
        }

        // Handle user status changes
        function handleUserStatus(data) {
            const { user, status } = data;
            const userIndex = wsState.onlineUsers.findIndex(u => u.id === user);
            if (userIndex !== -1) {
                wsState.onlineUsers[userIndex].online = status === 'online';
            }
        }

        // Send chat message
        function sendChatMessage(to, message) {
            if (!wsState.connected) return;
            const data = {
                type: 'chat_message',
                to,
                message
            };
            ws.send(JSON.stringify(data));
        }

        // Send typing indicator
        function sendTypingIndicator(to, isTyping) {
            if (!wsState.connected) return;
            const data = {
                type: 'typing',
                to,
                isTyping
            };
            ws.send(JSON.stringify(data));
        }

        // Initialize WebSocket connection
        const ws = initWebSocket();

        // Add WebSocket functionality to the app
        app.provide('websocket', {
            state: wsState,
            sendMessage: sendChatMessage,
            sendTyping: sendTypingIndicator
        });
    }
};
// No export statement, define globally 