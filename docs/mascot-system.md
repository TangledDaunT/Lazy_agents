# Mascot System

The mascot system is shared by the Electron renderer and React surfaces.

- `mascot.js` exposes `window.MascotSystem` for the vanilla Electron renderer.
- `components/Mascot.jsx` is the React adapter for Agent Detail and future React views.
- Every mascot uses one SVG base character with independent outfit, phone, prayer, typing, and glow groups.
- Supported outfits are `suit`, `casual`, `beach`, `dress`, and `corporate`.
- Supported states are `idle`, `listening`, `working`, and `awaiting-approval`.
- `agents_config.json` stores `defaultSkin` and `accentColor` for each agent.
- Dashboard saves broadcast `config_updated`, causing the main arena to refresh without restarting.

The animations use CSS transforms and opacity only, keeping five simultaneous mascots inexpensive to render.
