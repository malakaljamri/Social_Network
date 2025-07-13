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
            <div v-if="!canMessage" style="color: red; text-align: center; margin: 10px 0;">
                You can only message users you follow or who follow you
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
        };
    },
    computed: {
        currentUserValue() {
            return this.currentUser;
        }
    },
    methods: {
        async fetchHistory(loadOlder = false) {
            const userId = this.user.ID || this.user.id;
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
                const res = await fetch(url);
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
            const userId = this.user.ID || this.user.id;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.id;
            if (!userId || !currentUserId) {
                console.warn('ChatWindow: user ID or current user ID is missing, cannot fetch follow status');
                this.canMessage = false;
                return;
            }
            // Fetch if current user follows chat user and if chat user follows current user
            let canMessage = false;
            try {
                const res1 = await fetch(`/api/user/profile?id=${userId}`);
                const data1 = await res1.json();
                if (data1.is_following || data1.is_follower) {
                    canMessage = true;
                }
            } catch {}
            try {
                const res2 = await fetch(`/api/user/profile?id=${currentUserId}`);
                const data2 = await res2.json();
                if (data2.is_following || data2.is_follower) {
                    canMessage = true;
                }
            } catch {}
            this.canMessage = canMessage;
        },
        sendMessage() {
            const userId = this.user.ID || this.user.id;
            if (!this.input.trim() || !userId) return;
            if (this.websocket && this.websocket.state.connected) {
                this.websocket.sendMessage(userId, this.input, 'chat');
                this.input = '';
            }
        },
        handleTyping() {
            const userId = this.user.ID || this.user.id;
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
            const lastMsg = this.messages[this.messages.length - 1];
            if (!lastMsg || lastMsg.timestamp != msg.timestamp) {
                this.messages.push(msg);
                this.$nextTick(this.scrollToBottom);
            }
        },
        receiveTyping(isTyping) {
            this.typing = isTyping;
        }
    },
    mounted() {
        this.fetchHistory();
        this.fetchFollowStatus();
        window.addEventListener('chat-message', this._onChatMessage = (e) => {
            const msg = e.detail;
            const userId = this.user.ID || this.user.id;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.id;
            if ((msg.sender_id === userId && msg.Receiver_id === currentUserId) ||
                (msg.sender_id === currentUserId && msg.Receiver_id === userId)) {
                this.receiveMessage(msg);
            }
        });
        window.addEventListener('chat-typing', this._onChatTyping = (e) => {
            const { sender_id, Receiver_id, is_typing } = e.detail;
            const userId = this.user.ID || this.user.id;
            const currentUserId = this.currentUserValue.ID || this.currentUserValue.id;
            if (sender_id === userId && Receiver_id === currentUserId) {
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