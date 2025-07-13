# Layering Hierarchy System

## Overview
This document outlines the comprehensive z-index hierarchy system implemented for the Social Network application. The hierarchy follows user expectations and UI/UX best practices.

## Hierarchy Structure

### 1. **Background and Base Content Layers** (1-20)
```
--z-index-background: 1    // Page background
--z-index-content: 10      // Main page content
--z-index-card: 20         // Card components
```

**Purpose**: Foundation layers for all content
**Usage**: Page backgrounds, main content areas, card components

### 2. **Navigation and Main UI Components** (100-140)
```
--z-index-navbar: 100      // Main navigation bar
--z-index-sidebar: 110     // Sidebar components
--z-index-dropdown: 120    // Dropdown menus
--z-index-sticky: 130      // Sticky elements
--z-index-fixed: 140       // Fixed position elements
```

**Purpose**: Core UI navigation and layout components
**Usage**: NavBar, sidebars, dropdowns, sticky headers, fixed chat windows

### 3. **Interactive Elements** (150-170)
```
--z-index-button: 150      // Interactive buttons
--z-index-tooltip: 160     // Tooltips and hints
--z-index-context-menu: 170 // Context menus
```

**Purpose**: User interaction elements
**Usage**: Buttons, tooltips, context menus, hover effects

### 4. **Overlay and Modal System** (200-800) - **HIGHEST PRIORITY**
```
--z-index-overlay: 200     // Modal backdrop
--z-index-modal: 300       // Base modal
--z-index-modal-stack: 400 // Modal stack level 1
--z-index-modal-stack-2: 500 // Modal stack level 2
--z-index-modal-stack-3: 600 // Modal stack level 3
--z-index-modal-stack-4: 700 // Modal stack level 4
--z-index-modal-stack-5: 800 // Modal stack level 5
```

**Purpose**: Modal dialogs and overlays (highest priority)
**Usage**: Login modals, form dialogs, confirmation dialogs, nested modals

### 5. **Notification System** (900-1400) - **SECOND HIGHEST PRIORITY**
```
--z-index-notification: 900        // Base notification
--z-index-notification-stack: 1000 // Notification stack level 1
--z-index-notification-stack-2: 1100 // Notification stack level 2
--z-index-notification-stack-3: 1200 // Notification stack level 3
--z-index-notification-stack-4: 1300 // Notification stack level 4
--z-index-notification-stack-5: 1400 // Notification stack level 5
```

**Purpose**: Real-time notifications and alerts
**Usage**: Success messages, error alerts, info popups, action confirmations

### 6. **Special Cases** (9998-9999)
```
--z-index-debug: 9998  // Debug overlays
--z-index-max: 9999    // Maximum priority
```

**Purpose**: Special cases and debugging
**Usage**: Debug tools, emergency overlays, maximum priority elements

## Priority Rules

### **Rule 1: Modals Trump Everything**
- Modals always appear above all other content
- New modals automatically stack above existing ones
- Modal backdrops prevent interaction with underlying content

### **Rule 2: Notifications Trump Regular Content**
- Notifications appear above navigation and main content
- But notifications appear below modals (modals are more important)
- Multiple notifications stack automatically

### **Rule 3: Navigation Above Content**
- NavBar and navigation elements stay above main content
- Dropdowns appear above other navigation elements
- Sticky elements maintain their position

### **Rule 4: Interactive Elements Above Static Content**
- Buttons, tooltips, and interactive elements appear above static content
- Context menus appear above regular buttons

## Implementation Examples

### **CSS Classes**
```css
/* Apply layer classes to elements */
.navbar { z-index: var(--z-index-navbar); }
.modal { z-index: var(--z-index-modal); }
.notification { z-index: var(--z-index-notification); }
```

### **JavaScript Layer Manager**
```javascript
// Automatic modal stacking
layerManager.openModal(modalElement); // Automatically assigns correct z-index

// Show notifications with proper layering
layerManager.showSuccess('Action completed!', 5000); // Uses notification z-index
```

### **Component Usage**
```html
<!-- NavBar with proper layering -->
<nav class="layer-navbar">
  <!-- Navigation content -->
</nav>

<!-- Modal with automatic stacking -->
<div class="modal-overlay layer-overlay">
  <div class="modal-content layer-modal">
    <!-- Modal content -->
  </div>
</div>

<!-- Notification with proper priority -->
<div class="notification-popup layer-notification">
  <!-- Notification content -->
</div>
```

## Component-Specific Guidelines

### **NavBar**
- **Z-Index**: `var(--z-index-navbar)` (100)
- **Behavior**: Stays above main content, below modals and notifications
- **Children**: Dropdowns use `var(--z-index-dropdown)` (120)

### **Modals**
- **Z-Index**: `var(--z-index-modal)` (300) + stacking
- **Behavior**: Always on top, auto-stacking for nested modals
- **Backdrop**: `var(--z-index-overlay)` (200)

### **Notifications**
- **Z-Index**: `var(--z-index-notification)` (900) + stacking
- **Behavior**: Above content, below modals, auto-stacking
- **Types**: Success, error, warning, info

### **Chat Windows**
- **Z-Index**: `var(--z-index-fixed)` (140)
- **Behavior**: Fixed position, above content, below modals/notifications

### **Search Dropdowns**
- **Z-Index**: `var(--z-index-dropdown)` (120)
- **Behavior**: Above navigation, below modals/notifications

## Best Practices

### **1. Use CSS Variables**
```css
/* ✅ Good */
.modal { z-index: var(--z-index-modal); }

/* ❌ Bad */
.modal { z-index: 1000; }
```

### **2. Use Layer Manager for Dynamic Elements**
```javascript
// ✅ Good - Automatic stacking
layerManager.openModal(modalElement);

// ❌ Bad - Manual z-index
modalElement.style.zIndex = '1000';
```

### **3. Consider Mobile Responsiveness**
```css
@media (max-width: 768px) {
  .notification-popup {
    /* Adjust positioning for mobile */
    top: 10px;
    right: 10px;
    left: 10px;
  }
}
```

### **4. Test Layering Scenarios**
- Multiple modals open simultaneously
- Notifications appearing during modal interactions
- Dropdowns in navigation
- Chat windows with other overlays

## Common Scenarios

### **Scenario 1: User Opens Modal While Notification is Active**
1. Notification appears (z-index: 900)
2. User clicks button that opens modal
3. Modal appears above notification (z-index: 300)
4. Notification remains visible but below modal

### **Scenario 2: Multiple Modals**
1. User opens first modal (z-index: 300)
2. User opens second modal from first modal (z-index: 400)
3. Second modal appears above first modal
4. Closing second modal reveals first modal

### **Scenario 3: Notifications During Modal Interaction**
1. User has modal open (z-index: 300)
2. Background process completes, shows notification
3. Notification appears above modal (z-index: 900)
4. User can see notification but modal remains accessible

## Benefits of This System

### **User Experience**
- **Predictable behavior**: Users know what to expect
- **Clear hierarchy**: Visual importance is obvious
- **No conflicts**: Elements don't fight for attention

### **Developer Experience**
- **Centralized management**: All z-index values in one place
- **Automatic stacking**: No manual z-index calculations
- **Easy maintenance**: Clear rules and guidelines

### **Technical Benefits**
- **Performance**: Efficient layering calculations
- **Scalability**: Supports unlimited stacking levels
- **Consistency**: Uniform behavior across the application

## Future Enhancements

### **Potential Improvements**
- **Theme-aware layering**: Different hierarchies for different themes
- **Accessibility layers**: Special considerations for screen readers
- **Animation layers**: Dedicated z-index ranges for animations
- **Performance optimization**: Lazy loading of high-priority elements

### **Advanced Features**
- **Layer debugging**: Visual tools to inspect z-index hierarchy
- **Dynamic priority**: Context-aware layering adjustments
- **Gesture layers**: Touch and gesture-specific layering
- **AR/VR support**: 3D layering for future AR/VR features

## Conclusion

This layering hierarchy system provides a robust, scalable, and user-friendly approach to managing UI element priorities. By following these guidelines, developers can ensure consistent behavior and optimal user experience across the entire application.

The system prioritizes:
1. **Modals** (highest priority) - for critical user interactions
2. **Notifications** (second highest) - for important feedback
3. **Navigation** - for consistent access to features
4. **Content** - for the main application functionality

This hierarchy aligns with user expectations and modern UI/UX best practices. 