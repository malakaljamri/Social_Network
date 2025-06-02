// GroupChat Component
const GroupChat = {
    props: ['groupName'],
    template: `
        <div class="modal-content" @click.stop style="max-width: 400px;">
            <h2>{{ groupName }} Chat Room</h2>
            <div style="margin: 24px 0; color: #888; text-align: center;">(Chat UI coming soon...)</div>
            <button type="button" class="cancel-btn" @click="$emit('close')">Close</button>
        </div>
    `
};
window.GroupChat = GroupChat; 