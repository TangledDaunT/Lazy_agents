# MascotSystem API Usage Examples

## Basic Usage

### Creating a Mascot

```javascript
// Create a simple mascot
const mascotDiv = MascotSystem.createMascot({
  agentId: 'hermes',
  accentColor: '#f5d061',
  outfit: 'corporate',
  state: 'idle'
});

// Add to DOM
document.getElementById('container').appendChild(mascotDiv);
```

### Updating State

```javascript
// Get mascot reference
const mascot = MascotSystem.getMascot('hermes');

// Change state
MascotSystem.setState(mascot, 'working');  // Shows thinking badge
MascotSystem.setState(mascot, 'awaiting-approval');  // Shows asking badge
MascotSystem.setState(mascot, 'done');  // Shows done badge
MascotSystem.setState(mascot, 'idle');  // No badge
```

## Council Mode

### Activate Circle Formation

```javascript
// All agents form circle and show thinking badges
MascotSystem.enterCouncilMode();

// Later, dismiss council
MascotSystem.exitCouncilMode();
```

## React Integration

```jsx
import Mascot from './components/Mascot';

function AgentCard({ agent }) {
  return (
    <Mascot 
      agentId={agent.id}
      accentColor={agent.color}
      outfit={agent.outfit}
      state={agent.state}
    />
  );
}
```

## Outfit SySTEM

Available outfits:
- `suit` - Business formal
- `casual` - Denim casual
- `beach` - Hawaiian/beach style
- `dress` - Fashionable dress
- `corporate` - Professional corporate

## State Badges

States and their badge indicators:
- `idle` → No badge
- `working` → Orange pulsing cursor
- `awaiting-approval` → Light bulb emoji
- `done` → Green checkmark
- `listening` → (reserved for future use)
