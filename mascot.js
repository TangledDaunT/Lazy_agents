/**
 * Mascot System - SVG avatar rendering for each agent
 */

const MascotSystem = {
  // Basic mascot data
  mascots: {},
  
  /**
   * Create a mascot element for an agent
   */
  createMascot(config) {
    const { agentId, accentColor = '#f5d061', state = 'idle' } = config;
    
    // Create mascot container
    const mascotDiv = document.createElement('div');
    mascotDiv.className = `mascot ${state}`;
    mascotDiv.id = `mascot-${agentId}`;
    mascotDiv.style.setProperty('--agent-color', accentColor);
    
    // Simple clean avatar
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = this.renderAvatar(agentId, accentColor, state);
    
    mascotDiv.appendChild(svg);
    
    this.mascots[agentId] = {
      element: mascotDiv,
      config,
      state
    };
    
    return mascotDiv;
  },
  
  /**
   * Render avatar SVG content
   */
  renderAvatar(agentId, accentColor, state) {
    const initials = {
      hermes: 'H',
      byte: 'B',
      ledger: 'L',
      sage: 'S',
      compass: 'C'
    };
    
    const letter = initials[agentId] || agentId[0].toUpperCase();
    
    return `
      <circle cx="50" cy="50" r="45" fill="rgba(30,30,35,0.9)" stroke="${accentColor}" stroke-width="3"/>
      <text x="50" y="58" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="36" font-weight="700" fill="${accentColor}">${letter}</text>
      ${state === 'working' ? `<circle cx="75" cy="25" r="8" fill="${accentColor}" opacity="0.8"><animate attributeName="r" values="8;12;8" dur="1s" repeatCount="indefinite"/></circle>` : ''}
      ${state === 'listening' ? `<circle cx="75" cy="25" r="8" fill="#ff6b6b" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.6s" repeatCount="indefinite"/></circle>` : ''}
    `;
  },
  
  /**
   * Update mascot state
   */
  setState(mascotDiv, state) {
    if (!mascotDiv) return;
    
    mascotDiv.className = `mascot ${state}`;
    
    const svg = mascotDiv.querySelector('svg');
    if (svg) {
      const agentId = mascotDiv.id.replace('mascot-', '');
      const config = this.mascots[agentId];
      if (config) {
        svg.innerHTML = this.renderAvatar(agentId, config.config.accentColor || '#f5d061', state);
        config.state = state;
      }
    }
  },
  
  /**
   * Get mascot element by agent ID
   */
  getMascot(agentId) {
    return this.mascots[agentId]?.element || document.getElementById(`mascot-${agentId}`);
  }
};

// Export globally
window.MascotSystem = MascotSystem;
