#!/usr/bin/env python3
"""
Simple wake word system using speech recognition.
Works immediately with no training required.

When you say an agent name:
1. Agent lights up in the app
2. Agent responds with voice greeting (1 line max)
3. Listens for your query
"""

import asyncio
import json
import subprocess
import websockets
from pathlib import Path
import threading
import queue
import time

CONFIG_PATH = Path(__file__).parent.parent / "agents_config.json"
BUS_URL = "ws://localhost:8766/bus"
VOICES_DIR = Path.home() / ".local/share/piper/voices"

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
    "sage": "Sage listening. What to research?",
    "compass": "Compass at your service. Ready to plan?"
}

# Load config
try:
    with open(CONFIG_PATH) as f:
        config = json.load(f)
        AGENTS = {k.lower(): k for k in config.keys()}
except FileNotFoundError:
    AGENTS = {k: k for k in ["byte", "ledger", "hermes", "sage", "compass"]}


def speak(agent_id: str, text: str):
    """Play TTS audio through speakers"""
    voice_file = VOICES_DIR / VOICE_FILES.get(agent_id, "hermes.onnx")
    
    if not voice_file.exists():
        print(f"[tts] Voice not found: {voice_file}")
        return False
    
    try:
        # Generate WAV
        wav_file = f"/tmp/{agent_id}_response.wav"
        subprocess.run(
            ["piper", "--model", str(voice_file), "--output-file", wav_file],
            input=text.encode(),
            check=True
        )
        
        # Play through speakers
        subprocess.run(["aplay", wav_file], check=True, capture_output=True)
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"[tts] Error: {e}")
        return False


def listen_thread(audio_queue: queue.Queue):
    """Background thread for continuous listening"""
    try:
        import speech_recognition as sr
        
        r = sr.Recognizer()
        mic = sr.Microphone()
        
        print("[wake] 🎤 Listening... (Say agent name)")
        
        with mic as source:
            r.adjust_for_ambient_noise(source, duration=1)
            
            while True:
                try:
                    audio = r.listen(source, timeout=3, phrase_time_limit=2)
                    text = r.recognize_google(audio).lower()
                    
                    # Check for agent names
                    for name_lower, name_proper in AGENTS.items():
                        if name_lower in text:
                            audio_queue.put(name_proper)
                            break
                            
                except sr.WaitTimeoutError:
                    pass
                except sr.UnknownValueError:
                    pass
                except Exception as e:
                    print(f"[wake] Listen error: {e}")
                    time.sleep(1)
                    
    except ImportError:
        print("[wake] Install: pip install SpeechRecognition pyaudio")
    except Exception as e:
        print(f"[wake] Thread error: {e}")


async def main():
    print("=" * 60)
    print("LAZYAGENTS VOICE SYSTEM")
    print("=" * 60)
    print()
    print("🎤 Say: byte, ledger, hermes, sage, compass")
    print("🔊 Response: 1 line greeting per agent")
    print()
    
    audio_queue = queue.Queue()
    
    # Start listening thread
    listener = threading.Thread(
        target=listen_thread,
        args=(audio_queue,),
        daemon=True
    )
    listener.start()
    
    try:
        async with websockets.connect(BUS_URL) as ws:
            print("[voice] ✅ Connected to bridge\n")
            
            while True:
                # Check for wake word
                try:
                    agent_id = audio_queue.get_nowait()
                    
                    print(f"[voice] Heard: {agent_id}")
                    
                    # Send wake event to app
                    await ws.send(json.dumps({
                        "type": "wake",
                        "agent": agent_id
                    }))
                    
                    # Speak greeting (don't block main loop)
                    greeting = AGENT_GREETINGS.get(agent_id, f"{agent_id} ready.")
                    threading.Thread(
                        target=speak,
                        args=(agent_id, greeting)
                    ).start()
                    
                except queue.Empty:
                    pass
                    
                await asyncio.sleep(0.1)
                
    except Exception as e:
        print(f"[voice] Connection error: {e}")
        print("\nMake sure hermes_bridge is running:")
        print("  python3 python/hermes_bridge.py")


if __name__ == "__main__":
    asyncio.run(main())
