// ChatWindow Component
const ChatWindow = {
    props: ['user', 'currentUser', 'onClose'], //( props = properties in vue (parent and passes data to child component , expects to receive )
    inject: ['websocket'],  //inject is araay of strings , component except to recive
    template: `
        <div class="modal-content chat-window-fixed" @click.stop style="max-width: 400px;">
            <div class="chat-header-bar" style="width: 100%;">
                Chat with {{ user.Username }}
                <span class="close-span" @click="onClose" style="float:right;cursor:pointer;">X</span>
            </div>
            <div class="chat-messages" ref="messagesContainer" style="width: 100%; height: 300px; overflow-y: auto; background: #f9f9f9; margin-bottom: 12px; border-radius: 8px; padding: 8px;">
                <div v-if="loading" class="loading-indicator">Loading...</div>
                <div v-else-if="messages.length === 0" class="no-messages">Start Chatting!</div>
                <div v-for="msg in messages" :key="msg.id || msg.timestamp + msg.content" :class="['chat-message-bubble', msg.sender_id === currentUserValue.id ? 'self' : 'other']">
                    <img :src="msg.sender_id === currentUserValue.id ? (currentUserValue.avatar || '/static/images/default-avatar.png') : (user.Avatar || '/static/images/default-avatar.png')" class="chat-avatar" alt="avatar" />
                    <div class="bubble-content">
                        <span class="chat-meta"><b>{{ msg.sender_id === currentUserValue.id ? 'You' : user.Username }}</b> [{{ formatTimestamp(msg.timestamp) }}]</span>
                        <div class="chat-text">{{ msg.content }}</div>
                    </div>
                </div>
                <div v-if="typing" class="typing-indicator">{{ user.Username }} is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>
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
        };
    },
    computed: {
        currentUserValue() {
            return this.currentUser;
        }
    },
    methods: {
        async fetchHistory() {
            this.loading = true;
            try {
                const res = await fetch(`/api/chat-history?user_id=${this.user.ID}`);
                const data = await res.json();
                this.messages = Array.isArray(data) ? data : [];
            } catch (e) {
                this.messages = [];
            }
            this.loading = false;
            this.$nextTick(this.scrollToBottom);
        },
        async fetchFollowStatus() {
            // Fetch if current user follows chat user and if chat user follows current user
            let canMessage = false;
            try {
                const res1 = await fetch(`/api/user/profile?id=${this.user.ID}`);
                const data1 = await res1.json();
                // is_following: does current user follow chat user?
                // is_follower: does chat user follow current user?
                if (data1.is_following || data1.is_follower) {
                    canMessage = true;
                }
            } catch {}
            try {
                const res2 = await fetch(`/api/user/profile?id=${this.currentUserValue.id}`);
                const data2 = await res2.json();
                // is_follower: does current user follow chat user? (from chat user's perspective)
                // is_following: does chat user follow current user? (from chat user's perspective)
                if (data2.is_following || data2.is_follower) {
                    canMessage = true;
                }
            } catch {}
            this.canMessage = canMessage;
        },
        sendMessage() {
            if (!this.input.trim()) return;
            if (this.websocket && this.websocket.state.connected) {
                this.websocket.sendMessage(this.user.ID, this.input, 'chat');
                this.input = '';
            }
        },
        handleTyping() {
            if (this.websocket && this.websocket.state.connected) {
                this.websocket.sendTyping(this.user.ID, true);
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.websocket.sendTyping(this.user.ID, false);
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
        receiveMessage(msg) {
            const lastMsg = this.messages[this.messages.length - 1];
            // const now = Date.now();
            // if (!lastMsg || (now - new Date(lastMsg.timestamp).getTime() > 1000)) {
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
        // Listen for incoming messages and typing events
        window.addEventListener('chat-message', this._onChatMessage = (e) => {
            const msg = e.detail;
            if ((msg.sender_id === this.user.ID && msg.Receiver_id === this.currentUserValue.id) ||
                (msg.sender_id === this.currentUserValue.id && msg.Receiver_id === this.user.ID)) {
                this.receiveMessage(msg);
            }
        });
        window.addEventListener('chat-typing', this._onChatTyping = (e) => {
            const { sender_id, Receiver_id, is_typing } = e.detail;
            if (sender_id === this.user.ID && Receiver_id === this.currentUserValue.id) {
                this.receiveTyping(is_typing);
            }
        });
        this.$nextTick(() => {
            if (this.$refs.inputBox) this.$refs.inputBox.focus();
        });
    },
    beforeUnmount() {
        window.removeEventListener('chat-message', this._onChatMessage);
        window.removeEventListener('chat-typing', this._onChatTyping);
        clearTimeout(this.typingTimeout);
    }
};

window.ChatWindow = ChatWindow; 