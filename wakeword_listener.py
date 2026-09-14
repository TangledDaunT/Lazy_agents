"""
Offline, per-agent wake-word detection using openWakeWord.

IMPORTANT: openWakeWord ships generic pretrained models (hey_jarvis, alexa, etc.)
but NOT models for arbitrary custom names like "Byte" or "Ledger" out of the box.
To get wake words that match your agents' actual names you need to either:
  1. Train a custom model per name with openWakeWord's training notebook
     (https://github.com/dscripka/openWakeWord - training uses synthetic TTS
     clips + a small classifier head, doesn't need real recordings), or
  2. Use Picovoice Porcupine's web console to generate a custom .ppn wake-word
     file per name (fast, free tier available, no training needed) and swap
     the detection loop below for Porcupine's SDK instead.

This script assumes option 1 or 2 has produced a model file per agent and just
wires up the runtime loop + pushes 'wake' events to the orchestrator's /bus.

pip install openwakeword pyaudio websockets
"""
import asyncio
import json
from pathlib import Path

import numpy as np
import websockets

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "agents_config.json"
WAKEWORD_MODELS_DIR = HERE / "wakeword_models"   # one .onnx/.tflite per agent, see docstring
BUS_URL = "ws://localhost:8766/bus"

with open(CONFIG_PATH) as f:
    AGENTS = json.load(f)


async def send_wake(ws, agent_id: str):
    await ws.send(json.dumps({"type": "wake", "agent": agent_id}))


async def listen_loop():
    try:
        from openwakeword.model import Model
        import pyaudio
    except ImportError:
        print("[wakeword] openwakeword/pyaudio not installed - skipping wake-word loop.")
        print("[wakeword] pip install openwakeword pyaudio")
        return

    # Map agent_id -> path to its trained wake-word model (see module docstring)
    model_paths = {}
    for agent_id, cfg in AGENTS.items():
        candidate = WAKEWORD_MODELS_DIR / f"{cfg.get('wakeWord', agent_id)}.onnx"
        if candidate.exists():
            model_paths[agent_id] = str(candidate)

    if not model_paths:
        print(f"[wakeword] no trained models found in {WAKEWORD_MODELS_DIR}. "
              f"Wake-word detection is disabled until you add them (see docstring).")
        return

    oww = Model(wakeword_models=list(model_paths.values()))
    label_to_agent = {Path(p).stem: a for a, p in model_paths.items()}

    pa = pyaudio.PyAudio()
    stream = pa.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=1280)

    async with websockets.connect(BUS_URL) as ws:
        print(f"[wakeword] listening for: {list(model_paths.keys())}")
        while True:
            audio = np.frombuffer(stream.read(1280, exception_on_overflow=False), dtype=np.int16)
            predictions = oww.predict(audio)
            for label, score in predictions.items():
                if score > 0.5:
                    agent_id = label_to_agent.get(label)
                    if agent_id:
                        print(f"[wakeword] heard '{label}' -> {agent_id}")
                        await send_wake(ws, agent_id)
            await asyncio.sleep(0.01)


if __name__ == "__main__":
    asyncio.run(listen_loop())
