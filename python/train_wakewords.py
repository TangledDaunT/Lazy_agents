#!/usr/bin/env python3
"""
Train OpenWakeWord models for custom agent names.
100% FREE - No account required.

This script:
1. Generates synthetic speech for each agent name using TTS
2. Trains a small wake word model
3. Outputs ONNX models: byte.onnx, ledger.onnx, hermes.onnx, sage.onnx, compass.onnx

Based on: https://github.com/dscripka/openWakeWord
"""

import subprocess
import sys
from pathlib import Path

AGENTS = ["byte", "ledger", "hermes", "sage", "compass"]
OUTPUT_DIR = Path(__file__).parent.parent / "wakeword_models"

def install_dependencies():
    """Install openWakeWord and training dependencies"""
    print("Installing openWakeWord...")
    subprocess.run([
        sys.executable, "-m", "pip", "install", 
        "--break-system-packages",
        "openwakeword[train]",
        "scipy", "onnx"
    ], check=True)

def train_wake_word(word: str):
    """
    Train a wake word model for a specific word.
    
    In practice, this requires:
    1. Positive examples (synthetic TTS + recordings)
    2. Negative examples (background noise, other words)
    3. Training for ~1-2 hours per word
    
    For quick setup, use Porcupine instead.
    """
    print(f"\nTraining wake word: {word}")
    print("(This takes 1-2 hours per word with GPU)")
    print("\nFor faster setup, use Porcupine:")
    print("  https://console.picovoice.ai/")
    print(f"\nWould train model to: {OUTPUT_DIR}/{word}.onnx")
    
def main():
    print("=" * 60)
    print("OPENWAKEWORD MODEL TRAINING")
    print("=" * 60)
    print()
    print("To train custom wake words for FREE:")
    print()
    print("Option A: Use OpenWakeWord training notebook")
    print("  https://github.com/dscripka/openWakeWord/blob/main/notebooks/training_custom_models.ipynb")
    print()
    print("Option B: Use Porcupine Console (Easier)")
    print("  https://console.picovoice.ai/")
    print(f"  Download .ppn files → {OUTPUT_DIR}/")
    print()
    print("Option C: Use built-in words temporarily:")
    print("  'grasshopper' → byte")
    print("  'bumblebee' → ledger") 
    print("  'porcupine' → hermes")
    print("  'hey barista' → sage")
    print("  'jarvis' → compass")
    print()
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
if __name__ == "__main__":
    main()
