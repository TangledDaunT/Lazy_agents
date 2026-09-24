# Voice control

Voice control starts automatically with the app and uses the global **Query**
wake word. `wakeword_listener.py` uses MLX Whisper (`whisper-tiny.en-mlx` by
default) for push-to-talk clips and publishes transcripts to the bridge
websocket. Audio is 16 kHz mono and includes a 200 ms tail after key-up.

Electron starts the vendored kev server from the checkpoint path in Settings,
health-checks `GET /v1/models`, and only then starts the Query listener. If kev
fails, the app shows a voice error in the overlay and the main event bus rather
than silently disabling the feature.

The Electron process displays the transcript in a separate transparent overlay
and invokes `python/voice_router.py`. The router sends one combined request to
the local kev server at `KEV_URL` (default `http://127.0.0.1:8009/v1/systemone`)
for route and specialist selection. If kev is unavailable, the router returns
an explicit error rather than silently choosing a potentially unsafe action.

## Training and checkpoints

The committed `voice_training_examples.jsonl` contains more than 250 labeled
examples. Run `python3 scripts/train_voice_router.py` from the repository root
to invoke the vendored `kev.train` and `kev.evaluate` commands. Generated
checkpoints and evaluation output live under `runs/kev-router/`, which is
ignored by Git. Set the checkpoint path in Settings when moving the app to a
different machine.

## System commands

Saved system commands live in the SQLite database at `VOICE_COMMAND_DB`
(default `~/.lazyagents/commands.db`). The `commands` table supports `app`,
`website`, `workflow`, and `script` targets and has an FTS5 index. The first
run seeds example Calculator and YouTube commands. Scripts are executed as a
single executable path, never through a shell. Closing a website searches
Chrome tabs by URL and closes only the matching tab.

## Desktop handoff and Accessibility

Claude and ChatGPT handoff uses `osascript` to activate the desktop app and
System Events to paste and press Return. Grant **Accessibility** permission
to the process that launches Electron (normally the signed LazyAgents app, or
the terminal/VS Code host when running `npm start`) in System Settings →
Privacy & Security → Accessibility. Without this permission, the app can copy
the text but System Events cannot type into or submit the desktop app.

## Confirmation voice

The deterministic system-command path dispatches immediately after a final
transcript; it does not wait for the overlay tick/cross controls. Query
confirmations use the local `models/en_GB-alba-medium.onnx` Piper voice by
default. The model is ignored by Git because it is a binary download. A
configured Piper model is rendered to a temporary WAV and played with
`afplay`; macOS `say` is only a fallback when the model is unavailable.
