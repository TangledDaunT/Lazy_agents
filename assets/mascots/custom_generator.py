#!/usr/bin/env python3
"""Generate custom mascot variants with configurable colors"""

from PIL import Image, ImageDraw
import os

def create_custom_mascot(animal, primary_color, accent_color, output_path):
    """Create a custom mascot with user-defined colors"""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw head
    draw.ellipse([8, 8, 56, 56], outline=accent_color, width=2)
    
    # Eyes
    draw.rectangle([20, 24, 24, 28], fill=(255, 255, 255))
    draw.rectangle([40, 24, 44, 28], fill=(255, 255, 255))
    
    # Save
    img.resize((128, 128), Image.NEAREST).save(output_path, 'PNG')
    print(f"Created: {output_path}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 5:
        create_custom_mascot(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print("Usage: ./custom_generator.py <animal> <primary> <accent> <output.png>")
