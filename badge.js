// Add animation delay constants
const BADGE_DELAYS = {
  'thinking': { showIn: 200, hideAfter: null },
  'asking': { showIn: 100, hideAfter: null },
  'done': { showIn: 50, hideAfter: 2000 }
};

BadgeSystem.updateBadgeWithDelay = function(badgeElement, state, delay = 0) {
  const delays = BADGE_DELAYS[state] || { showIn: 0 };
  setTimeout(() => {
    this.updateBadge(badgeElement, state);
  }, delays.showIn);
};
