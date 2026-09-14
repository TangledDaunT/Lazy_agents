# Lazy Agents - Hermes Council Mascot System

## Mascot System

The mascot system provides pixel-art avatars for each AI agent in the Hermes Council.

### Features

- **Pixel-Art Style**: 16-bit retro aesthetic with crisp edges
- **5 Unique Characters**: Owl, Lion, Monkey, Cat, Dog
- **Status Badges**: Thinking, Asking, Done indicators
- **Council Mode**: Circular formation animation
- **5 Outfit Slots**: Switch between visual styles

### Quick Start

\`\`\`javascript
const mascot = MascotSystem.createMascot({
  agentId: 'hermes',
  accentColor: '#f5d061',
  outfit: 'corporate',
  state: 'idle'
});
document.getElementById('container').appendChild(mascot);
\`\`\`

### Assets Location

All sprites in: \`assets/mascots/\`

### Generating Custom Mascots

\`\`\`bash
./venv/bin/python assets/mascots/generate_mascots.py
\`\`\`

### See Also

- [API Examples](docs/mascot-api-examples.md)
- [Pixel Art Style Guide](docs/pixel-art-styleguide.md)
- [Verification Report](VERIFICATION.md)
