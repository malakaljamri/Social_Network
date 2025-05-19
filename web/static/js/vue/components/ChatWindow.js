// ChatWindow Component
const ChatWindow = {
    props: ['user', 'currentUser', 'onClose'],
    inject: ['websocket'],
    template: `
        <div class="chat-window card">
            <div class="chat-header">
                Chat with {{ user.Username }}
                <span class="close-span" @click="onClose">X</span>
            </div>
            <div class="chat-messages" ref="messagesContainer">
                <div v-if="loading" class="loading-indicator">Loading...</div>
                <div v-else-if="messages.length === 0" class="no-messages">Start Chatting!</div>
                <div v-for="msg in messages" :key="msg.id || msg.timestamp + msg.content" class="chat-message">
                    <span>[{{ formatTimestamp(msg.timestamp) }}]</span><br>
                    <span :class="{'self-message': msg.sender_id === currentUser.id}">
                        {{ msg.sender_id === currentUser.id ? currentUser.username : user.Username }}:
                    </span>
                    {{ msg.content }}
                </div>
                <div v-if="typing" class="typing-indicator">{{ user.Username }} is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>
            </div>
            <input type="text" v-model="input" :placeholder="'Type a message...'" @keydown.enter="sendMessage" @keydown.esc="onClose" @input="handleTyping" ref="inputBox">
            <button @click="sendMessage">Send</button>
        </div>
    `,
    data() {
        return {
            messages: [],
            input: '',
            loading: true,
            typing: false,
            typingTimeout: null,
        };
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
        sendMessage() {
            if (!this.input.trim()) return;
            if (this.websocket && this.websocket.state.connected) {
                this.websocket.sendMessage(this.user.ID, this.input);
                this.input = '';
            }
        },
        handleTyping() {
            if (this.websocket && this.websocket.state.connected) {
                this.websocket.sendTypingStatus(this.user.ID, true);
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.websocket.sendTypingStatus(this.user.ID, false);
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
            this.messages.push(msg);
            this.$nextTick(this.scrollToBottom);
        },
        receiveTyping(isTyping) {
            this.typing = isTyping;
        }
    },
    mounted() {
        this.fetchHistory();
        // Listen for incoming messages and typing events
        window.addEventListener('chat-message', this._onChatMessage = (e) => {
            const msg = e.detail;
            if ((msg.sender_id === this.user.ID && msg.Receiver_id === this.currentUser.id) ||
                (msg.sender_id === this.currentUser.id && msg.Receiver_id === this.user.ID)) {
                this.receiveMessage(msg);
            }
        });
        window.addEventListener('chat-typing', this._onChatTyping = (e) => {
            const { sender_id, Receiver_id, is_typing } = e.detail;
            if (sender_id === this.user.ID && Receiver_id === this.currentUser.id) {
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