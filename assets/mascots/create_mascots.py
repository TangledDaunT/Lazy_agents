#!/usr/bin/env python3
"""
Generate pixel-art mascot sprites for LazyAgents Council
Proper 128x128 pixel art mascots matching the reference style
"""

from PIL import Image, ImageDraw
import os

def create_pixel_mascot(animal, outfit_color, accent_hex, output_path, size=128):
    """Create a retro pixel-art mascot head-and-shoulders bust"""
    
    # Convert hex accent to RGB
    accent_r = int(accent_hex[1:3], 16)
    accent_g = int(accent_hex[3:5], 16)
    accent_b = int(accent_hex[5:7], 16)
    
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factor from 64px base
    s = size // 64
    
    # Color palettes per animal
    palettes = {
        'monkey': {
            'fur': (160, 120, 80),
            'face': (210, 170, 130),
            'ears': (139, 90, 43),
            'nose': (80, 60, 40),
        },
        'lion': {
            'fur': (218, 165, 32),
            'mane': (184, 134, 11),
            'face': (240, 200, 100),
            'nose': (139, 90, 43),
        },
        'owl': {
            'feathers': (139, 119, 101),
            'face': (245, 222, 179),
            'beak': (255, 180, 0),
            'eyes': (255, 255, 100),
        },
        'cat': {
            'fur': (192, 192, 192),
            'face': (220, 220, 220),
            'ears': (180, 180, 180),
            'nose': (255, 182, 193),
        },
        'dog': {
            'fur': (180, 140, 100),
            'face': (200, 160, 120),
            'ears': (150, 110, 70),
            'nose': (60, 60, 60),
            'tongue': (255, 150, 150),
        }
    }
    
    colors = palettes.get(animal, palettes['owl'])
    
    # Draw accent glow ring (outer)
    for i in range(4*s):
        alpha = 150 - i * 30
        ring_color = (accent_r, accent_g, accent_b, alpha)
        cx, cy = size//2, size//2
        radius = size//2 - 2 - i
        draw.ellipse([cx-radius, cy-radius, cx+radius, cy+radius], outline=ring_color)
    
    # Draw head (base circle)
    head_size = size - 16*s
    head_margin = (size - head_size) // 2
    draw.ellipse([head_margin, head_margin-4*s, size-head_margin, size-head_margin-8*s], 
                 fill=colors.get('fur', colors.get('feathers', (200, 200, 200))))
    
    # Draw face (inner circle, lighter)
    face_margin = head_margin + 6*s
    draw.ellipse([face_margin, face_margin-2*s, size-face_margin, size-face_margin-6*s],
                 fill=colors.get('face', (230, 230, 230)))
    
    # Draw eyes
    eye_y = 22*s
    eye_size = 8*s
    
    # Left eye
    draw.ellipse([16*s, eye_y, 16*s+eye_size, eye_y+eye_size], fill=(255, 255, 255))
    draw.ellipse([18*s+eye_size//4, eye_y+eye_size//4, 22*s, eye_y+eye_size*3//4], fill=(40, 40, 40))
    
    # Right eye  
    draw.ellipse([size-16*s-eye_size, eye_y, size-16*s, eye_y+eye_size], fill=(255, 255, 255))
    draw.ellipse([size-22*s, eye_y+eye_size//4, size-18*s-eye_size//4, eye_y+eye_size*3//4], fill=(40, 40, 40))
    
    # Animal-specific features
    mo = size//2  # middle offset
    
    if animal == 'monkey':
        # Round ears
        draw.ellipse([4*s, 14*s, 14*s, 30*s], fill=colors['ears'])
        draw.ellipse([size-14*s, 14*s, size-4*s, 30*s], fill=colors['ears'])
        # Nose
        draw.ellipse([mo-6*s, 32*s, mo+6*s, 40*s], fill=colors['nose'])
        
    elif animal == 'lion':
        # Mane (fluffy around head)
        import math
        for angle_step in range(16):
            angle = angle_step * (math.pi / 8)
            cx, cy = size//2, size//2 - 4*s
            r = 26*s
            x = int(cx + r * math.cos(angle))
            y = int(cy + r * math.sin(angle))
            draw.ellipse([x-4*s, y-4*s, x+4*s, y+4*s], fill=colors['mane'])
        # Nose
        draw.ellipse([mo-5*s, 34*s, mo+5*s, 42*s], fill=colors['nose'])
        
    elif animal == 'owl':
        # Ear tufts (pointed)
        draw.polygon([(8*s, 10*s), (16*s, 26*s), (22*s, 14*s)], fill=colors['feathers'])
        draw.polygon([(size-8*s, 10*s), (size-16*s, 26*s), (size-22*s, 14*s)], fill=colors['feathers'])
        # Beak
        draw.polygon([(mo-4*s, 36*s), (mo+4*s, 36*s), (mo, 48*s)], fill=colors['beak'])
        # Big owl eyes
        draw.ellipse([14*s, 18*s, 30*s, 36*s], fill=colors['eyes'])
        draw.ellipse([size-30*s, 18*s, size-14*s, 36*s], fill=colors['eyes'])
        draw.ellipse([18*s, 24*s, 26*s, 32*s], fill=(40, 40, 40))
        draw.ellipse([size-26*s, 24*s, size-18*s, 32*s], fill=(40, 40, 40))
        
    elif animal == 'cat':
        # Pointed ears
        draw.polygon([(8*s, 6*s), (18*s, 24*s), (8*s, 24*s)], fill=colors['fur'])
        draw.polygon([(size-8*s, 6*s), (size-18*s, 24*s), (size-8*s, 24*s)], fill=colors['fur'])
        # Pink nose triangle
        draw.polygon([(mo-4*s, 34*s), (mo+4*s, 34*s), (mo, 40*s)], fill=colors['nose'])
        # Whiskers
        draw.line([(14*s, 36*s), (24*s, 38*s)], fill=(150, 150, 150), width=max(1, s))
        draw.line([(44*s, 38*s), (54*s, 36*s)], fill=(150, 150, 150), width=max(1, s))
        
    elif animal == 'dog':
        # Floppy ears
        draw.ellipse([2*s, 18*s, 16*s, 40*s], fill=colors['ears'])
        draw.ellipse([size-16*s, 18*s, size-2*s, 40*s], fill=colors['ears'])
        # Black nose
        draw.ellipse([mo-6*s, 34*s, mo+6*s, 44*s], fill=colors['nose'])
        # Tongue
        draw.ellipse([mo-4*s, 44*s, mo+4*s, 52*s], fill=colors['tongue'])
    
    # Draw outfit shoulders at bottom
    draw.rectangle([10*s, size-20*s, size-10*s, size], fill=outfit_color)
    
    # Collar/lapel highlight
    collar_color = tuple(min(255, c+40) for c in outfit_color)
    draw.rectangle([22*s, size-22*s, 42*s, size-14*s], fill=collar_color)
    
    # Glasses for sage (research cat)
    if animal == 'cat':
        # Glasses frame
        glass_color = (80, 80, 80)
        draw.ellipse([14*s, 20*s, 30*s, 30*s], outline=glass_color, width=max(1, 2*s))
        draw.ellipse([size-30*s, 20*s, size-14*s, 30*s], outline=glass_color, width=max(1, 2*s))
        draw.line([(30*s, 25*s), (size-30*s, 25*s)], fill=glass_color, width=max(1, s))
    
    # Main border outline with accent color
    draw.ellipse([6*s, 6*s, size-7*s, size-7*s], outline=(accent_r, accent_g, accent_b, 220), width=max(1, 3*s))
    
    img.save(output_path, 'PNG')
    print(f"✓ Created: {os.path.basename(output_path)} ({size}x{size})")


def create_badge(badge_type, output_path):
    """Create status badge icons"""
    size = 32
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    if badge_type == 'thinking':
        # Animated cursor (rectangular)
        draw.rectangle([10, 4, 22, 28], fill=(245, 208, 97), outline=(200, 170, 70))
        draw.rectangle([13, 8, 19, 24], fill=(40, 40, 40))
    elif badge_type == 'asking':
        # Light bulb
        draw.ellipse([4, 2, 28, 24], fill=(255, 215, 0), outline=(200, 170, 0))
        draw.rectangle([10, 22, 22, 26], fill=(180, 180, 180))
        draw.rectangle([8, 26, 24, 30], fill=(120, 120, 120))
        # Filament glow
        draw.arc([12, 8, 20, 18], 0, 180, fill=(255, 255, 200), width=2)
    elif badge_type == 'done':
        # Checkmark in circle
        draw.ellipse([2, 2, 30, 30], fill=(30, 50, 40), outline=(111, 251, 190))
        # Draw checkmark
        draw.line([(8, 16), (13, 22), (24, 10)], fill=(111, 251, 190), width=3)
    
    img.save(output_path, 'PNG')
    print(f"✓ Badge: {os.path.basename(output_path)}")


def main():
    mascot_dir = "/home/shreyansh/Lazy_agents/assets/mascots"
    
    # Outfit colors (dark professional colors)
    outfits = {
        'suit': (40, 45, 50),
        'casual': (70, 100, 140),
        'corporate': (50, 50, 60),
        'beach': (255, 140, 0),
        'dress': (255, 150, 180)
    }
    
    # Agent assignments with accent colors
    agents = [
        ('byte', 'monkey', 'casual', '#38bdf8'),
        ('ledger', 'lion', 'suit', '#10b981'),
        ('hermes', 'owl', 'corporate', '#f5d061'),
        ('sage', 'cat', 'corporate', '#8b5cf6'),
        ('compass', 'dog', 'suit', '#f43f5e'),
    ]
    
    print("Generating 128x128 pixel-art mascots...")
    for agent_id, animal, outfit, accent in agents:
        output_path = f"{mascot_dir}/{agent_id}-{outfit}.png"
        create_pixel_mascot(animal, outfits[outfit], accent, output_path, size=128)
    
    print("\nGenerating status badges...")
    create_badge('thinking', f"{mascot_dir}/badge-thinking.png")
    create_badge('asking', f"{mascot_dir}/badge-asking.png")
    create_badge('done', f"{mascot_dir}/badge-done.png")
    
    print("\n✓ All assets generated!")


if __name__ == "__main__":
    main()
