// ChatWindow Component
const ChatWindow = {
    props: ['user', 'currentUser', 'onClose'], //( props = properties in vue (parent and passes data to child component , expects to receive )
    inject: ['websocket'],  //inject is araay of strings , component except to recive
    template: `
        <div class="modal-content chat-window-fixed layer-fixed" @click.stop style="max-width: 400px;">
            <div class="chat-header-bar" style="width: 100%;">
                Chat with {{ user.Username }}
                <span class="close-span" @click="onClose" style="float:right;cursor:pointer;">X</span>
            </div>
            <div class="chat-messages" ref="messagesContainer" style="width: 100%; height: 300px; overflow-y: auto; background: #f9f9f9; margin-bottom: 12px; border-radius: 8px; padding: 8px;">
                <div v-if="loading" class="loading-indicator">Loading...</div>
                <div v-else>
                    <div v-if="loadingOlder" class="loading-indicator" style="text-align:center;">Loading older messages...</div>
                    <div v-if="messages.length === 0" class="no-messages">Start Chatting!</div>
                    <div v-for="msg in messages" :key="msg.id || msg.timestamp + msg.content" :class="['chat-message-bubble', msg.sender_id === currentUserValue.id ? 'self' : 'other']">
                        <img :src="msg.sender_id === currentUserValue.id ? (currentUserValue.avatar || '/static/images/default-avatar.png') : (user.Avatar || '/static/images/default-avatar.png')" class="chat-avatar" alt="avatar" />
                        <div class="bubble-content">
                            <span class="chat-meta"><b>{{ msg.sender_id === currentUserValue.id ? 'You' : user.Username }}</b> [{{ formatTimestamp(msg.timestamp) }}]</span>
                            <div class="chat-text">{{ msg.content }}</div>
                        </div>
                    </div>
                    <div v-if="typing" class="typing-indicator">{{ user.Username }} is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>
                </div>
            </div>
            <div v-if="!canMessage" style="color: #ff6b6b; text-align: center; margin: 10px 0; padding: 10px; background: #fff5f5; border-radius: 5px; border: 1px solid #ffcccc;">
                <strong>Cannot send messages</strong><br>
                You can only message users you follow or who follow you.<br>
                <small style="color: #888;">Chat history is still accessible even if you unfollowed each other.</small>
            </div>
            <template v-else>
                <input type="text" v-model="input" :placeholder="'Type a message...'" @keydown.enter="sendMessage" @keydown.esc="onClose" @input="handleTyping" ref="inputBox" style="width: 80%; margin-right: 8px;">
                <button @click="sendMessage">Send</button>
            </template>
        </div>
    `,
    data() {
        return {
            messages: [],
            input: '',
            loading: true,
            typing: false,
            typingTimeout: null,
            canMessage: true,
            loadingOlder: false,
            allLoaded: false,
            offset: 0,
            batchSize: 10,
            _fetchingFollowStatus: false, // New property for tracking follow status fetch
        };
    },
    computed: {
        currentUserValue() {
            return this.currentUser;
        }
    },
    methods: {
        async fetchHistory(loadOlder = false) {
            const userId = this.user.ID || this.user.userId;
            if (!userId) {
                console.warn('ChatWindow: user ID is missing, cannot fetch history');
                return;
            }
            if (loadOlder) {
                if (this.loadingOlder || this.allLoaded) return;
                this.loadingOlder = true;
            } else {
                this.loading = true;
                this.offset = 0;
            }
            try {
                let url = `/api/chat-history?user_id=${userId}&offset=${this.offset}`;
                const res = await fetch(url, { credentials: 'include' });
                
                if (!res.ok) {
                    if (res.status === 403) {
                        console.log('ChatWindow: No chat history available - users may not have follow relationship');
                        // Don't show error for 403, just show empty chat
                        this.messages = [];
                        this.canMessage = false;
                    } else {
                        console.error('ChatWindow: Failed to fetch chat history:', res.status, res.statusText);
                        if (!loadOlder) this.messages = [];
                    }
                    return;
                }
                
                const data = await res.json();
                const msgs = Array.isArray(data) ? data : [];
                if (loadOlder) {
                    if (msgs.length === 0) {
                        this.allLoaded = true;
                    } else {
                        const c = this.$refs.messagesContainer;
                        const oldHeight = c ? c.scrollHeight : 0;
                        this.messages = msgs.concat(this.messages);
                        this.offset += msgs.length;
                        this.$nextTick(() => {
                            if (c) c.scrollTop = c.scrollHeight - oldHeight;
                        });
                        if (msgs.length < this.batchSize) this.allLoaded = true;
                    }
                } else {
                    this.messages = msgs;
                    this.offset = msgs.length;
                    if (msgs.length < this.batchSize) this.allLoaded = true;
                }
            } catch (e) {
                console.error('ChatWindow: Error fetching chat history:', e);
                if (!loadOlder) this.messages = [];
            }
            if (loadOlder) {
                this.loadingOlder = false;
            } else {
                this.loading = false;
                this.$nextTick(this.scrollToBottom);
            }
        },
        async fetchFollowStatus() {
            const userId = this.user.ID || this.user.userId;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.userId;
            if (!userId || !currentUserId) {
                console.warn('ChatWindow: user ID or current user ID is missing, cannot fetch follow status');
                this.canMessage = false;
                return;
            }
            
            // Prevent multiple simultaneous requests
            if (this._fetchingFollowStatus) {
                return;
            }
            this._fetchingFollowStatus = true;
            
            try {
                // Use the profile endpoint which already includes follow status
                const res = await fetch(`/api/user/profile?id=${userId}`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    // Can message if current user follows the chat user OR if chat user follows current user
                    this.canMessage = data.is_following || data.is_follower;
                    console.log(`ChatWindow: canMessage set to ${this.canMessage} for users ${currentUserId} and ${userId} (is_following: ${data.is_following}, is_follower: ${data.is_follower})`);
                } else {
                    console.warn('ChatWindow: Failed to fetch profile for follow status check, status:', res.status);
                    // Don't set canMessage to false immediately, try a fallback approach
                    await this.fallbackFollowStatusCheck(userId, currentUserId);
                }
            } catch (e) {
                console.warn('ChatWindow: Error checking follow status:', e);
                // Try fallback approach
                await this.fallbackFollowStatusCheck(userId, currentUserId);
            } finally {
                this._fetchingFollowStatus = false;
            }
        },
        
        async fallbackFollowStatusCheck(userId, currentUserId) {
            try {
                // Try a simpler endpoint or check if we can at least send a message
                const res = await fetch(`/api/user?id=${userId}`, { credentials: 'include' });
                if (res.ok) {
                    // If we can fetch user data, allow messaging (fallback to permissive)
                    this.canMessage = true;
                    console.log('ChatWindow: Using fallback follow status check - allowing messaging');
                } else {
                    this.canMessage = false;
                    console.warn('ChatWindow: Fallback follow status check failed');
                }
            } catch (e) {
                console.warn('ChatWindow: Fallback follow status check error:', e);
                // Default to allowing messaging if all checks fail
                this.canMessage = true;
            }
        },
        sendMessage() {
            const userId = this.user.ID || this.user.userId;
            if (!this.input.trim() || !userId) {
                console.log('ChatWindow: Cannot send message - input empty or userId missing', { input: this.input, userId });
                return;
            }
            
            // Get detailed connection status
            const connectionStatus = this.websocket?.getConnectionStatus ? this.websocket.getConnectionStatus() : null;
            
            console.log('ChatWindow: Attempting to send message', {
                userId,
                input: this.input,
                websocket: !!this.websocket,
                websocketState: this.websocket?.state,
                connected: this.websocket?.state?.connected,
                connectionStatus
            });
            
            if (this.websocket && this.websocket.state.connected) {
                console.log('ChatWindow: Sending message via WebSocket');
                const success = this.websocket.sendChatMessage(userId, this.input, 'chat');
                if (success) {
                    this.input = '';
                    console.log('ChatWindow: Message sent successfully');
                } else {
                    console.error('ChatWindow: Failed to send message via WebSocket');
                    // Show user-friendly error message
                    this.showMessageError('Failed to send message. Please check your connection and try again.');
                }
            } else {
                console.error('ChatWindow: Cannot send message - WebSocket not connected', {
                    websocket: !!this.websocket,
                    state: this.websocket?.state,
                    connectionStatus
                });
                
                // Try to reinitialize WebSocket if not connected
                if (this.websocket && this.websocket.init) {
                    console.log('ChatWindow: Attempting to reinitialize WebSocket connection...');
                    this.websocket.init();
                }
                
                this.showMessageError('Cannot send message - connection not available. Please try again.');
            }
        },
        handleTyping() {
            const userId = this.user.ID || this.user.userId;
            if (this.websocket && this.websocket.state.connected && userId) {
                this.websocket.sendTyping(userId, true);
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.websocket.sendTyping(userId, false);
                }, 1000);
            }
        },
        formatTimestamp(ts) {
            if (!ts) return '';
            return new Date(ts).toLocaleString();
        },
        scrollToBottom() {
            const c = this.$refs.messagesContainer;
            if (c) c.scrollTop = c.scrollHeight;
        },
        isScrolledToBottom() {
            const c = this.$refs.messagesContainer;
            if (!c) return false;
            return Math.abs(c.scrollHeight - c.scrollTop - c.clientHeight) < 5;
        },
        debounce(fn, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), delay);
            };
        },
        async resetUnread() {
            if (!this.isScrolledToBottom()) return;
            // Mark messages as read by re-fetching history (or call a dedicated endpoint if available)
            await fetch(`/api/chat-history?user_id=${this.user.ID}`);
        },
        receiveMessage(msg) {
            console.log('ChatWindow: receiveMessage called with:', msg);
            const lastMsg = this.messages[this.messages.length - 1];
            if (!lastMsg || lastMsg.timestamp != msg.timestamp) {
                console.log('ChatWindow: Adding new message to messages array');
                this.messages.push(msg);
                this.$nextTick(this.scrollToBottom);
            } else {
                console.log('ChatWindow: Message already exists, skipping');
            }
        },
        receiveTyping(isTyping) {
            this.typing = isTyping;
        },
        
        showMessageError(message) {
            // Create a temporary error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'chat-error-message';
            errorDiv.textContent = message;
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff4444;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            
            document.body.appendChild(errorDiv);
            
            // Remove after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    },
    mounted() {
        // Mark component as not ready initially
        if (this.$root && this.$root.setComponentReady) {
            this.$root.setComponentReady('ChatWindow', false);
        }
        
        this.fetchHistory();
        this.fetchFollowStatus();
        
        // Mark component as ready after initial data is loaded
        this.$nextTick(() => {
            setTimeout(() => {
                if (this.$root && this.$root.setComponentReady) {
                    this.$root.setComponentReady('ChatWindow', true);
                }
            }, 1000); // Give time for data to load
        });
        
        window.addEventListener('chat-message', this._onChatMessage = (e) => {
            const msg = e.detail;
            const userId = this.user.ID || this.user.userId;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.userId;
            
            console.log('ChatWindow: Received chat message event:', {
                msg,
                userId,
                currentUserId,
                sender_id: msg.sender_id,
                receiver_id: msg.receiver_id
            });
            
            if ((msg.sender_id === userId && msg.receiver_id === currentUserId) ||
                (msg.sender_id === currentUserId && msg.receiver_id === userId)) {
                console.log('ChatWindow: Message matches this chat window, adding to messages');
                this.receiveMessage(msg);
            } else {
                console.log('ChatWindow: Message does not match this chat window');
            }
        });
        window.addEventListener('chat-typing', this._onChatTyping = (e) => {
            const { sender_id, receiver_id, is_typing } = e.detail;
            const userId = this.user.ID || this.user.userId;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.userId;
            if (sender_id === userId && receiver_id === currentUserId) {
                this.receiveTyping(is_typing);
            }
        });
        this.$nextTick(() => {
            if (this.$refs.inputBox) this.$refs.inputBox.focus();
            const c = this.$refs.messagesContainer;
            if (c) {
                c.addEventListener('scroll', this._onScroll = () => {
                    if (c.scrollTop === 0 && !this.loadingOlder && !this.allLoaded) {
                        this.fetchHistory(true);
                    }
                    this._debouncedResetUnread();
                });
                // Add user activity listeners
                this._debouncedResetUnread = this.debounce(this.resetUnread, 500);
                ['focus', 'keydown', 'mousedown', 'mousemove'].forEach(evt => {
                    c.addEventListener(evt, this._debouncedResetUnread);
                });
            }
        });
    },
    beforeUnmount() {
        window.removeEventListener('chat-message', this._onChatMessage);
        window.removeEventListener('chat-typing', this._onChatTyping);
        clearTimeout(this.typingTimeout);
        const c = this.$refs.messagesContainer;
        if (c && this._onScroll) {
            c.removeEventListener('scroll', this._onScroll);
        }
        if (c && this._debouncedResetUnread) {
            ['focus', 'keydown', 'mousedown', 'mousemove'].forEach(evt => {
                c.removeEventListener(evt, this._debouncedResetUnread);
            });
        }
    }
};

window.ChatWindow = ChatWindow; 