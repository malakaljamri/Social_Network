// GroupEventsModal Component
const GroupEventsModal = {
    props: {
        events: {
            type: Array,
            required: true
        },
        groupId: {
            type: Number,
            required: true
        }
    },
    data() {
        return {
            showCreateEventModal: false
        };
    },
    computed: {
        upcomingEvents() {
            const now = new Date();
            return this.events.filter(ev => {
                const evDate = new Date(ev.event_date.replace(' ', 'T'));
                // Upcoming: today or future
                return evDate >= new Date(now.toDateString());
            });
        },
        pastEvents() {
            const now = new Date();
            return this.events.filter(ev => {
                const evDate = new Date(ev.event_date.replace(' ', 'T'));
                // Past: strictly before today
                return evDate < new Date(now.toDateString());
            });
        }
    },
    methods: {
        formatDate(dateStr) {
            if (!dateStr) return '';
            const iso = dateStr.replace(' ', 'T');
            const d = new Date(iso);
            return isNaN(d) ? dateStr : d.toLocaleString();
        },
        openCreateEvent() {
            this.showCreateEventModal = true;
        },
        closeCreateEvent() {
            this.showCreateEventModal = false;
        },
        handleEventCreated() {
            this.showCreateEventModal = false;
            this.$emit('refresh-events');
        },
        close() {
            this.$emit('close');
        }
    },
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content" @click.stop style="max-width: 400px;">
                    <h2>Group Events</h2>
                    <button class="create-event-btn" @click="openCreateEvent" style="margin-bottom: 12px;">Create Event</button>
                    <div class="form-group">
                        <h3>Upcoming Events</h3>
                        <div v-if="upcomingEvents.length === 0" style="color: #888; padding: 8px;">No upcoming events</div>
                        <div v-for="event in upcomingEvents" :key="event.id" class="event-item">
                            <button class="event-btn" @click="$emit('event-click', event)">
                                {{ event.title || event.name || event.id }} - {{ formatDate(event.event_date) || formatDate(event.date) }}
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <h3>Past Events</h3>
                        <div v-if="pastEvents.length === 0" style="color: #888; padding: 8px;">No past events</div>
                        <div v-for="event in pastEvents" :key="event.id" class="event-item">
                            <button class="event-btn" @click="$emit('event-click', event)">
                                {{ event.title || event.name || event.id }} - {{ formatDate(event.event_date) || formatDate(event.date) }}
                            </button>
                        </div>
                    </div>
                    <button type="button" class="cancel-btn" @click="close">Close</button>
                    <m-group-create-event
                        v-if="showCreateEventModal"
                        :group-id="groupId"
                        @close="closeCreateEvent"
                        @created="handleEventCreated"
                    />
                </div>
            </div>
        </teleport>
    `,
    components: {
        'm-group-create-event': window.M_GroupCreateEvent
    },
    emits: ['close', 'refresh-events', 'event-click']
};

window.G_GroupEventsModal = GroupEventsModal; 