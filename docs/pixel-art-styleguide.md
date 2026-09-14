# Pixel Art Style Guide

## Color Palette

All mascots use a limited 16-bit color palette inspired by classic console games.

### Animal Fur Colors
- **Lion**: `#DAA520` (Goldenrod)
- **Monkey**: `#A05A2B` (Sienna Brown)  
- **Cat**: `#C0C0C0` (Silver)
- **Dog**: `#B4523D` (Sienna)
- **Owl**: `#8B7765` (Brown)

### Outfit Colors
- **Suit**: `#282D33` (Dark charcoal)
- **Casual**: `#46648A` (Denim blue)
- **Beach**: `#FF8C00` (Orange)
- **Dress**: `#FF96B4` (Pink)
- **Corporate**: `#32323C` (Professional gray)

### Accent Colors (Glow)
- **Hermes**: `#F5D061` (Gold)
- **Byte**: `#6FFBBE` (Mint green)
- **Ledger**: `#6495ED` (Cornflower blue)
- **Sage**: `#FFB6C1` (Light pink)
- **Compass**: `#FFD700` (Gold)

## Pixel Art Guidelines

1. **Resolution**: 32x32 base sprite, scaled to 128x128 for display
2. **Outlines**: 2px thick chunky lines
3. **Dithering**: None - use flat color blocks
4. **Anti-aliasing**: None - crisp edges
5. **Animation frame rate**: 8 FPS for authentic feel

## Rendering

Always use:
```css
image-rendering: pixelated;
image-rendering: crisp-edges;
```
