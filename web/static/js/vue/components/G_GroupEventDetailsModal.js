window.G_GroupEventDetailsModal = {
  name: 'G_GroupEventDetailsModal',
  props: {
    event: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  template: `
    <div class="modal-overlay" style="z-index: 3000;">
      <div class="modal-content">
        <h2>Event Details</h2>
        <div v-if="event">
          <p><strong>Title:</strong> {{ event.title || event.name || event.id }}</p>
          <p v-if="event.description"><strong>Description:</strong> {{ event.description }}</p>
          <p v-if="event.event_date || event.date"><strong>Date:</strong> {{ event.event_date || event.date }}</p>
          <p v-if="event.created_by"><strong>Created By:</strong> {{ event.created_by }}</p>
          <p v-if="event.group_id"><strong>Group ID:</strong> {{ event.group_id }}</p>
        </div>
        <button @click="$emit('close')">Close</button>
      </div>
    </div>
  `
}; 