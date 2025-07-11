// GroupChat Component
const GroupChat = {
    props: ['groupName', 'groupId'],
    inject: ['websocket'],
    template: `
        <div class="chat-window card group-chat" @click.stop style="max-width: 400px;">
            <div class="chat-header">
                {{ groupName }} Chat Room
                <span class="close-span" @click="$emit('close')">X</span>
            </div>
            <div class="chat-messages" ref="messagesContainer" style="height: 300px; overflow-y: auto; background: #f9f9f9; margin-bottom: 12px; border-radius: 8px; padding: 8px;">
                <div v-if="loading" class="loading-indicator">Loading...</div>
                <div v-else-if="messages.length === 0" class="no-messages">No messages yet. Start chatting!</div>
                <div v-for="msg in messages" :key="msg.timestamp + msg.content" :class="['chat-message-bubble', msg.sender_id === currentUserId ? 'self' : 'other']">
                    <img :src="msg.sender_avatar || '/static/images/default-avatar.png'" class="chat-avatar" alt="avatar" />
                    <div class="bubble-content">
                        <span class="chat-meta"><b>{{ msg.sender_id === currentUserId ? 'You' : msg.sender_username || ('User ' + msg.sender_id) }}</b> [{{ formatTimestamp(msg.timestamp) }}]</span>
                        <div class="chat-text">{{ msg.content }}</div>
                    </div>
                </div>
            </div>
            <div class="chat-input-container">
                <input type="text" v-model="input" placeholder="Type a message..." @keydown.enter="sendMessage" ref="inputBox">
                <button @click="sendMessage">Send</button>
            </div>
        </div>
    `,
    data() {
        return {
            messages: [],
            input: '',
            loading: true,
            currentUserId: null
        };
    },
    methods: {
        async fetchHistory() {
            this.loading = true;
            try {
                const res = await fetch(`/api/groups/chat-history?group_id=${this.groupId}`);
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
                this.websocket.sendGroupChatMessage(this.groupId, this.input);
                this.input = '';
            }
        },
        formatTimestamp(ts) {
            if (!ts) return '';
            const date = new Date(ts);
            const day = String(date.getDate()).padStart(2, '0');
            const month = date.toLocaleString('en-US', { month: 'short' });
            const year = String(date.getFullYear()).slice(-2);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}-${month}-${year} ${hours}:${minutes}`;
        },
        scrollToBottom() {
            const c = this.$refs.messagesContainer;
            if (c) c.scrollTop = c.scrollHeight;
        },
        receiveMessage(msg) {
            if (msg.group_id === this.groupId) {
                this.messages.push(msg);
                this.$nextTick(this.scrollToBottom);
            }
        }
    },
    mounted() {
        // Get current user ID from root
        this.currentUserId = this.$root.currentUser?.id;
        this.fetchHistory();
        window.addEventListener('group-chat-message', this._onGroupChatMessage = (e) => {
            const msg = e.detail;
            if (msg.group_id === this.groupId) {
                this.receiveMessage(msg);
            }
        });
        this.$nextTick(() => {
            if (this.$refs.inputBox) this.$refs.inputBox.focus();
        });
    },
    beforeUnmount() {
        window.removeEventListener('group-chat-message', this._onGroupChatMessage);
    }
};
window.G_GroupChat = GroupChat; 