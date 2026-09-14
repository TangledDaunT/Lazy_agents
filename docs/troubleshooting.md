# Troubleshooting

**Bridge offline:** confirm Python dependencies are installed and check port `8766`.

**Gateway errors:** start Hermes Gateway and check `HERMES_GATEWAY_URL` and `HERMES_API_KEY`.

**No speech:** install Piper, download the configured voice model, and set `PIPER_BIN` / `PIPER_VOICES_DIR`.

**No wake word:** add trained models under `python/wakeword_models/`.
