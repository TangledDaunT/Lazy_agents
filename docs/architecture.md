# Architecture

LAZY AGENTS is an Electron shell with a browser renderer and a Python FastAPI bridge.

- `main.js` owns windows, subprocesses, IPC, and the bridge WebSocket.
- `renderer.js` owns the arena, activity feed, output panel, and user commands.
- `python/hermes_bridge.py` translates local WebSocket commands to Hermes Runs API calls and SSE events.
- `agents_config.json` is the shared agent registry.

The bridge is intentionally separate from the Electron process so the gateway can be replaced or remote-hosted.
