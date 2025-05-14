// ChatWindow Component
const ChatWindow = {
    template: `
        <div v-if="isVisible" class="chat-window" :style="windowStyle">
            <div class="chat-header">
                <span class="chat-title">Chat with [[user.username]]</span>
                <div class="chat-controls">
                    <span v-if="isTyping" class="typing-indicator">typing...</span>
                    <button @click="minimize" class="minimize-btn">_</button>
                    <button @click="close" class="close-btn">×</button>
                </div>
            </div>
            <div class="chat-messages" ref="messagesContainer">
                <div v-for="(message, index) in messages" 
                     :key="index"
                     :class="['message', message.from === currentUser.id ? 'sent' : 'received']">
                    <div class="message-content">[[message.message]]</div>
                    <div class="message-time">[[formatTime(message.timestamp)]]</div>
                </div>
            </div>
            <div class="chat-input">
                <input type="text" 
                       v-model="newMessage" 
                       @keyup.enter="sendMessage"
                       @input="handleTyping"
                       placeholder="Type a message...">
                <button @click="sendMessage" :disabled="!newMessage.trim()">Send</button>
            </div>
        </div>
    `,
    props: {
        userId: {
            type: String,
            required: true
        },
        position: {
            type: Object,
            default: () => ({ x: 0, y: 0 })
        }
    },
    setup(props) {
        const { state: wsState, sendMessage: wsSendMessage, sendTyping } = Vue.inject('websocket');
        const currentUser = Vue.inject('currentUser');
        const messagesContainer = Vue.ref(null);
        const newMessage = Vue.ref('');
        const isVisible = Vue.ref(true);
        const isTyping = Vue.ref(false);
        let typingTimeout = null;

        // Get user info
        const user = Vue.computed(() => {
            return wsState.onlineUsers.find(u => u.id === props.userId) || {};
        });

        // Get messages for this chat
        const messages = Vue.computed(() => {
            return wsState.chatWindows.get(props.userId) || [];
        });

        // Window style
        const windowStyle = Vue.computed(() => ({
            left: `${props.position.x}px`,
            top: `${props.position.y}px`
        }));

        // Format message time
        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }

        // Send message
        function sendMessage() {
            if (!newMessage.value.trim()) return;
            
            wsSendMessage(props.userId, newMessage.value);
            newMessage.value = '';
            sendTyping(props.userId, false);
            
            // Scroll to bottom
            Vue.nextTick(() => {
                if (messagesContainer.value) {
                    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
                }
            });
        }

        // Handle typing indicator
        function handleTyping() {
            if (!isTyping.value) {
                isTyping.value = true;
                sendTyping(props.userId, true);
            }

            // Clear existing timeout
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }

            // Set new timeout
            typingTimeout = setTimeout(() => {
                isTyping.value = false;
                sendTyping(props.userId, false);
            }, 1000);
        }

        // Minimize chat window
        function minimize() {
            isVisible.value = false;
            // Emit event to show minimized window
            window.dispatchEvent(new CustomEvent('minimize-chat', {
                detail: { userId: props.userId }
            }));
        }

        // Close chat window
        function close() {
            // Emit event to remove chat window
            window.dispatchEvent(new CustomEvent('close-chat', {
                detail: { userId: props.userId }
            }));
        }

        // Watch for new messages to scroll to bottom
        Vue.watch(messages, () => {
            Vue.nextTick(() => {
                if (messagesContainer.value) {
                    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
                }
            });
        });

        return {
            currentUser,
            user,
            messages,
            newMessage,
            isVisible,
            isTyping,
            windowStyle,
            messagesContainer,
            formatTime,
            sendMessage,
            handleTyping,
            minimize,
            close
        };
    }
};

// No mount here, will be registered globally. 