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
      error: '',
      isPastEvent: false,
      attendees: [],
      attendeesLoading: false,
      attendeesError: ''
    };
  },
  async mounted() {
    this.loading = true;
    this.error = '';
    // Compute if event is in the past
    const dateStr = this.event.event_date || this.event.date;
    if (dateStr) {
      const eventDate = new Date(dateStr.split('T')[0]);
      const today = new Date();
      today.setHours(0,0,0,0);
      this.isPastEvent = eventDate < today;
    }
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
    await this.fetchAttendees();
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
          await this.fetchAttendees();
        } catch (e) {
          // Optionally handle error
        }
      }
      this.$emit('close');
    },
    formatDate(dateStr) {
      return window.formatDateDDMMYYYY ? window.formatDateDDMMYYYY(dateStr) : dateStr;
    },
    async fetchAttendees() {
      this.attendeesLoading = true;
      this.attendeesError = '';
      try {
        const resp = await fetch(`/api/groups/events/attendance/list?event_id=${this.event.id || this.event.ID}`, { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          this.attendees = data.attendees || [];
        } else {
          this.attendees = [];
          this.attendeesError = 'Failed to fetch attendees.';
        }
      } catch (e) {
        this.attendeesError = 'Failed to fetch attendees.';
      } finally {
        this.attendeesLoading = false;
      }
    },
    async handleAttendanceChange(status) {
      if (this.attendance === status) return;
      this.attendance = status;
      try {
        await fetch('/api/groups/events/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ event_id: this.event.id || this.event.ID, status })
        });
        await this.fetchAttendees();
      } catch (e) {
        // Optionally handle error
      }
    }
  },
  template: `
    <div class="modal-overlay" style="z-index: 3000; display: flex; justify-content: center; align-items: center;">
      <div class="modal-content" style="display: flex; flex-direction: row; gap: 32px; min-width: 600px; max-width: 900px;">
        <!-- Left: Event Info -->
        <div style="flex: 1 1 0; min-width: 320px;">
          <h2>Event Details</h2>
          <div v-if="event">
            <p><strong>Title:</strong> {{ event.title || event.name || event.id }}</p>
            <p v-if="event.event_date || event.date"><strong>Date:</strong> {{ formatDate(event.event_date || event.date) }}</p>
            <p v-if="event.description"><strong>Description:</strong> {{ event.description }}</p>
            <div v-if="!isPastEvent" class="attendance-section" style="margin-top: 16px;">
              <label><input type="checkbox" v-model="attendance" true-value="going" false-value="not going" :checked="attendance==='going'" @change="handleAttendanceChange('going')"> Going</label>
              <label style="margin-left: 16px;"><input type="checkbox" v-model="attendance" true-value="not going" false-value="going" :checked="attendance==='not going'" @change="handleAttendanceChange('not going')"> Not Going</label>
            </div>
            <div v-else style="margin-top: 16px; color: #888;">Attendance selection is disabled for past events.</div>
          </div>
          <div v-if="error" class="error">{{ error }}</div>
          <button @click="closeModal">Close</button>
        </div>
        <!-- Right: Attendance List -->
        <div class="attendance-box">
          <h3>Attendance</h3>
          <div v-if="attendeesLoading">Loading...</div>
          <div v-else>
            <p><strong>Going:</strong> {{ attendees.length }}</p>
            <div class="attendance-list-container">
              <ul style="margin: 0; padding: 0; list-style: none;">
                <li v-for="user in attendees" :key="user" class="attendance-user">{{ user }}</li>
                <li v-if="attendees.length === 0" class="attendance-empty">No attendees yet.</li>
              </ul>
            </div>
          </div>
          <div v-if="attendeesError" class="error">{{ attendeesError }}</div>
        </div>
      </div>
    </div>
  `
}; 