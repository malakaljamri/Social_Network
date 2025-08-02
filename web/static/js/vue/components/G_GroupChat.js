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
                <button @click.stop="toggleEmojiPicker" class="emoji-button">
                    <i class="fa-regular fa-face-smile"></i>
                </button>
                <button @click="sendMessage">Send</button>
            </div>
        </div>
    `,
    data() {
        return {
            messages: [],
            input: '',
            loading: true,
            currentUserId: null,
            showEmojiPicker: false,
        };
    },
    watch: {
        showEmojiPicker(isShown) {
            if (isShown) {
                this.$nextTick(() => {
                    const picker = this.$refs.emojiPickerContainer?.querySelector('emoji-picker');
                    if (picker) {
                        picker.addEventListener('emoji-click', this.onEmojiSelect);
                    }
                });
            } else {
                const picker = this.$refs.emojiPickerContainer?.querySelector('emoji-picker');
                if (picker) {
                    picker.removeEventListener('emoji-click', this.onEmojiSelect);
                }
            }
        }
    },
    methods: {
        toggleEmojiPicker() {
            this.showEmojiPicker = !this.showEmojiPicker;
        },
        onEmojiSelect(event) {
            this.input += event.detail.unicode;
            this.$refs.inputBox.focus();
        },
        closeEmojiPickerOnClickOutside(event) {
            if (this.$refs.emojiPickerContainer && !this.$refs.emojiPickerContainer.contains(event.target) && !event.target.closest('.emoji-button')) {
                this.showEmojiPicker = false;
            }
        },
        async fetchHistory() {
            this.loading = true;
            try {
                const res = await fetch(`/api/groups/chat-history?group_id=${this.groupId}`);
                const data = await res.json();
                this.messages = Array.isArray(data) ? data : [];
                console.log('GroupChat: Fetched history for group', this.groupId, 'messages:', this.messages.length);
            } catch (e) {
                console.error('GroupChat: Error fetching history:', e);
                this.messages = [];
            }
            this.loading = false;
            this.$nextTick(this.scrollToBottom);
        },
        sendMessage() {
            if (!this.input.trim()) return;
            if (this.websocket && this.websocket.state.connected) {
                console.log('GroupChat: Sending message to group', this.groupId, ':', this.input);
                this.websocket.sendGroupChatMessage(this.groupId, this.input);
                this.input = '';
            } else {
                console.error('GroupChat: WebSocket not connected');
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
            // Mark group messages as read by re-fetching history (or call a dedicated endpoint if available)
            await fetch(`/api/groups/chat-history?group_id=${this.groupId}`);
        },
        receiveMessage(msg) {
            console.log('GroupChat: Received message for group', this.groupId, ':', msg);
            if (msg.group_id === this.groupId) {
                // Check if message already exists to avoid duplicates
                const existingMessage = this.messages.find(m => 
                    m.sender_id === msg.sender_id && 
                    m.content === msg.content && 
                    m.timestamp === msg.timestamp
                );
                
                if (!existingMessage) {
                    this.messages.push(msg);
                    console.log('GroupChat: Added new message to group', this.groupId, 'total messages:', this.messages.length);
                    this.$nextTick(this.scrollToBottom);
                } else {
                    console.log('GroupChat: Message already exists, skipping duplicate');
                }
            }
        }
    },
    mounted() {
        document.addEventListener('click', this.closeEmojiPickerOnClickOutside);
        // Get current user ID from root
        this.currentUserId = this.$root.currentUser?.id;
        console.log('GroupChat: Component mounted for group', this.groupId, 'current user:', this.currentUserId);
        this.fetchHistory();
        
        // Listen for group chat messages
        this._onGroupChatMessage = (e) => {
            const msg = e.detail;
            console.log('GroupChat: Received group-chat-message event:', msg);
            this.receiveMessage(msg);
        };
        
        window.addEventListener('group-chat-message', this._onGroupChatMessage);
        
        this.$nextTick(() => {
            if (this.$refs.inputBox) this.$refs.inputBox.focus();
            const c = this.$refs.messagesContainer;
            if (c) {
                // Add user activity listeners
                this._debouncedResetUnread = this.debounce(this.resetUnread, 500);
                ['focus', 'keydown', 'mousedown', 'mousemove', 'scroll'].forEach(evt => {
                    c.addEventListener(evt, this._debouncedResetUnread);
                });
            }
        });
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeEmojiPickerOnClickOutside);
        window.removeEventListener('group-chat-message', this._onGroupChatMessage);
        const c = this.$refs.messagesContainer;
        if (c && this._debouncedResetUnread) {
            ['focus', 'keydown', 'mousedown', 'mousemove', 'scroll'].forEach(evt => {
                c.removeEventListener(evt, this._debouncedResetUnread);
            });
        }
    }
};
window.G_GroupChat = GroupChat; 