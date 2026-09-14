/**
 * Mascot System - Pixel-art avatar rendering for Hermes Council agents
 */

const MascotSystem = {
  mascots: {},
  
  /**
   * Create a pixel-art mascot element for an agent
   */
  createMascot(config) {
    const { agentId, accentColor = '#f5d061', state = 'idle', outfit = 'corporate' } = config;
    
    const mascotDiv = document.createElement('div');
    mascotDiv.className = `mascot ${state}`;
    mascotDiv.id = `mascot-${agentId}`;
    mascotDiv.style.setProperty('--agent-color', accentColor);
    
    // Create pixel-art image
    const img = document.createElement('img');
    img.src = `assets/mascots/${agentId}-${outfit}.png`;
    img.className = 'mascot-sprite';
    img.alt = agentId;
    mascotDiv.appendChild(img);
    
    // Create status badge
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    mascotDiv.appendChild(badge);
    
    this.mascots[agentId] = { element: mascotDiv, config, state };
    this.updateBadge(mascotDiv, state);
    
    return mascotDiv;
  },
  
  /**
   * Update status badge based on agent state
   */
  updateBadge(mascotDiv, state) {
    const badge = mascotDiv.querySelector('.status-badge');
    if (!badge) return;
    
    badge.className = 'status-badge';
    
    if (state === 'working') {
      badge.classList.add('badge-thinking');
    } else if (state === 'awaiting-approval') {
      badge.classList.add('badge-asking');
    } else if (state === 'done') {
      badge.classList.add('badge-done');
    }
  },
  
  /**
   * Set mascot state
   */
  setState(mascotDiv, state) {
    if (!mascotDiv) return;
    
    mascotDiv.className = `mascot ${state}`;
    this.updateBadge(mascotDiv, state);
    
    const agentId = mascotDiv.id.replace('mascot-', '');
    if (this.mascots[agentId]) {
      this.mascots[agentId].state = state;
    }
  },
  
  /**
   * Get mascot element by agent ID
   */
  getMascot(agentId) {
    return this.mascots[agentId]?.element || document.getElementById(`mascot-${agentId}`);
  },
  
  /**
   * Enter council mode - circular formation with synchronized thinking badges
   */
  enterCouncilMode() {
    const agents = Object.keys(this.mascots);
    const radius = 120;
    const centerX = 180;
    const centerY = 140;
    
    agents.forEach((agentId, index) => {
      const mascot = this.mascots[agentId];
      if (!mascot?.element) return;
      
      const angle = (index / agents.length) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      mascot.element.style.transition = 'transform 0.5s ease';
      mascot.element.style.position = 'absolute';
      mascot.element.style.left = `${x}px`;
      mascot.element.style.top = `${y}px`;
      mascot.element.style.transform = 'translate(-50%, -50%)';
      
      this.setState(mascot.element, 'working');
    });
  },
  
  /**
   * Exit council mode
   */
  exitCouncilMode() {
    Object.values(this.mascots).forEach(({ element }) => {
      element.style.position = '';
      element.style.left = '';
      element.style.top = '';
      element.style.transform = '';
      this.setState(element, 'idle');
    });
  }
};

window.MascotSystem = MascotSystem;
