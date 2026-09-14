#!/usr/bin/env python3
"""
Build script to prepare app icons from mascot assets
"""

from PIL import Image
import os

def create_app_icon():
    """Create multi-resolution app icon from Hermes mascot"""
    mascot_dir = "/home/shreyansh/Lazy_agents/assets/mascots"
    icon_dir = "/home/shreyansh/Lazy_agents/assets/icons"
    os.makedirs(icon_dir, exist_ok=True)
    
    # Load hermes mascot as base
    source = f"{mascot_dir}/hermes-corporate.png"
    if not os.path.exists(source):
        print("Source mascot not found!")
        return
    
    img = Image.open(source).convert('RGBA')
    
    # Create larger versions for app icons
    sizes = [16, 32, 48, 64, 128, 256, 512]
    
    for size in sizes:
        icon = img.resize((size, size), Image.NEAREST)
        icon.save(f"{icon_dir}/icon-{size}x{size}.png", 'PNG')
    
    # Also save as main icon.png
    icon = img.resize((256, 256), Image.NEAREST)
    icon.save(f"{icon_dir}/icon.png", 'PNG')
    
    print(f"✓ Created icons in {icon_dir}")
    
    # Copy as main electron icon
    icon.save(f"{mascot_dir}/../icon.png", 'PNG')
    print("✓ Created assets/icon.png")

if __name__ == "__main__":
    create_app_icon()
