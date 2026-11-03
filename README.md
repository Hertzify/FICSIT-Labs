# FICSIT Labs

**FICSIT Labs** is a 2D factory automation tycoon built from the ground up for **Mobile (Landscape)** and **Web**. It translates the deep production chains, discrete item physics, and logistical scale of ***Satisfactory*** into a high-performance 2D blueprint engine designed specifically for touchscreens and low-end mobile devices.

![Version](https://img.shields.io/badge/version-0.0.16%20dev%20build-F59E0B?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Mobile%20Web%20%7C%20Desktop-38BDF8?style=flat-square)
![Engine](https://img.shields.io/badge/engine-React%20%2B%20HTML5%20Canvas-22C55E?style=flat-square)
![Offline PWA](https://img.shields.io/badge/PWA-100%25%20Offline%20Ready-A855F7?style=flat-square)

---

## 🎯 The Vision: Satisfactory in Your Pocket

Native 3D factory automation games like *Satisfactory* offer unparalleled mechanical depth, but running heavy 3D game engines on mobile devices presents severe challenges:
- **Excessive Battery Drain & Thermal Throttling**: 3D rendering quickly overheats mobile chips, throttling frame rates and draining batteries within minutes.
- **Awkward Virtual Joysticks**: Navigating 3D space, aiming conveyor poles, and micro-aligning splitters using virtual on-screen thumbsticks is imprecise and frustrating.
- **Visual Clutter on Small Screens**: 3D viewports obscure distant belt spaghetti and make spotting factory bottlenecks difficult on a 6-inch phone display.

**FICSIT Labs solves this by reimagining Satisfactory as a 2D industrial blueprint tycoon**:
Instead of compromising on game mechanics, we preserved **100% of the authentic Satisfactory logistical loop**—fixed resource deposits, purity ratings, discrete conveyor items, dual-buffer machine storages, cycle-based crafting, and real backpressure—while engineering a touch-first interface and a lightweight 2D canvas engine that runs at a locked 60 FPS on low-end hardware.

---

## 📱 Mobile-First Design & Touch Architecture

### 1. Thumb-Zone Landscape Interface
- **Ergonomic Corner Controls**: Key interactive controls are clustered within natural thumb reach in landscape mode. The **Build Menu** sits in the bottom-right corner, while the **Belt Tier Selector (Mk.1–Mk.6)** and **Snap Mode Toggle** sit in the bottom-left corner.
- **No Keyboard Dependencies**: All desktop-centric hotkeys and keyboard shortcuts have been purged. The entire game is 100% playable with touch gestures alone.

### 2. Solving the "Fat Finger" Problem: Magnetic Snap Mode & Laser Guides
Placing buildings and routing belts on a touchscreen often suffers from imprecise finger positioning. *FICSIT Labs* introduces an intelligent magnetic snapping system:
- **Proximity-Bounded Snapping (240px / ~16m)**: When dragging a machine within local reach of nearby buildings, the engine automatically calculates magnetic attraction to neighbor ports and centerlines.
- **Dynamic Laser Guidelines**:
  - **Cyan Laser Guides (`#06B6D4`)**: Appear with targeting reticles whenever ports share identical horizontal or vertical axes.
  - **Amber Laser Guides (`#F59E0B`)**: Project across the factory floor when machine centers align.
- **Uniform 24px Grid Proportions**: Standardized building heights (`144px` for single-port machines, `168px` for multi-port machines) and fixed 24px port pitches guarantee that aligned machines produce **100% straight, kink-free 2-point horizontal belts** without micro-adjustments.

### 3. Touch-Friendly Wiring: Tap-to-Wire & Drag-to-Wire
- Connecting ports supports two intuitive touch interaction patterns:
  - **Drag-to-Wire**: Touch an output port and drag a laser guideline directly into an input port.
  - **Tap-to-Wire**: Tap an output port to enter wiring mode, then tap the target input port.
- Ports feature generous 24px hit targets with color-coded status rings, making connections effortless even on high-DPI compact mobile displays.

### 4. Fluid Camera Navigation
- **Single-Finger Drag**: Pan smoothly across the expansive 12,000 × 8,000 Sector 01 map with momentum damping.
- **Two-Finger Pinch**: Seamlessly zoom from detailed machine inspection (`1.85x`) out to planetary regional overview (`0.06x`).
- **One-Finger Double-Tap & Drag**: Full zoom navigation using a single hand while on the move.

---

## ⚙️ 2D Conveyor Physics & Factory Simulation

### 1. Real Discrete Item Packets (Not Texture Scrolls)
Rather than simulating belts with repeating texture offsets, every item on a conveyor belt is a **discrete physical entity** (`inFlightItems`):
- **Calibrated Satisfactory Speeds**: Belt speeds strictly follow canonical specifications—from Mk.1 at `1.2 m/s` (`18 px/s`) up to Mk.6 at `24.0 m/s` (`360 px/s`).
- **Bumper-to-Bumper Packing**: Items maintain an authentic tight `1.2m` (`18px`) spacing when lines operate at full capacity.
- **Travel Distance Delay**: Long conveyor runs physically delay resources from reaching machines. Distant miners take real time to deliver ore to smelters.

### 2. Continuous Circular Fillet Corners & Radial Arc Rotation
Standard 2D orthogonal lines fold into ugly miter spikes or deformed squares when turning 90-degree corners. *FICSIT Labs* implements custom circular fillet arc geometry:
- **Continuous Arc Interpolation (`computeFilletedConveyorPath`)**: 90-degree bends are rounded with smooth circular fillet arcs.
- **Multi-Angle Radial Rotation (`sampleFilletedPath`)**: As thin 1.5px roller slats and periodic 1.7px forward directional chevrons (`>`) travel through corners, their tangent angles continuously rotate through infinite intermediate angles (0° → 15° → 30° → 45° → 60° → 75° → 90°).
- **Smooth Item Navigation**: In-flight item containers round corners along the arc rather than abruptly snapping across right angles.

### 3. Authentic Machine Storages & Factory Backpressure
- **Dedicated Input & Output Storage Buffers**: Every production machine maintains separate input inventory (up to 1 stack per port) and output inventory (up to 1 stack).
- **Physical Line Stalling**: If a downstream machine's input storage fills up (e.g., Smelter at 100/100 Iron Ore), arriving belt items halt bumper-to-bumper at the intake port. The conveyor belt enters `STALLED (FULL)` status, items visually queue on the belt, and upstream machines eventually pause production when their own output buffers reach capacity.

### 4. Elevated Overpass Bridges in 2D
In a 2D plane, conveyor belts inevitably intersect. Instead of disallowing crossings or forcing players into cumbersome 3D camera angles:
- The engine's geometric solver detects orthogonal crossings in real-time.
- Perpendicular crossings automatically generate **elevated steel overpass bridges** with industrial clearance pylons and caution striping, allowing multi-layered logistics without 3D camera navigation.

---

## ⚡ Performance Architecture for Low-End Mobile Devices

Mobile gaming requires strict adherence to thermal limits and frame pacing. *FICSIT Labs* uses a decoupled, cache-heavy architecture:

| Optimization Strategy | Implementation Details | Mobile Impact |
| :--- | :--- | :--- |
| **Decoupled Simulation (20 Hz)** | Factory production, item transit, and backpressure run on a fixed 20 Hz (50ms) tick, separate from the 60 FPS Canvas render loop. | Prevents CPU thermal throttling and eliminates simulation recalculations during camera pans or drags. |
| **O(1) Route & Bridge Caching** | Conveyor paths and intersection bridges are hashed by node geometry signatures. Stationary factories query routes in O(1). | Drastically reduces pathfinding overhead on multi-conveyor factories. |
| **Macro LOD Icon Boxes (<0.25x)** | Zooming out past 0.25x switches machine cards from detailed multi-bar layouts to lightweight vector icon boxes. | Slashes Canvas draw calls across massive multi-thousand-node megabases. |
| **Padded Viewport Culling** | Skips draw calls for machines, belts, and terrain outside the visible viewport (plus a 240px margin). | Guarantees consistent 60 FPS even on massive 12,000 × 8,000 maps. |
| **Battery Saver Mode** | Settings toggle that locks rendering to 1.0x device pixel ratio and disables shadow/blur passes. | Reduces GPU load and extends phone battery life on older Android devices. |

---

## 📲 Standalone Offline PWA (Progressive Web App)

*FICSIT Labs* functions as a native-grade mobile application without requiring an app store download:
- **100% Offline Gameplay**: All scripts, stylesheets, canvas assets, and official Satisfactory Wiki icons are cached locally via a custom Service Worker.
- **One-Tap Home Screen Installation**: Players can install the game directly from their mobile browser via the in-game **Install Offline Game** button.
- **Sticky Fullscreen Landscape**: Runs in borderless, immersive landscape mode (`16:9` / `20:9` aspect ratios) without browser address bars or navigation buttons interfering with gameplay.
- **Local JSON Save Management**: Automatic local storage saves with human-readable JSON clipboard import and export for backup or cross-device transfer.

---

## 📜 Full Changelog

For a complete record of updates, performance optimizations, and patch notes, check out [`CHANGELOG.md`](./CHANGELOG.md) or open the **Changelog** modal directly from the in-game Main Menu and Settings.
