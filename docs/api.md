# Local API

The bridge listens on `http://localhost:8766`.

- `GET /health` reports bridge and gateway metadata.
- `GET /agents` lists configured agent IDs.
- `GET /vault` lists Markdown files from the configured vault.
- `GET /context` returns shared context text.
- `POST /agents_config` persists dashboard configuration.
- WebSocket `/bus` accepts `create_run`, `cancel_run`, `get_status`, and `ping` messages.

Run events are broadcast to every connected Electron client.
