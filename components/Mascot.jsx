import React, { useEffect, useRef } from 'react';

const OUTFITS = ['suit', 'casual', 'beach', 'dress', 'corporate'];
const STATES = ['idle', 'listening', 'working', 'awaiting-approval', 'done'];

export function Mascot({ agentId, accentColor = '#f5d061', outfit = 'corporate', state = 'idle', className = '' }) {
  const safeOutfit = OUTFITS.includes(outfit) ? outfit : 'corporate';
  const safeState = STATES.includes(state) ? state : 'idle';
  
  const getBadgeClass = () => {
    if (safeState === 'working') return 'badge-thinking';
    if (safeState === 'awaiting-approval') return 'badge-asking';
    if (safeState === 'done') return 'badge-done';
    return '';
  };

  return (
    <div 
      className={`mascot ${safeState} ${className}`}
      data-agent-id={agentId}
      data-outfit={safeOutfit}
      data-state={safeState}
      style={{ '--agent-color': accentColor }}
    >
      <img 
        src={`assets/mascots/${agentId}-${safeOutfit}.png`}
        alt={agentId}
        className="mascot-sprite"
      />
      <div className={`status-badge ${getBadgeClass()}`} />
    </div>
  );
}

export default Mascot;
