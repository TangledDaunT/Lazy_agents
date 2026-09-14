# LAZY AGENTS

LAZY AGENTS is an Electron desktop control room for a Hermes multi-agent council. The main window follows the Stitch `Hermes Council macOS UI` design: an obsidian workspace, live agent arena, activity feed, shared context, vault inspector, and command dock.

## Project map

## What's here
- `main.js` / `preload.js` - Electron shell (black canvas, Instagram webview, Obsidian panel, dashboard window)
- `index.html` / `style.css` / `renderer.js` - the Stitch-inspired control room UI, agent arena, activity feed, response panel, and command dock
- `python/orchestrator.py` - the brain: talks to Nemotron Super, runs agent handoff, Piper TTS, shared-context sync file, vault listing
- `python/wakeword_listener.py` - offline wake-word loop (openWakeWord), one model per agent name
- `python/hermes_bridge.py` - bridges Electron to Hermes Agent via Runs API (SSE streaming, websocket broadcast)
- `agents_config.json` - names, wake words, Piper voice files, skins (editable live from the in-app Dashboard)
- `stitch_hermes_council_macos_ui/` - downloaded Stitch screen references, source HTML, and design-system notes

## Run locally

## Setup
```bash
npm install
pip install fastapi uvicorn openai websockets ws openwakeword pyaudio

# Piper: download the binary + voice models you want per agent
# https://github.com/rhasspy/piper -> place .onnx files in python/voices/

export NEMOTRON_BASE_URL="https://integrate.api.nvidia.com/v1"
export NEMOTRON_API_KEY="..."
export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
export PIPER_BIN="/path/to/piper"
export PIPER_VOICES_DIR="./python/voices"

npm start
```

The Electron process starts `python/hermes_bridge.py` automatically on port `8766`, then connects to the local Hermes gateway. The app can open without a gateway, but sending a message requires the gateway to be running.

## Runtime workflow

1. Start a Hermes gateway, normally with `hermes gateway run`.
2. Export `HERMES_GATEWAY_URL` if the gateway is not at `http://localhost:8642`.
3. Start the app with `npm start`.
4. Choose an individual specialist or `AI Council`, enter a prompt, and press Enter or `SEND`.
5. Watch agent state changes, streamed output, shared context, and vault data in the workspace.

The Electron main process owns the WebSocket lifecycle. It reports `ONLINE` / `OFFLINE` state to the renderer, avoids sending to destroyed windows, and suppresses reconnects during shutdown.

## Using Hermes Bridge (Runs API)

The `hermes_bridge.py` provides an alternative backend that connects to the Hermes Agent gateway API for more advanced agent features:

```bash
# Install dependencies
pip install fastapi uvicorn httpx websockets

# Start Hermes gateway (separate terminal)
hermes gateway run

# Start the bridge (defaults to port 8766)
export HERMES_GATEWAY_URL=http://localhost:8642
python python/hermes_bridge.py

# Or use Tailscale URL for remote access
export HERMES_GATEWAY_URL=http://your-tailscale-host:8642
```

The bridge exposes:
- **WebSocket `/bus`** - Main endpoint for Electron to send/receive messages
- **GET `/health`** - Health check and connection status
- **GET `/agents`** - List available agents
- **GET `/vault`** - List Markdown files from `OBSIDIAN_VAULT_PATH`
- **GET `/context`** - Read the shared context document
- **POST `/agents_config`** - Save dashboard edits
- **GET `/`** - API info and documentation

Message types supported:
- `create_run` - Create a new Hermes run with prompt
- `cancel_run` - Cancel a running run
- `get_status` - Get run status
- `user_message` - Legacy compatibility (same as orchestrator.py)
- `ping` - Health check

The bridge uses `agent` as the WebSocket field for specialist routing and translates Hermes SSE events into renderer events such as `agent_working`, `agent_idle`, `run_completed`, and `run_error`.


## What's real vs. stubbed right now
- **Real and working**: Electron shell, Stitch-inspired dark control room, selectable agent arena, live activity feed, streamed response panel, connection status, council chain animation, agent handoff via the Runs API, shared context endpoint, vault endpoint, Instagram webview, and dashboard editing for names/wake words/voices/skins.
- **Needs your input to finish**:
  1. **Wake-word models** - openWakeWord doesn't ship models for custom names like "Byte" or "Ledger". You need to either train one per name (openWakeWord's notebook, synthetic-TTS based, no real recordings needed) or switch to Picovoice Porcupine's console which generates custom `.ppn` files in minutes. Drop the resulting models in `python/wakeword_models/`.
  2. **Piper voice files** - download 5 distinct `.onnx` voice models from Piper's voice list and map them in `agents_config.json`.
  3. **Mascot art** - current mascots are a placeholder circle+body SVG tinted by skin color. You said you'll design the actual vector art yourself; swap `MASCOT_SVG` in `renderer.js` for your real SVGs, and extend the skin logic to swap full outfit layers instead of just a tint.
  4. **Instagram reels** - the `<webview>` loads instagram.com directly; Instagram may prompt login and doesn't offer an embeddable "just reels" mode, so expect to handle login/session persistence (the `partition="persist:ig"` keeps you logged in between runs).
  5. **"Needs approval" trigger** - wire up whatever condition in your agent logic should call `agent_needs_approval` (e.g. before an agent executes a risky tool call) - right now nothing triggers that state yet, the animation just exists.
