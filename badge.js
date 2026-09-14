/**
 * BadgeSystem - Manages status badge display for mascot elements
 */

const BadgeSystem = {
  /**
   * Badge state mappings
   */
  BADGE_CLASSES: {
    'working': 'badge-thinking',
    'awaiting-approval': 'badge-asking',
    'done': 'badge-done',
    'idle': ''
  },
  
  /**
   * Update badge display based on state
   */
  updateBadge(badgeElement, state) {
    if (!badgeElement) return;
    
    // Remove all badge classes
    badgeElement.className = 'status-badge';
    
    // Add appropriate badge class
    const badgeClass = this.BADGE_CLASSES[state];
    if (badgeClass) {
      badgeElement.classList.add(badgeClass);
    }
  },
  
  /**
   * Create a new badge element
   */
  createBadge() {
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('aria-label', 'Agent status indicator');
    return badge;
  },
  
  /**
   * Get badge state description for screen readers
   */
  getStateDescription(state) {
    const descriptions = {
      'working': 'Agent is actively processing',
      'awaiting-approval': 'Agent is waiting for approval',
      'done': 'Agent has completed task',
      'idle': 'Agent is idle'
    };
    return descriptions[state] || 'Unknown state';
  }
};

window.BadgeSystem = BadgeSystem;
