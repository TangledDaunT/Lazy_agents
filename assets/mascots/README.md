# Mascot System - Hermes Council

This directory contains the pixel-art mascot assets for the Hermes Council agents.

## Art Direction

All mascots use a retro pixel-art style (16-bit inspired):
- Visible pixel grid with crisp edges
- Flat color blocks with chunky outlines
- Head-and-shoulders bust framing
- Transparent background
- Anthropomorphic animal characters with outfits

## Mascot Files

### Hermes (Orchestrator) - Owl
- `hermes-corporate.png` - Corporate outfit

### Specialist Agents

1. **Byte** - Lion (suit)
   - `byte-suit.png`

2. **Ledger** - Monkey (casual denim)
   - `ledger-casual.png`

3. **Sage** - Cat (beach/Hawaiian)
   - `sage-beach.png`

4. **Compass** - Dog (dress)
   - `compass-dress.png`

## Status Badges

Small icons positioned near mascot head:

- `badge-thinking.png` - Orange blinking cursor (agent actively processing)
- `badge-asking.png` - Light bulb (needs approval/input)
- `badge-done.png` - Green checkmark (task complete)

No badge = idle state

## Council Mode

In Council Mode, all agents form a circular arrangement:
- Signal: synchronized "thinking" badges on all specialists
- Visual: glowing dashed chain connecting the circle
- Animations: smooth transition to circle positions

## Naming Convention

Files follow pattern: `{agentId}-{outfit}.png`

- agentId: hermes, byte, ledger, sage, compass
- outfit: corporate, suit, casual, beach, dress

## Integration

Loaded by `mascot.js` and `Mascot.jsx`:

```javascript
// Create mascot
const mascot = MascotSystem.createMascot({
  agentId: 'hermes',
  accentColor: '#f5d061',
  outfit: 'corporate',
  state: 'idle'
});

// Update state
MascotSystem.setState(mascot, 'working');

// Council mode
MascotSystem.enterCouncilMode();
```

## Generation Script

Run `generate_mascots.py` to regenerate all mascots:

```bash
./venv/bin/python generate_mascots.py
```
