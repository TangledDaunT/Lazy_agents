
#!/usr/bin/env python3
"""Generate retro pixel-art mascot sprites for Hermes Council agents - 16-bit style"""

from PIL import Image, ImageDraw
import os

def create_pixel_mascot(animal, outfit_color, accent_color, output_path):
    """Create a proper pixel-art mascot in retro 16-bit style"""
    # 32x32 pixel art, then upscale to 128x128 for crisp pixels
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Color palettes for each animal
    palettes = {
        'lion': {
            'fur': (218, 165, 32),
            'mane': (184, 134, 11),
            'nose': (139, 90, 43),
        },
        'monkey': {
            'fur': (160, 120, 80),
            'face': (200, 160, 120),
            'ears': (139, 90, 43),
        },
        'cat': {
            'fur': (192, 192, 192),
            'stripes': (100, 100, 100),
            'nose': (255, 182, 193),
        },
        'dog': {
            'fur': (180, 140, 100),
            'spots': (255, 255, 255),
            'nose': (60, 60, 60),
        },
        'owl': {
            'feathers': (139, 119, 101),
            'face': (245, 222, 179),
            'eyes': (255, 200, 0),
        }
    }
    
    colors = palettes.get(animal, palettes['cat'])
    
    # Draw pixel-art head (centered 16x16 area with chunky pixels)
    # Using 2x2 blocks for authentic pixel-art feel
    
    # Head outline - 2px thick border
    head_pixels = [
        # Top border
        *[x for x in range(8, 24)],
        # Bottom border  
        *[x for x in range(8, 24)],
    ]
    
    # Draw head fill (simplified pixel art head shape)
    for y in range(6, 26):
        width = min(y - 6, 26 - y) + 8
        for x in range(16 - width, 16 + width):
            if 0 <= x < 32 and 0 <= y < 32:
                draw.point((x, y), fill=colors.get('fur', colors.get('feathers', (200, 200, 200))))
    
    # Draw simple face features
    # Eyes - 2x2 pixels
    draw.rectangle([10, 12, 12, 14], fill=(255, 255, 255))
    draw.rectangle([11, 13, 11, 13], fill=(0, 0, 0))  # Pupil
    
    draw.rectangle([18, 12, 20, 14], fill=(255, 255, 255))
    draw.rectangle([19, 13, 19, 13], fill=(0, 0, 0))  # Pupil
    
    # Draw outfit shoulders/outfit hint at bottom
    for x in range(6, 26):
        for y in range(26, 32):
            draw.point((x, y), fill=outfit_color)
    
    # Draw accent glow (intentionally subtle)
    # Just outline the head with accent color
    for y in range(4, 28):
        x1, x2 = 16 - min(y - 4, 28 - y) - 7, 16 + min(y - 4, 28 - y) + 7
        if 0 <= x1 < 32:
            draw.point((x1, y), fill=(*accent_color, 180))
        if 0 <= x2 < 32:
            draw.point((x2, y), fill=(*accent_color, 180))
    
    # Upscale to 128x128 for crisp pixel rendering
    img_large = img.resize((128, 128), Image.NEAREST)
    img_large.save(output_path, 'PNG')
    print(f"✓ Created: {os.path.basename(output_path)}")

def create_badge(badge_type, output_path):
    """Create status badge icon"""
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    if badge_type == 'thinking':
        # Blinking cursor
        draw.rectangle([6, 2, 10, 14], fill=(245, 208, 97))
    elif badge_type == 'asking':
        # Light bulb
        draw.ellipse([2, 0, 14, 12], fill=(255, 255, 150))
        draw.rectangle([6, 12, 10, 16], fill=(180, 180, 180))
    elif badge_type == 'done':
        # Checkmark
        draw.line([(2, 8), (6, 12), (14, 4)], fill=(111, 251, 190), width=2)
    
    # Upscale
    img_large = img.resize((32, 32), Image.NEAREST)
    img_large.save(output_path, 'PNG')
    print(f"✓ Badge: {os.path.basename(output_path)}")

def main():
    mascot_dir = "/home/shreyansh/.hermes/workspace/Lazy_agents/assets/mascots"
    
    # Outfit colors
    outfits = {
        'suit': (40, 45, 50),
        'casual': (70, 100, 140),
        'beach': (255, 140, 0),
        'dress': (255, 150, 180),
        'corporate': (50, 50, 60)
    }
    
    # Accent colors per agent
    accents = {
        'hermes': (245, 208, 97),
        'byte': (111, 251, 190),
        'ledger': (100, 149, 237),
        'sage': (255, 182, 193),
        'compass': (255, 215, 0)
    }
    
    # Generate all mascots
    create_pixel_mascot('owl', outfits['corporate'], accents['hermes'], f"{mascot_dir}/hermes-corporate.png")
    create_pixel_mascot('lion', outfits['suit'], accents['byte'], f"{mascot_dir}/byte-suit.png")
    create_pixel_mascot('monkey', outfits['casual'], accents['ledger'], f"{mascot_dir}/ledger-casual.png")
    create_pixel_mascot('cat', outfits['beach'], accents['sage'], f"{mascot_dir}/sage-beach.png")
    create_pixel_mascot('dog', outfits['dress'], accents['compass'], f"{mascot_dir}/compass-dress.png")
    
    # Generate badges
    create_badge('thinking', f"{mascot_dir}/badge-thinking.png")
    create_badge('asking', f"{mascot_dir}/badge-asking.png")
    create_badge('done', f"{mascot_dir}/badge-done.png")

if __name__ == "__main__":
    main()
