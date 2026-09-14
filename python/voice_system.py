#!/usr/bin/env python3
"""
Voice wake word + TTS response system using Porcupine.

Requirements:
- Porcupine wake word models (.ppn) in wakeword_models/
- Piper voices in ~/.local/share/piper/voices/
- Environment variable PORCUPINE_ACCESS_KEY set
"""

import asyncio
import json
import os
import subprocess
import websockets
from pathlib import Path
import threading
import time

HERE = Path(__file__).parent.parent
CONFIG_PATH = HERE / "agents_config.json"
BUS_URL = "ws://localhost:8766/bus"
VOICES_DIR = Path.home() / ".local/share/piper/voices"
WAKEWORD_DIR = HERE / "wakeword_models"

VOICE_FILES = {
    "hermes": "hermes.onnx",
    "byte": "byte.onnx",
    "ledger": "ledger.onnx",
    "sage": "sage.onnx",
    "compass": "compass.onnx"
}

AGENT_GREETINGS = {
    "hermes": "Hermes here. How may I assist?",
    "byte": "Byte ready. What needs coding?",
    "ledger": "Ledger online. Market query?",
    "sage": "Sage listening. What shall I research?",
    "compass": "Compass at your service. Ready to plan?"
}

try:
    with open(CONFIG_PATH) as f:
        AGENTS = json.load(f)
except FileNotFoundError:
    AGENTS = {k: k for k in ["byte", "ledger", "hermes", "sage", "compass"]}

def speak(agent_id: str, text: str):
    voice_file = VOICES_DIR / VOICE_FILES.get(agent_id, "hermes.onnx")
    if not voice_file.exists():
        return False
    try:
        wav_file = f"/tmp/{agent_id}_response.wav"
        subprocess.run(["piper", "--model", str(voice_file), "--output-file", wav_file], input=text.encode(), check=True)
        subprocess.run(["aplay", wav_file], check=True, capture_output=True)
        return True
    except Exception as e:
        print(f"[tts] Error: {e}")
        return False

def listen_for_wake_word():
    try:
        from pvporcupine import create
        keyword_paths = [str(WAKEWORD_DIR / f"{agent}.ppn") for agent in AGENTS.keys()]
        missing = [p for p in keyword_paths if not Path(p).exists()]
        if missing:
            print(f"[wake] Missing: {missing}")
            return None
        porcupine = create(access_key=os.getenv("PORCUPINE_ACCESS_KEY"), keyword_paths=keyword_paths)
        print("[wake] Listening...")
        while True:
            idx = porcupine.process()
            if idx >= 0: return list(AGENTS.keys())[idx]
            time.sleep(0.01)
    except Exception as e:
        print(f"[wake] Error: {e}")
        return None

async def main_loop():
    async with websockets.connect(BUS_URL) as ws:
        while True:
            loop = asyncio.get_event_loop()
            agent_id = await loop.run_in_executor(None, listen_for_wake_word)
            if agent_id:
                await ws.send(json.dumps({"type": "wake", "agent": agent_id}))
                threading.Thread(target=speak, args=(agent_id, AGENT_GREETINGS.get(agent_id, "Ready."))).start()
            await asyncio.sleep(0.1)

if __name__ == "__main__":
    asyncio.run(main_loop())
