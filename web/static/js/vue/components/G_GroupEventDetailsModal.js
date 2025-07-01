window.G_GroupEventDetailsModal = {
  name: 'G_GroupEventDetailsModal',
  props: {
    event: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  data() {
    return {
      attendance: 'not going',
      originalAttendance: 'not going',
      loading: false,
      error: ''
    };
  },
  async mounted() {
    this.loading = true;
    this.error = '';
    try {
      const resp = await fetch(`/api/groups/events/attendance?event_id=${this.event.id || this.event.ID}`, { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        this.attendance = data.status || 'not going';
        this.originalAttendance = this.attendance;
      } else {
        this.attendance = 'not going';
        this.originalAttendance = 'not going';
      }
    } catch (e) {
      this.error = 'Failed to fetch attendance status.';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async closeModal() {
      if (this.attendance !== this.originalAttendance) {
        try {
          await fetch('/api/groups/events/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ event_id: this.event.id || this.event.ID, status: this.attendance })
          });
        } catch (e) {
          // Optionally handle error
        }
      }
      this.$emit('close');
    }
  },
  template: `
    <div class="modal-overlay" style="z-index: 3000;">
      <div class="modal-content">
        <h2>Event Details</h2>
        <div v-if="event">
          <p><strong>Title:</strong> {{ event.title || event.name || event.id }}</p>
          <p v-if="event.event_date || event.date"><strong>Date:</strong> {{ event.event_date || event.date }}</p>
          <p v-if="event.description"><strong>Description:</strong> {{ event.description }}</p>
          <div class="attendance-section" style="margin-top: 16px;">
            <label><input type="checkbox" v-model="attendance" true-value="going" false-value="not going" :checked="attendance==='going'" @change="attendance='going'"> Going</label>
            <label style="margin-left: 16px;"><input type="checkbox" v-model="attendance" true-value="not going" false-value="going" :checked="attendance==='not going'" @change="attendance='not going'"> Not Going</label>
          </div>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <button @click="closeModal">Close</button>
      </div>
    </div>
  `
}; 