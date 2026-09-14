import React from 'react';

interface MascotProps {
  agentId: string;
  accentColor?: string;
  outfit?: 'suit' | 'casual' | 'beach' | 'dress' | 'corporate';
  state?: 'idle' | 'listening' | 'working' | 'awaiting-approval' | 'done';
  className?: string;
}

export function Mascot({ 
  agentId, 
  accentColor = '#f5d061', 
  outfit = 'corporate', 
  state = 'idle', 
  className = '' 
}: MascotProps): JSX.Element {
  const getBadgeClass = (): string => {
    switch (state) {
      case 'working': return 'badge-thinking';
      case 'awaiting-approval': return 'badge-asking';
      case 'done': return 'badge-done';
      default: return '';
    }
  };

  return (
    <div 
      className={`mascot ${state} ${className}`}
      data-agent-id={agentId}
      style={{ '--agent-color': accentColor } as React.CSSProperties}
    >
      <img 
        src={`assets/mascots/${agentId}-${outfit}.png`}
        alt={agentId}
        className="mascot-sprite"
      />
      <div className={`status-badge ${getBadgeClass()}`} />
    </div>
  );
}

export default Mascot;
