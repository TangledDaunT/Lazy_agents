#!/usr/bin/env python3
"""
LazyAgents Voice System Launcher
Automatically selects the best available wake word system.
"""

import subprocess
import sys
import os

def check_porcupine():
    """Check if Porcupine is available"""
    try:
        import pvporcupine
        # Check if we have wake word models
        wake_word_dir = os.path.join(os.path.dirname(__file__), "wakeword_models")
        if os.path.exists(wake_word_dir):
            ppn_files = [f for f in os.listdir(wake_word_dir) if f.endswith('.ppn')]
            if len(ppn_files) >= 5:  # Need all 5 agent wake words
                return True
    except ImportError:
        pass
    return False

def check_vosk():
    """Check if Vosk is available"""
    try:
        import vosk
        model_path = os.path.join(os.path.dirname(__file__), "vosk_model", "vosk-model-small-en-us-0.15")
        return os.path.exists(model_path)
    except ImportError:
        return False

def check_speech_recognition():
    """Check if SpeechRecognition is available"""
    try:
        import speech_recognition
        return True
    except ImportError:
        return False

def main():
    print("🔍 Checking available voice wake word systems...")
    
    porcupine_available = check_porcupine()
    vosk_available = check_vosk()
    sr_available = check_speech_recognition()
    
    print(f"Porcupine: {'✓' if porcupine_available else '✗'}")
    print(f"Vosk: {'✓' if vosk_available else '✗'}")
    print(f"SpeechRecognition: {'✓' if sr_available else '✗'}")
    print()
    
    # Priority: Porcupine > Vosk > SpeechRecognition
    if porcupine_available:
        print("🚀 Starting Porcupine voice system...")
        subprocess.run([sys.executable, "python/voice_system.py"])
    elif vosk_available:
        print("🚀 Starting Vosk voice system...")
        subprocess.run([sys.executable, "python/voice_system_vosk.py"])
    elif sr_available:
        print("🚀 Starting SpeechRecognition voice system...")
        subprocess.run([sys.executable, "python/voice_system.py"])  # Original SR version
    else:
        print("❌ No wake word system available!")
        print()
        print("To set up voice wake words:")
        print("1. Porcupine (Recommended):")
        print("   pip install pvporcupine")
        print("   Get free access key from https://console.picovoice.ai/")
        print("   Train wake words: byte, ledger, hermes, sage, compass")
        print()
        print("2. Vosk (Offline):")
        print("   pip install vosk pyaudio")
        print("   The Vosk model is already downloaded")
        print()
        print("3. SpeechRecognition (Online):")
        print("   pip install SpeechRecognition pyaudio")
        print()
        print("After installing, run this launcher again.")

if __name__ == "__main__":
    main()