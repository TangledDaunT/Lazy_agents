#!/usr/bin/env python3
"""
Simple voice wake word + TTS response system.
Uses speech_recognition (free, offline-ish) for wake words.
Uses Piper for TTS responses.

When agent is awakened:
1. Agent says "I'm [agent], how can I help?" (1 line)
2. Listens for user query
3. Processes query and responds with max 3 lines

Install: pip install SpeechRecognition pyttsx3 piper-tts
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

# Voice mappings (simplified names)
VOICE_FILES = {
    "hermes": "hermes.onnx",
    "byte": "byte.onnx", 
    "ledger": "ledger.onnx",
    "sage": "sage.onnx",
    "compass": "compass.onnx"
}

# Agent greeting lines (max 1 line as requested)
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
    AGENTS = {}


def speak(agent_id: str, text: str):
    """Use Piper TTS to speak text in agent's voice"""
    voice_file = VOICES_DIR / VOICE_FILES.get(agent_id, "hermes.onnx")
    
    if not voice_file.exists():
        print(f"[tts] Voice file not found: {voice_file}")
        return False
    
    try:
        # Use piper command line
        cmd = [
            "piper",
            "--model", str(voice_file),
            "--output-raw",  # raw audio to speakers
        ]
        
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Send text to piper
        proc.communicate(input=text.encode())
        return proc.returncode == 0
        
    except Exception as e:
        print(f"[tts] Error: {e}")
        return False


def listen_for_wake_word():
    """
    Simple wake word detection using speech_recognition.
    In production, use Porcupine for better accuracy.
    """
    try:
        import speech_recognition as sr
        
        r = sr.Recognizer()
        mic = sr.Microphone()
        
        print("[wake] Listening for agent names...")
        
        with mic as source:
            r.adjust_for_ambient_noise(source, duration=1)
            
            while True:
                try:
                    audio = r.listen(source, timeout=5, phrase_time_limit=3)
                    text = r.recognize_google(audio).lower()
                    
                    # Check if any agent name was spoken
                    for agent_id, cfg in AGENTS.items():
                        wake_word = cfg.get("wakeWord", agent_id).lower()
                        if wake_word in text:
                            return agent_id
                            
                except sr.WaitTimeoutError:
                    pass
                except sr.UnknownValueError:
                    pass
                except sr.RequestError:
                    pass
                except Exception as e:
                    print(f"[wake] Error: {e}")
                    time.sleep(1)
                    
    except ImportError:
        print("[wake] speech_recognition not installed")
        print("[wake] pip install SpeechRecognition pyaudio")
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
                # Listen for wake word (blocking, runs in thread)
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
    print("LAZYAGENTS VOICE SYSTEM")
    print("=" * 50)
    print()
    print("Wake Words: byte, ledger, hermes, sage, compass")
    print("Response: Max 3 lines per agent")
    print()
    print("Requirements:")
    print("  pip install SpeechRecognition pyaudio")
    print("  (Piper voices already downloaded)")
    print()
    
    asyncio.run(main_loop())
