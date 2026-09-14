#!/usr/bin/env python3
"""
Vosk-based wake word system for LazyAgents.
Listens for agent names and responds with TTS.

Uses Vosk for offline speech recognition.
Works with the small English model.
"""

import asyncio
import json
import os
import subprocess
import websockets
from pathlib import Path
import threading
import queue
import time

HERE = Path(__file__).parent.parent
CONFIG_PATH = HERE / "agents_config.json"
BUS_URL = "ws://localhost:8766/bus"
VOICES_DIR = Path.home() / ".local/share/piper/voices"
VOSK_MODEL_PATH = HERE / "vosk_model" / "vosk-model-small-en-us-0.15"

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

# Load agent config
try:
    with open(CONFIG_PATH) as f:
        AGENTS = json.load(f)
except FileNotFoundError:
    AGENTS = {k: k for k in ["byte", "ledger", "hermes", "sage", "compass"]}


def speak(agent_id: str, text: str):
    """Use Piper TTS to speak text in agent's voice"""
    voice_file = VOICES_DIR / VOICE_FILES.get(agent_id, "hermes.onnx")
    
    if not voice_file.exists():
        print(f"[tts] Voice file not found: {voice_file}")
        return False
    
    try:
        # Use piper command line
        wav_file = f"/tmp/{agent_id}_response.wav"
        subprocess.run([
            "piper",
            "--model", str(voice_file),
            "--output-file", wav_file
        ], input=text.encode(), check=True)
        
        # Play through speakers
        subprocess.run(["aplay", wav_file], check=True, capture_output=True)
        return True
        
    except Exception as e:
        print(f"[tts] Error: {e}")
        return False


def listen_for_wake_word():
    """
    Listen for wake words using Vosk speech recognition.
    """
    try:
        from vosk import Model, KaldiRecognizer
        import pyaudio
        
        # Load Vosk model
        if not VOSK_MODEL_PATH.exists():
            print(f"[wake] Vosk model not found at {VOSK_MODEL_PATH}")
            print("[wake] Please run setup to download the model")
            return None
        
        print("[wake] Loading Vosk model...")
        model = Model(str(VOSK_MODEL_PATH))
        recognizer = KaldiRecognizer(model, 16000)
        
        # Audio setup
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=8192
        )
        
        stream.start_stream()
        print("[wake] 🎤 Listening for agent names...")
        
        while True:
            data = stream.read(4096, exception_on_overflow=False)
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                text = result.get("text", "").lower()
                
                if text:
                    # Check for agent names
                    for agent_id in AGENTS.keys():
                        if agent_id in text:
                            print(f"[wake] Heard: {agent_id}")
                            return agent_id
                            
    except ImportError:
        print("[wake] Install Vosk dependencies: pip install vosk pyaudio")
        return None
    except Exception as e:
        print(f"[wake] Error: {e}")
        return None


async def send_wake(ws, agent_id: str):
    """Send wake event to bridge"""
    await ws.send(json.dumps({"type": "wake", "agent": agent_id}))
    print(f"[wake] Sent wake for: {agent_id}")


async def main_loop():
    """Main wake word + TTS loop"""
    print("[voice] Starting voice system...")
    print(f"[voice] Voices: {list(VOICE_FILES.keys())}")
    
    try:
        async with websockets.connect(BUS_URL) as ws:
            print("[voice] Connected to bridge")
            
            while True:
                # Listen for wake word (blocking)
                loop = asyncio.get_event_loop()
                agent_id = await loop.run_in_executor(None, listen_for_wake_word)
                
                if agent_id:
                    print(f"[voice] Heard: {agent_id}")
                    
                    # Send wake event to app
                    await send_wake(ws, agent_id)
                    
                    # Agent responds with greeting (in thread to not block)
                    greeting = AGENT_GREETINGS.get(agent_id, "I'm ready to help.")
                    threading.Thread(target=speak, args=(agent_id, greeting)).start()
                    
                await asyncio.sleep(0.1)
                
    except Exception as e:
        print(f"[voice] Error: {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("LAZYAGENTS VOICE SYSTEM (VOSK)")
    print("=" * 50)
    print()
    print("🎤 Say: byte, ledger, hermes, sage, compass")
    print("🔊 Response: 1 line greeting per agent")
    print()
    print("Requirements:")
    print("  pip install vosk pyaudio")
    print("  Vosk model downloaded (done via setup script)")
    print("  Piper voices in ~/.local/share/piper/voices/")
    print()
    
    asyncio.run(main_loop())