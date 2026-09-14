
import React, { useEffect, useRef } from 'react';

const OUTFITS = ['suit', 'casual', 'beach', 'dress', 'corporate'];
const STATES = ['idle', 'listening', 'working', 'awaiting-approval', 'done'];

export function Mascot({ agentId, accentColor = '#f5d061', outfit = 'corporate', state = 'idle', className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
        // Logic to update badge via MascotSystem global or direct state
        window.MascotSystem?.updateBadge(containerRef.current, state);
    }
  }, [state]);

  return (
    <div 
      ref={containerRef}
      className={`mascot ${state} ${className}`}
      data-agent-id={agentId}
      style={{ '--agent-color': accentColor }}
    >
      <img src={`assets/mascots/${agentId}-${outfit}.png`} alt={agentId} style={{width: '100%', height: '100%'}} />
      <div className={`status-badge ${state === 'working' ? 'badge-thinking' : state === 'awaiting-approval' ? 'badge-asking' : state === 'done' ? 'badge-done' : ''}`} />
    </div>
  );
}

export default Mascot;
