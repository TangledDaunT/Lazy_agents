/**
 * Mascot System - Pixel-art avatar rendering for LazyAgents Council
 * Priority fixes: correct mascot paths, status badges, click-to-chat
 */

const MascotSystem = {
  mascots: {},
  
  // Agent to mascot animal mapping
  agentMascots: {
    hermes: { animal: 'owl', defaultOutfit: 'corporate' },
    byte: { animal: 'monkey', defaultOutfit: 'casual' },
    ledger: { animal: 'lion', defaultOutfit: 'suit' },
    sage: { animal: 'cat', defaultOutfit: 'corporate' },
    compass: { animal: 'dog', defaultOutfit: 'suit' }
  },
  
  // Accent colors per agent
  accentColors: {
    hermes: '#f5d061',
    byte: '#38bdf8',
    ledger: '#10b981',
    sage: '#8b5cf6',
    compass: '#f43f5e'
  },
  
  /**
   * Create a pixel-art mascot element for an agent
   */
  createMascot(config) {
    const { agentId, accentColor, state = 'idle', outfit } = config;
    
    const mascotInfo = this.agentMascots[agentId] || { animal: 'owl', defaultOutfit: 'corporate' };
    const effectiveOutfit = outfit || mascotInfo.defaultOutfit;
    const effectiveAccent = accentColor || this.accentColors[agentId] || '#f5d061';
    
    const mascotDiv = document.createElement('div');
    mascotDiv.className = `mascot ${state}`;
    mascotDiv.id = `mascot-${agentId}`;
    mascotDiv.dataset.agent = agentId;
    mascotDiv.style.setProperty('--agent-color', effectiveAccent);
    
    // Create pixel-art image with correct path
    const img = document.createElement('img');
    img.src = `assets/mascots/${agentId}-${effectiveOutfit}.png`;
    img.className = 'mascot-sprite';
    img.alt = `${agentId} mascot`;
    img.draggable = false;
    
    // Handle image load errors - show initial if specific outfit missing
    img.onerror = () => {
      console.warn(`[Mascot] Could not load ${img.src}, trying fallback`);
      const fallbackOutfit = mascotInfo.defaultOutfit;
      img.src = `assets/mascots/${agentId}-${fallbackOutfit}.png`;
      
      // Second fallback - try default corporate
      img.onerror = () => {
        console.warn(`[Mascot] Fallback failed for ${agentId}, using placeholder`);
        mascotDiv.innerHTML = `<span style="font-size:28px;font-weight:700;">${agentId[0].toUpperCase()}</span>`;
        mascotDiv.style.background = `linear-gradient(135deg, ${effectiveAccent}33, ${effectiveAccent}66)`;
        img.remove();
      };
    };
    
    mascotDiv.appendChild(img);
    
    // Create status badge - docked to top-right corner of mascot circle
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    badge.id = `badge-${agentId}`;
    mascotDiv.appendChild(badge);
    
    // Store mascot reference
    this.mascots[agentId] = { 
      element: mascotDiv, 
      config: { ...config, outfit: effectiveOutfit }, 
      state,
      accentColor: effectiveAccent
    };
    
    this.updateBadge(mascotDiv, state);
    
    return mascotDiv;
  },
  
  /**
   * Update status badge based on agent state
   * States: idle, working, awaiting-approval, done
   */
  updateBadge(mascotDiv, state) {
    const badge = mascotDiv.querySelector('.status-badge');
    if (!badge) return;
    
    // Reset badge
    badge.className = 'status-badge';
    badge.innerHTML = '';
    
    // Set badge based on state
    if (state === 'working') {
      badge.classList.add('badge-thinking');
      badge.title = 'Thinking...';
      // Cursor icon is rendered via CSS
    } else if (state === 'awaiting-approval' || state === 'asking') {
      badge.classList.add('badge-asking');
      badge.title = 'Needs approval';
      badge.innerHTML = '💡';
    } else if (state === 'done') {
      badge.classList.add('badge-done');
      badge.title = 'Task complete';
      badge.innerHTML = '✓';
    }
    // idle = no badge shown (badge is hidden via CSS when no matching class)
  },
  
  /**
   * Set mascot state
   */
  setState(mascotDiv, state) {
    if (!mascotDiv) return;
    
    // Update class
    mascotDiv.className = `mascot ${state}`;
    this.updateBadge(mascotDiv, state);
    
    // Update stored state
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
   * Get mascot state
   */
  getState(agentId) {
    return this.mascots[agentId]?.state || 'idle';
  },
  
  /**
   * Change mascot outfit (for future skin switching)
   */
  setOutfit(agentId, outfit) {
    const mascot = this.mascots[agentId];
    if (!mascot) return;
    
    const img = mascot.element.querySelector('.mascot-sprite');
    if (img) {
      mascot.element.classList.add('outfit-changing');
      img.src = `assets/mascots/${agentId}-${outfit}.png`;
      mascot.config.outfit = outfit;
      
      setTimeout(() => {
        mascot.element.classList.remove('outfit-changing');
      }, 500);
    }
  }
};

// Make globally available
window.MascotSystem = MascotSystem;
