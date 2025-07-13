// Centralized Unread Count Service
// Prevents duplicate API calls and manages unread count state across components

class UnreadCountService {
    constructor() {
        this.unreadCounts = {};
        this.listeners = new Set();
        this.isInitialized = false;
        this.fetchPromise = null;
    }

    // Initialize the service
    async init() {
        if (this.isInitialized) return;
        
        await this.fetchUnreadCounts();
        this.isInitialized = true;
    }

    // Fetch unread counts from server
    async fetchUnreadCounts() {
        // Prevent multiple simultaneous fetches
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        this.fetchPromise = fetch('/api/unread-group-counts', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                this.unreadCounts = data || {};
                this.notifyListeners();
                return this.unreadCounts;
            })
            .catch(() => {
                this.unreadCounts = {};
                this.notifyListeners();
                return this.unreadCounts;
            })
            .finally(() => {
                this.fetchPromise = null;
            });

        return this.fetchPromise;
    }

    // Get unread count for a specific group
    getUnreadCount(groupId) {
        return this.unreadCounts[groupId] || 0;
    }

    // Get all unread counts
    getAllUnreadCounts() {
        return { ...this.unreadCounts };
    }

    // Update unread count for a specific group
    updateUnreadCount(groupId, count) {
        this.unreadCounts[groupId] = count;
        this.notifyListeners();
    }

    // Reset unread count for a group (when chat is opened)
    resetUnreadCount(groupId) {
        this.updateUnreadCount(groupId, 0);
    }

    // Add listener for unread count changes
    addListener(callback) {
        this.listeners.add(callback);
        // Immediately call with current data
        callback(this.getAllUnreadCounts());
    }

    // Remove listener
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    // Notify all listeners of changes
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.getAllUnreadCounts());
            } catch (error) {
                console.error('Error in unread count listener:', error);
            }
        });
    }

    // Clear all data (for logout)
    clear() {
        this.unreadCounts = {};
        this.listeners.clear();
        this.isInitialized = false;
        this.fetchPromise = null;
    }
}

// Create singleton instance
const unreadCountService = new UnreadCountService();

// Attach to window for global access
window.unreadCountService = unreadCountService;

// Listen for global events
window.addEventListener('unread-group-count-update', (event) => {
    const { groupId, count } = event.detail;
    unreadCountService.updateUnreadCount(groupId, count);
});

window.addEventListener('clear-all-data', () => {
    unreadCountService.clear();
}); 