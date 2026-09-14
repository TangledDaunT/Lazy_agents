#!/usr/bin/env python3
"""
Set up Porcupine wake word detection for LazyAgents.

This script:
1. Guides you through Porcupine wake word training
2. Helps download and organize wake word models
3. Sets up the voice system to use these wake words

Porcupine allows custom wake words with their free console:
https://console.picovoice.ai/
"""

import os
import subprocess
from pathlib import Path

AGENTS = ["byte", "ledger", "hermes", "sage", "compass"]
OUTPUT_DIR = Path(__file__).parent.parent / "wakeword_models"


def setup_porcupine():
    """
    Guide user through Porcupine wake word setup.
    """
    print("=" * 60)
    print("PORCUPINE WAKE WORD SETUP")
    print("=" * 60)
    print()
    print("To train custom wake words for FREE:")
    print("1. Go to: https://console.picovoice.ai/")
    print("2. Create FREE account")
    print("3. Navigate to 'Wake Word' section")
    print("4. Create wake words:")
    for agent in AGENTS:
        print(f"   - '{agent}' (for {agent.capitalize()} agent)")
    print("5. Download .ppn files")
    print(f"6. Save to: {OUTPUT_DIR}/")
    print()
    print("Alternative: Use built-in words temporarily:")
    print("  'grasshopper' → byte")
    print("  'bumblebee' → ledger")
    print("  'porcupine' → hermes")
    print("  'hey barista' → sage")
    print("  'jarvis' → compass")
    print()
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    print("When you're done, run: python python/voice_system.py")
    print("Then say an agent name to test!\n")
    

def main():
    setup_porcupine()
    
if __name__ == "__main__":
    main()
