import React from 'react';

const OUTFITS = ['suit', 'casual', 'beach', 'dress', 'corporate'];
const STATES = ['idle', 'listening', 'working', 'awaiting-approval'];

/**
 * React adapter for the shared mascot SVG system. The Electron renderer uses
 * mascot.js directly; React surfaces can render this component with the same
 * agent config, accent color, outfit, and live state values.
 */
export function Mascot({ agentId, accentColor = '#f5d061', outfit = 'corporate', state = 'idle', className = '' }) {
  const safeOutfit = OUTFITS.includes(outfit) ? outfit : 'corporate';
  const safeState = STATES.includes(state) ? state : 'idle';
  return React.createElement('div', {
    className: `mascot ${safeState} ${className}`.trim(),
    'data-agent-id': agentId,
    'data-outfit': safeOutfit,
    'data-state': safeState,
    style: { '--mascot-accent': accentColor },
    dangerouslySetInnerHTML: { __html: window.MascotSystem.svgMarkup(agentId, accentColor, safeOutfit) },
  });
}

export default Mascot;
