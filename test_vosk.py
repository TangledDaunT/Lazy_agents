#!/usr/bin/env python3
"""
Simple test for Vosk wake word detection.
Tests if we can hear and recognize basic words.
"""

import json
import os
import pyaudio
from vosk import Model, KaldiRecognizer
import time

MODEL_PATH = "vosk_model/vosk-model-small-en-us-0.15"

def test_vosk():
    print("🧪 Testing Vosk wake word detection...")
    
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Model not found at {MODEL_PATH}")
        return False
        
    print("📥 Loading model...")
    model = Model(MODEL_PATH)
    recognizer = KaldiRecognizer(model, 16000)
    
    p = pyaudio.PyAudio()
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=16000,
        input=True,
        frames_per_buffer=8192
    )
    
    stream.start_stream()
    print("🎤 Listening... Say 'byte', 'ledger', 'hermes', 'sage', or 'compass'")
    print("   (or any other word to test recognition)")
    print("   Press Ctrl+C to stop\n")
    
    try:
        while True:
            data = stream.read(4096, exception_on_overflow=False)
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                text = result.get("text", "").strip()
                if text:
                    print(f"🗣️  Heard: '{text}'")
                    
                    # Check for agent names
                    agents = ["byte", "ledger", "hermes", "sage", "compass"]
                    for agent in agents:
                        if agent in text:
                            print(f"✅ Detected agent: {agent.upper()}!")
                            return True
    except KeyboardInterrupt:
        print("\n👋 Test stopped")
        return False
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

if __name__ == "__main__":
    test_vosk()