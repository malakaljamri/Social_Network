// Layer Manager - Automatic Z-Index Management System

class LayerManager {
    constructor() {
        this.activeModals = [];
        this.activeNotifications = [];
        this.modalStackLevel = 0;
        this.notificationStackLevel = 0;
        this.maxModalStack = 5;
        this.maxNotificationStack = 5;
    }

    // Modal Management
    openModal(modalElement) {
        if (!modalElement) return;

        // Add to active modals
        this.activeModals.push(modalElement);
        
        // Calculate stack level
        this.modalStackLevel = Math.min(this.activeModals.length - 1, this.maxModalStack);
        
        // Apply appropriate z-index
        this.applyModalZIndex(modalElement, this.modalStackLevel);
        
        // Add overlay if needed
        this.addModalOverlay(modalElement);
        
        console.log(`Modal opened with stack level: ${this.modalStackLevel}`);
        return this.modalStackLevel;
    }

    closeModal(modalElement) {
        if (!modalElement) return;

        // Remove from active modals
        const index = this.activeModals.indexOf(modalElement);
        if (index > -1) {
            this.activeModals.splice(index, 1);
        }

        // Recalculate stack levels for remaining modals
        this.recalculateModalStack();
        
        // Remove overlay
        this.removeModalOverlay(modalElement);
        
        console.log(`Modal closed. Remaining modals: ${this.activeModals.length}`);
    }

    applyModalZIndex(modalElement, stackLevel) {
        const overlay = modalElement.querySelector('.modal-overlay');
        const content = modalElement.querySelector('.modal-content');
        
        if (overlay) {
            overlay.style.zIndex = `calc(var(--z-index-overlay) + ${stackLevel * 100})`;
        }
        
        if (content) {
            content.style.zIndex = `calc(var(--z-index-modal) + ${stackLevel * 100})`;
        }
    }

    recalculateModalStack() {
        this.activeModals.forEach((modal, index) => {
            const stackLevel = Math.min(index, this.maxModalStack);
            this.applyModalZIndex(modal, stackLevel);
        });
    }

    addModalOverlay(modalElement) {
        // Ensure modal has proper overlay structure
        if (!modalElement.querySelector('.modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            modalElement.appendChild(overlay);
        }
    }

    removeModalOverlay(modalElement) {
        const overlay = modalElement.querySelector('.modal-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Notification Management
    showNotification(notificationElement, type = 'info', duration = 5000) {
        if (!notificationElement) return;

        // Add to active notifications
        this.activeNotifications.push(notificationElement);
        
        // Calculate stack level
        this.notificationStackLevel = Math.min(this.activeNotifications.length - 1, this.maxNotificationStack);
        
        // Apply appropriate z-index
        this.applyNotificationZIndex(notificationElement, this.notificationStackLevel);
        
        // Add type class
        notificationElement.classList.add(type);
        
        // Show notification
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 100);

        // Auto-remove after duration
        setTimeout(() => {
            this.hideNotification(notificationElement);
        }, duration);

        console.log(`Notification shown with stack level: ${this.notificationStackLevel}`);
        return this.notificationStackLevel;
    }

    hideNotification(notificationElement) {
        if (!notificationElement) return;

        // Add hide animation
        notificationElement.classList.remove('show');
        notificationElement.style.animation = 'slideOutRight 0.3s ease-in';

        // Remove after animation
        setTimeout(() => {
            // Remove from active notifications
            const index = this.activeNotifications.indexOf(notificationElement);
            if (index > -1) {
                this.activeNotifications.splice(index, 1);
            }

            // Recalculate stack levels
            this.recalculateNotificationStack();
            
            // Remove element
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300);
    }

    applyNotificationZIndex(notificationElement, stackLevel) {
        notificationElement.style.zIndex = `calc(var(--z-index-notification) + ${stackLevel * 100})`;
    }

    recalculateNotificationStack() {
        this.activeNotifications.forEach((notification, index) => {
            const stackLevel = Math.min(index, this.maxNotificationStack);
            this.applyNotificationZIndex(notification, stackLevel);
        });
    }

    // Utility methods
    getTopModal() {
        return this.activeModals[this.activeModals.length - 1] || null;
    }

    getTopNotification() {
        return this.activeNotifications[this.activeNotifications.length - 1] || null;
    }

    clearAllModals() {
        this.activeModals.forEach(modal => {
            this.closeModal(modal);
        });
    }

    clearAllNotifications() {
        this.activeNotifications.forEach(notification => {
            this.hideNotification(notification);
        });
    }

    // Create notification element
    createNotificationElement(message, type = 'info', icon = null) {
        const notification = document.createElement('div');
        notification.className = 'notification-popup layer-notification';
        
        let iconHtml = '';
        if (icon) {
            iconHtml = `<span class="notification-icon">${icon}</span>`;
        }
        
        notification.innerHTML = `
            ${iconHtml}
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="layerManager.hideNotification(this.parentElement)">×</button>
        `;
        
        return notification;
    }

    // Quick notification methods
    showInfo(message, duration = 5000) {
        const notification = this.createNotificationElement(message, 'info', 'ℹ️');
        document.body.appendChild(notification);
        return this.showNotification(notification, 'info', duration);
    }

    showSuccess(message, duration = 5000) {
        const notification = this.createNotificationElement(message, 'success', '✅');
        document.body.appendChild(notification);
        return this.showNotification(notification, 'success', duration);
    }

    showError(message, duration = 7000) {
        const notification = this.createNotificationElement(message, 'error', '❌');
        document.body.appendChild(notification);
        return this.showNotification(notification, 'error', duration);
    }

    showWarning(message, duration = 6000) {
        const notification = this.createNotificationElement(message, 'warning', '⚠️');
        document.body.appendChild(notification);
        return this.showNotification(notification, 'warning', duration);
    }
}

// Global instance
const layerManager = new LayerManager();

// Export for use in other modules
window.layerManager = layerManager; 