#!/usr/bin/env python3
"""Verify PIL/Pillow installation for mascot generation"""

import sys

try:
    from PIL import Image, ImageDraw
    print("✓ PIL/Pillow installed correctly")
    
    # Test basic functionality
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 20, 20], fill=(255, 0, 0))
    print("✓ Image creation working")
    
    # Check version
    print(f"  Pillow version: {Image.__version__}")
    sys.exit(0)
    
except ImportError as e:
    print("✗ PIL/Pillow not installed")
    print("  Install with: pip install pillow")
    sys.exit(1)
