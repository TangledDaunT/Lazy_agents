---
name: Hermes Council Control Room
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393e'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f24'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e8'
  on-surface-variant: '#d0c6b0'
  inverse-surface: '#e4e1e8'
  inverse-on-surface: '#303035'
  outline: '#99907d'
  outline-variant: '#4d4636'
  surface-tint: '#e7c355'
  primary: '#ffeec8'
  on-primary: '#3d2f00'
  primary-container: '#f5d061'
  on-primary-container: '#6f5800'
  inverse-primary: '#735c00'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#baffd9'
  on-tertiary: '#003824'
  tertiary-container: '#5eecaf'
  on-tertiary-container: '#006847'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe089'
  primary-fixed-dim: '#e7c355'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#131317'
  on-background: '#e4e1e8'
  surface-variant: '#353439'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: -0.006em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 19px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.06em
  code-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-compact: 0.5rem
  margin: 1rem
  margin-window: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes an ultra-precise, high-performance desktop environment modeling the native macOS Sonoma and Sequoia human interface paradigm. Engineered for an Electron shell hosting a multi-agent AI council, the visual style combines deep-space obsidian backgrounds with layered optical glassmorphism, native vibrancy filters, and sub-pixel keyline edging. 

The emotional tone balances absolute mechanical reliability with the mystique of autonomous intelligence: focused, calm, hyper-responsive, and cinematic. The aesthetic draws heavily from Apple's Pro Display XDR interfaces, native macOS system sheets, and studio audio control rooms. 

Central to the personality is the role of orchestration: the central conductor shines in radiant warm gold, flanked by distinct specialist agents differentiated through saturated luminous spectrum anchors. Ambient radial underglows simulate physical light bleeding through machined hardware apertures, while crisp typography and translucent pill overlays maintain clarity during dense real-time telemetric streaming.

## Colors

The palette operates strictly within a deep obsidian dark spectrum, prioritizing contrast ratios and glass optical transparency over saturated surface fills.

### Canvas & Surfaces
- **Canvas Base**: Pitch Obsidian `#08080C` transitioning into pure `#000000` at window bounds.
- **Surface Level 1 (Sidebars & Chrome)**: `rgba(255, 255, 255, 0.03)` with `backdrop-filter: blur(40px) saturate(180%)`.
- **Surface Level 2 (Agent Modules & Inspector Panels)**: `rgba(255, 255, 255, 0.06)` with inner top rim highlight `linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)`.
- **Surface Level 3 (Modals, Popovers & Floating Bars)**: `rgba(26, 27, 34, 0.75)` over `backdrop-filter: blur(60px)`.
- **Keyline Borders**: Standard outer boundary `rgba(255, 255, 255, 0.10)`, interactive border hover `rgba(255, 255, 255, 0.22)`.

### Agent Multi-Color Spectrum
- **Hermes (Orchestrator)**: Primary `#F5D061`, secondary amber `#E5A93C`, ambient glow `rgba(245, 208, 97, 0.15)`.
- **Forge (Code Synthesis)**: Primary `#38BDF8`, electric cyan `#00F2FE`, ambient glow `rgba(56, 189, 248, 0.15)`.
- **Ledger (Market & Quantitative Analysis)**: Primary `#10B981`, vivid mint `#34D399`, ambient glow `rgba(16, 185, 129, 0.15)`.
- **Oracle (Deep Retrieval & Synthesis)**: Primary `#8B5CF6`, electric violet `#C084FC`, ambient glow `rgba(139, 92, 246, 0.15)`.
- **Chronos (Task Planning & Execution)**: Primary `#F43F5E`, sunset rose `#FB7185`, ambient glow `rgba(244, 63, 94, 0.15)`.

### Typography Contrast
- **Text Primary**: `#F4F4F6` (Solid luminance, 98% brightness).
- **Text Secondary**: `rgba(244, 244, 246, 0.65)`.
- **Text Muted / Shortcuts**: `rgba(244, 244, 246, 0.40)`.

## Typography

The typography embodies macOS native engineering: structured, razor-sharp, and readable down to microscopic sizes. Using Inter with system optical sizing rules, font metrics mimic San Francisco with deliberate micro-tracking adaptations.

- **Numerics & Monospace Data**: When displaying token counts, latency, and memory addresses, apply `font-feature-settings: "tnum" 1, "cv05" 1`.
- **System Labels & Title Bars**: Uppercase tokens use `label-caps` with expanded tracking (`+0.06em`) to echo macOS native toolbar section headers.
- **Readability on Glass**: Never use pure black text or high opacities against frosted elements. All text retains semi-transparent white alpha channel levels to harmonize with blurred background content without color vibration.

## Layout & Spacing

The control room employs an adaptive 3-pane desktop workspace architecture structured around a high-density utility grid:

1. **Global Shell & Traffic Lights**: Top 44px chrome includes standard 78px safe inset for macOS close/minimize/zoom buttons, seamlessly integrated into unified glass topbars.
2. **Left Navigation Rail (Agent Selector)**: 64px collapsed icon rail or 240px expanded navigation panel.
3. **Primary Stage (Agent Council Arena)**: Fluid flexible canvas centering Hermes Orchestrator with an interactive peripheral radial node layout or 4-tile split pane.
4. **Context & Inspector Deck**: 320px dockable right sidebar for live context trees, memory visualizers, and tool execution logs.

### Density and Padding Rules
- Layout spacing follows a strict 4px / 8px quantum base.
- Gaps between docked glass tiles never exceed `0.75rem` (12px) to preserve a cohesive control room instrumentation cockpit rather than isolated floating cards.
- Content margins inside panes default to `space-md` (12px) or `space-lg` (16px) for data tables and chat telemetry.

## Elevation & Depth

Visual hierarchy does not rely on opaque stacking or harsh drop shadows; instead, it utilizes physical optical depth, variable glass backdrops, and simulated light sources.

### Depth Layers
1. **Level 0 (Canvas Bottom)**: Deep void `#08080C` with subtle radial gradient flares representing agent activity (e.g., gold radial bloom of `width: 600px; height: 600px; opacity: 0.12; filter: blur(80px)` behind active agent centers).
2. **Level 1 (Docked Structural Panels)**: Backdrop blur of 30px, surface fill `rgba(255, 255, 255, 0.04)`, hairline perimeter `1px solid rgba(255, 255, 255, 0.08)`.
3. **Level 2 (Active Cards & Tool Outputs)**: Backdrop blur of 40px, surface fill `rgba(255, 255, 255, 0.07)`, top specular inset `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.15)`, cast shadow `0 8px 32px -4px rgba(0, 0, 0, 0.60)`.
4. **Level 3 (Command Palette / Flyout Overlays)**: Full macOS vibrancy `rgba(18, 19, 26, 0.85)`, backdrop blur of 64px, double border `1px solid rgba(255, 255, 255, 0.16)`, deep drop shadow `0 24px 64px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)`.

### Specular Edge Lighting
All glass modules feature a simulated directional light from the window top. Implement via `border: 1px solid rgba(255, 255, 255, 0.1)` paired with an inner top gradient highlight `inset 0 1px 0 0 rgba(255, 255, 255, 0.15)`.

## Shapes

The design system standardizes on Roundedness `2` (`border-radius: 0.5rem` / 8px for standard components), directly conforming with Apple Human Interface Guidelines for macOS desktop applications.

### Curvature Hierarchies
- **Standard Controls (Buttons, Inputs, Pill Chips)**: `0.5rem` (8px).
- **Surface Panels & Content Windows (`rounded-lg`)**: `1.0rem` (16px).
- **Floating Overlays & Central Agent Hubs (`rounded-xl`)**: `1.5rem` (24px).
- **Circular Indicators & Mascot Avatars**: `rounded-full` (9999px).

To maintain the native macOS aesthetic, all corners should leverage CSS `corner-smoothing: 60%` (continuous squircles) when rendered in Chromium/WebKit environments.

## Components

### 1. Buttons & Segmented Controls
- **Primary Action (Hermes Core)**: Background `linear-gradient(180deg, #F5D061 0%, #E5A93C 100%)`, text `#08080C`, font weight `500`. Subtle outer glow `0 0 16px rgba(245, 208, 97, 0.35)`. Corner radius `8px`.
- **Secondary Action (Native Glass)**: Background `rgba(255, 255, 255, 0.08)`, border `1px solid rgba(255, 255, 255, 0.12)`, text `#F4F4F6`. Hover triggers `background: rgba(255, 255, 255, 0.12)`.
- **Segmented Control**: Native macOS inset track `rgba(0, 0, 0, 0.35)` with 8px radius. Active selection slides with an animated glass thumb (`rgba(255, 255, 255, 0.14)` with `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4)`).

### 2. Agent Identity Chips & Status Badges
- **Shape**: Compact pill (`rounded-full`), height 24px, padding `0 10px`.
- **Anatomy**: Left-aligned 6px pulsating dot indicator reflecting agent state (thinking, executing, idle, error), followed by Agent Title in `label-caps`.
- **Theming**: Dynamically assigned agent tint (Hermes: Warm Gold, Forge: Cyan, Ledger: Mint, Oracle: Violet, Chronos: Coral). Background tint `rgba(agentColor, 0.12)`, border `rgba(agentColor, 0.30)`, label `agentColor`.

### 3. Native Glass Input Fields & Omnibar
- **Height**: 36px for standard forms; 52px for the Council Omnibar (prompt bar).
- **Background**: `rgba(0, 0, 0, 0.40)` with backdrop blur 20px.
- **Border**: Default `1px solid rgba(255, 255, 255, 0.10)`. Focus shifts to `1px solid #F5D061` with subtle golden shadow `0 0 0 2px rgba(245, 208, 97, 0.20)`.
- **Adornments**: Right-aligned Cmd+K pill badge styled with `rgba(255, 255, 255, 0.08)` and subtle border.

### 4. Agent Stream Cards & Log Feeds
- **Card Body**: Frosted glass pane `rgba(255, 255, 255, 0.04)` with rounded 12px corners.
- **Header**: Flex row with playful 2D vector mascot badge (28x28px circular container), agent title, timestamp, and latency pill (`42ms`).
- **Telemetry Stream**: Code outputs and reasoning thoughts live inside embedded sub-boxes with pitch-black canvas background (`rgba(0, 0, 0, 0.65)`), border `rgba(255, 255, 255, 0.06)`, and syntax highlighted in agent spectrum colors.

### 5. Mascot Badges
- Stylized 2D minimalist vector characters representing the 5 entities, rendered in crisp monochromatic lines filled with agent accent tints. Mascots sit in 36px frosted circular discs with matching back-glows.