
/**
 * Mascot System - Pixel-art avatar rendering for each agent
 */

const MascotSystem = {
  mascots: {},
  
  createMascot(config) {
    const { agentId, accentColor = '#f5d061', state = 'idle', outfit = 'corporate' } = config;
    
    const mascotDiv = document.createElement('div');
    mascotDiv.className = `mascot ${state}`;
    mascotDiv.id = `mascot-${agentId}`;
    mascotDiv.style.setProperty('--agent-color', accentColor);
    
    // Create image element for pixel art
    const img = document.createElement('img');
    img.src = `assets/mascots/${agentId}-${outfit}.png`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    mascotDiv.appendChild(img);

    // Create badge element
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    mascotDiv.appendChild(badge);
    
    this.mascots[agentId] = { element: mascotDiv, config, state };
    this.updateBadge(mascotDiv, state);
    
    return mascotDiv;
  },

  updateBadge(mascotDiv, state) {
    const badge = mascotDiv.querySelector('.status-badge');
    badge.className = 'status-badge';
    if (state === 'working') badge.classList.add('badge-thinking');
    if (state === 'awaiting-approval') badge.classList.add('badge-asking');
    if (state === 'done') badge.classList.add('badge-done');
  },

  setState(mascotDiv, state) {
    mascotDiv.className = `mascot ${state}`;
    this.updateBadge(mascotDiv, state);
    this.mascots[mascotDiv.id.replace('mascot-', '')].state = state;
  }
};

window.MascotSystem = MascotSystem;
