# Changelog — FICSIT Labs

All notable changes for **FICSIT Labs** are documented below. Straight to the point, no fluff.

---

## [0.0.17] — 2026-11-04 (`0.0.17 dev build`)

### 🛠️ Satisfactory Mobile Control Bar & 90° Corner Dot Routing
- **Satisfactory Mobile Control Bar (Edit, Move, Multi-Select, Corner Dot, Undo/Redo)**: Added a touch-first Satisfactory-styled top control toolbar with Edit, Safe-Move (camera pan without accidental edits), Multi-Select marquee box, Conveyor 90° Corner Dot tool, and Undo/Redo history.
- **2-State Perpendicular Corner DP Solver (Zero 180° Spikes or Overlaps)**: Upgraded conveyor corner-dot routing with a two-state dynamic programming solver (`H -> V` vs `V -> H` at each corner dot) that strictly guarantees 90° orthogonal corners, eliminates 180° fold-back spikes, and routes cleanly around buildings and planetary resource deposit rims.
- **Corner Dot Dismantling & Unified No-Overlap Enforcement**: Added one-tap corner dot dismantling in the Corner Dot tool plus a floating `CORNER #N` Dismantle bar in Edit mode, while preventing buildings, belts, and corner dots from ever overlapping.

### ⚡ Engine Optimization & Modular Architecture
- **Spatial Obstacle Culling & O(1) Deposit-Miner Indexing**: Added local bounding-box obstacle culling during orthogonal conveyor pathfinding and pre-indexed Miner-Deposit pairs in `O(N)` in both the 20 Hz simulation tick and 60 FPS canvas renderer.
- **Modular Canvas Artwork & Hit-Testing Architecture**: Extracted canvas vector/deposit artwork and spatial hit-testing into dedicated modules and synchronized selection state across Undo/Redo.

---

## [0.0.16] — 2026-11-03 (`0.0.16 dev build`)

### 🏔️ Option A: Planetary Resource Deposits as Ground Features
- **Natural Geological Rock Outcrops**: Replaced artificial machine card boxes for resource deposits with natural terrain mineral outcrops featuring craggy bedrock contours, fissures, and authentic 3D crystalline ore clusters (metallic hematite for Iron, amber/orange crystals for Copper, and blocky calcite mineral stone for Limestone).
- **Central Miner Mk.1 Mounting Collar**: Embedded an industrial heavy steel mounting collar and anchor ring (`⚓ MINER MK.1 MOUNT`) at the center of each resource deposit with active lock detection (`● MINER MK.1 LOCKED`) when an extractor is mounted.
- **Zero-Port Ground Feature Rule**: Resource deposits have 0 conveyor ports (`inputPortCount: 0, outputPortCount: 0`). Conveyor belts cannot be connected directly to bare terrain; players build a Miner Mk.1 on top of the deposit to extract ore.
- **FICSIT Geological Survey Hologram Beacon**: Added sleek survey beacons projecting purity and extraction rate readouts (`[ PURE · 120/min ]`, `[ NORMAL · 60/min ]`, `[ IMPURE · 30/min ]`).

### ⛏️ Option C: Miner Mk.1 Single Output Storage & Deposit Clamping
- **Direct Deposit Clamping**: Updated collision and magnetic snap solver to permit Miner Mk.1 to be built directly on top of resource deposits, while strictly preventing non-miner buildings or duplicate miners on the same deposit.
- **Single Output Capacity (No Input Buffer)**: Miner Mk.1 has 0 input ports (`inputPortCount: 0`) and 1 output port. Removed the redundant input buffer and `IN` bar from the machine card and inspector; miners now display a single 100-ore output storage bar (`STORAGE: Iron Ore 0 / 100`).
- **Direct Geological Extraction**: The miner extracts solid ore directly into its single output inventory according to the underlying deposit's purity (30, 60, or 120 items/min).
- **Refined Conveyor Belts**: Removed all lightning arrow overlays and chevrons from conveyor lines, rendering clean, uniform 1.4px roller slats that smoothly rotate across continuous radial corner arcs.
- **Starter Factory Layout**: Positioned `starter_miner` directly clamped onto `starter_deposit`, feeding the Smelter → Constructor → HUB line with 3 straight, perfectly aligned belts.

---

## [0.0.15] — 2026-11-03 (`0.0.15 dev build`)

### 🚀 Future-Proof 2D Engine & Low-End Device Performance
- **Decoupled 20 Hz Fixed-Timestep Simulation Loop**: Separated smooth 60 FPS camera/visual rendering from a fixed 20 Hz (50ms) factory simulation tick and removed per-pixel simulation steps while dragging machines.
- **O(1) Connection Indexing & Early-Exit Solver**: Indexed port/node connections via O(1) lookup maps and added convergence detection so settled factories finish flow calculation in 2 passes instead of N passes.
- **Cached Overpass Crossings & Low-End Battery Saver Mode**: Cached conveyor intersection checks by geometry signature and added a Low-End / Battery Saver mode in Settings that renders at 1.0x resolution and skips shadow passes.

### 📲 Standalone Offline Game Shell (PWA & Fullscreen)
- **Offline Installable Game & Asset Caching**: Configured service worker caching for all game scripts, UI, and Satisfactory icons so FICSIT Labs can be installed to the home screen and played 100% offline.
- **One-Tap Fullscreen & Install Controls**: Added Fullscreen toggle and Install Offline Game buttons directly in the Main Menu and Settings.

---

## [0.0.14] — 2026-11-03 (`0.0.14 dev build`)

### 🛠️ Blueprint Grid Rendering & Camera Viewport Fix
- **Fixed Horizontal Major Grid Line Cutoff**: Resolved a coordinate bug in `canvasRenderer.ts` where horizontal major grid lines terminated at `endWorldY` instead of `endWorldX`, causing grid lines to shift and disappear while panning or zooming.
- **True Camera Viewport Grid Bounds**: Aligned blueprint grid line endpoints directly with the visible camera viewport bounds while preserving the `0.42x` minor and `0.14x` major grid zoom thresholds.

---

## [0.0.13] — 2026-11-03 (`0.0.13 dev build`)

### 🗂️ Modular Architecture & Code Organization
- **Engine Domain Split (`geometry`, `snap`, `world`, `simulation`)**: Split `rules.ts` into focused domain modules for orthogonal geometry/pathfinding, bounded Snap Mode alignment, world deposits/save serialization, and factory tick simulation.
- **Canvas Renderer & Inspector Separation**: Extracted the 2D HTML5 Canvas drawing pipeline into `canvasRenderer.ts` and the floating machine/deposit inspector UI into a memoized `NodeInspectorPanel.tsx` component.
- **Dead & Duplicate Code Removal**: Removed unused legacy belt visual helpers, consolidated duplicate meter/pixel constants into `catalog.ts`, and simplified global pointer event listeners.

### ⚡ Safe Runtime Performance Optimizations
- **Geometry-Keyed Conveyor Belt Path Caching**: Cached obstacle-avoiding orthogonal belt paths and lengths by node geometry signature so stationary factories reuse precalculated routes across simulation and rendering passes.
- **Smart Inspector State Diffing**: Eliminated 35 FPS React DOM re-render thrashing when a machine is selected by updating the inspector snapshot only when visible item counts, flow rates, or statuses change.
- **Padded Camera Viewport Frustum Culling**: Skipped off-screen canvas draw calls for distant deposits, machines, and conveyor belts outside the active camera viewport plus a 240px safety margin.

---

## [0.0.12] — 2026-11-03 (`0.0.12 dev build`)

### 🧲 Bounded Local Snap Mode Proximity
- **240px (16m) Local Snap Range Limit**: Bounded Snap Mode and laser alignment guidelines to a tight 240px (~16m) edge-to-edge proximity around neighboring buildings, preventing buildings from snapping across the map.
- **Local Connected Port Snapping**: Connected conveyor belts only trigger magnetic port snapping and amber guidelines when the two buildings are within local proximity.

### 📦 Satisfactory Internal Building Storage & Stack Limits
- **Canonical Item Stack Sizes (100 / 200 / 500)**: Implemented official Satisfactory stack limits (`100/stack` for Ores, Ingots, Reinforced Plates, and Rotors; `200/stack` for Plates, Rods, and Cable; `500/stack` for Wire, Concrete, and Screws).
- **1-Stack Machine Input & Output Buffers**: Miners, Smelters, Constructors, and Assemblers buffer up to 1 full stack per input port and 1 full stack in their output slot, entering `BACKED UP` standby when output capacity reaches 100%.
- **24-Slot Storage Container & HUB Capacity**: Storage Containers and The HUB store up to 24 full item stacks (`2,400–12,000` parts) and automatically discharge buffered items onto connected output belts.
- **Dual Storage Capacity & Crafting Bars on Cards**: Machine cards display both a Storage Capacity Bar (`0%–100%` with exact `Stored / Max` item count) and the Crafting Cycle Progress Bar, plus individual Input/Output slot bars in the Inspector.

---

## [0.0.11] — 2026-11-03 (`0.0.11 dev build`)

### 🧲 Satisfactory-Style Snap Mode & Visual Alignment Guidelines
- **Port & Centerline Magnetic Snapping**: Moving or placing buildings now magnetically snaps to connected ports, nearby compatible ports, and building centerlines within an 18px attraction radius.
- **Dynamic Laser Guidelines**:
  - **Port-to-Port Alignment**: Live cyan dashed laser guides (`#06b6d4`) with circular reticles appear when ports share identical horizontal or vertical axes.
  - **Center Axis Alignment**: Amber dashed laser guides (`#f59e0b`) project across the factory floor when machine centers align.
- **Dedicated Touch Snap HUD Toggle**: Added a bottom-left `Snap: ON / OFF` button next to the belt selector, allowing instant one-tap toggling of magnetic alignment without opening sub-menus. Also toggleable in the Settings modal.

### 📐 Standardized Grid-Aligned Machine & Port Heights
- **Uniform 24px Grid Proportions**:
  - **Single-Port Buildings** (*Miner Mk.1, Smelter, Constructor, Storage Container, Resource Deposits*): Standardized to `144px` height (`6 × 24px` grid units) with port Y offset fixed at exactly `+96px`.
  - **Multi-Port Buildings** (*Assembler, Splitter, Merger*): Standardized to `168px` height (`7 × 24px` grid units) with ports spaced on uniform `24px` grid increments (`+72px`, `+96px`, `+120px`).
- **100% Straight Horizontal Belts**: Horizontally aligned machines connect with clean, 2-point straight conveyor lines with zero stair-stepping, unnecessary kinks, or detour jogs.

### 📊 Belt HUD & In-Transit Telemetry Polish
- **Always-Visible Overlay**: Belt telemetry badges and in-transit progress indicators now render at a high z-index overlay above all machine cards, preventing badges from disappearing or clipping underneath closely placed nodes.
- **Persistent Drag Telemetry**: Fixed an issue where the in-transit HUD flickered or failed to appear while actively dragging or repositioning nodes.
- **Upright Item Icons**: Conveyor item icons remain strictly upright and unrotated at all times, preventing resources from tilting 90 degrees on vertical belts.

### 🔄 Close-Node Conveyor Routing & Speed Consistency
- **Eliminated Spurious Detour Loops**: Fixed conveyor pathfinding bug where vertically aligned nodes in close proximity generated giant upward loop arcs.
- **Physical Transit Speed Integrity**: Guaranteed that conveyor transfer rates and travel delay physics remain strictly enforced even on tight, close-quarters vertical connections.
- **Envelope Clearance**: Belts maintain a clean 26px perimeter buffer around obstacle nodes without clipping card edges.

### 📱 Pure Mobile-First Controls & Desktop Keyboard Purge
- **Zero Keyboard Hints**: Stripped all desktop shortcut badges (`[Esc]`, `[Q]`) from the UI header, modals, and buttons.
- **Removed Keyboard Event Listeners**: Purged desktop `keydown` handlers (`Escape`, `Q`, `Delete`, `1-4`) from the runtime to ensure a pure touch-first experience tailored for mobile gaming.

### 🏷️ Game Rebranding & Map Collision Fixes
- **FICSIT Labs Rebrand**: Official project name, UI header emblem, and application metadata updated to **FICSIT Labs**.
- **Starter Map Adjustment**: Shifted starter copper deposit `world_dep_copper_normal_st1` to `x: 4560` to eliminate overlap with the Starter HUB.

---

## [0.0.10] — 2026-11-02 (`0.0.10 dev build`)

### 📐 90° Orthogonal Belts & Overpass Bridges
- **No Curved Belts**: Removed curved Bézier conveyor lines; all belts now route using clean, 90-degree orthogonal industrial circuits.
- **Elevated Overpass Bridges**: Belts can cross over other belts; perpendicular conveyor crossings now render elevated steel bridge platforms with clearance pylons and caution markings.

### 🚫 Strict No-Overlap Physics
- **No Machine Overlap**: Buildings can no longer be placed on top of each other. Attempting to drop an existing building in collision reverts it immediately to its previous position with an error chime.
- **Belts Cannot Go Over Nodes**: Conveyor paths automatically route around obstacle machines with clearance. Buildings cannot be placed directly across active conveyor lines.
- **Hologram Collision Warning**: Build menu ghost preview turns red and displays `NO OVERLAP` when hovering over another machine or conveyor line.

### 📦 Android In-Place Updates & Keystore
- **Permanent Signing Keystore**: Bound a permanent cryptographic key (`signing/app-release.keystore`) across all automated builds so Android allows in-place updates without uninstalling.
- **Auto-Incremented Version Code**: Automated Android `versionCode` computation from `package.json` to prevent package conflicts on newer Android versions.

---

## [0.0.09] — 2026-11-02 (`0.0.09 dev build`)

### 🎛️ Minimal HUD & Corner Controls
- **Compact Belt Tab**: Replaced wide belt bar with a small bottom-left button (`Mk.X`) that opens an upward flyout tab of all belt tiers (Mk.1–Mk.6).
- **Persistent Colored Toggle**: Belt button remains visible at all times, turning bright amber when its tab is shown.
- **Click-Anywhere Dismissal**: Tapping anywhere on the screen or pressing Escape immediately closes the belt tab.
- **Bottom-Right Build Button**: Moved the Build button to the bottom-right corner as a compact icon button with small "build" text underneath.

---

## [0.0.08] — 2026-11-02 (`0.0.08 dev build`)

### ⚡ Conveyor Belt Polish & Badges
- **Belt Icon on Badges**: Belt telemetry now displays the conveyor belt tier icon instead of the resource icon.
- **Cleaner Telemetry Text**: Removed the `m/s` speed and removed the `/m` suffix. Badges now read cleanly: `[Belt Icon] Mk.2 · 60/120`.
- **No Belt Dots on Far Zoom**: Removed the large blue/white dots when zoomed out far. Belts stay clean and uncluttered at macro zoom.

### 🧹 Removed
- **Removed Blade Runners**: Completely removed unused pioneer movement speeds (`bladeRunnersKmh`, `speedKmh`) from definitions, UI menus, and tests.

### 📖 In-Game Patch Notes
- **In-App Changelog**: Added instant access to changelogs directly from the Main Menu and Settings.

---

## [0.0.07] — 2026-11-02 (`0.0.07 dev build`)

### 🔄 Satisfactory Conveyor Belts
- **Tight Item Queues**: Items are packed tightly bumper-to-bumper (`1.2m` / `18px` spacing) on belts running at capacity, matching *Satisfactory*.
- **Accurate Belt Speeds**: Calibrated belt movement to official speeds (Mk.1 @ 1.2 m/s up to Mk.6 @ 24.0 m/s).
- **Industrial Roller Belts**: 16px wide industrial roller tracks with animated slats synchronized to belt speed.
- **Elevated Telemetry**: Belt badges float above the track with a leader line so items are never obscured.

---

## [0.0.06] — 2026-11-02 (`0.0.06 dev build`)

### ⚡ Logistics & Travel Delay
- **6 Conveyor Belt Tiers (Mk.1 – Mk.6)**: Capacities of 60, 120, 270, 480, 780, and 1,200 items/min.
- **Physical Transit Time**: Connected nodes far apart require resources to travel the physical distance before machines start producing.
- **Transit Telemetry**: Badges show live transit progress (e.g. `Mk.1 · Transit 45%`) until the first item reaches the destination.
- **Quick-Switch Belt Bar**: Mobile thumb bar in the bottom-left corner to quickly switch active belt tiers while wiring.
- **In-Place Upgrades**: Upgrade or downgrade existing belts directly inside the machine inspector.

---

## [0.0.05] — 2026-11-02 (`0.0.05 dev build`)

### 🗺️ World & Map Expansion
- **12,000 × 8,000 Sector 01 Map**: Expanded playable area with topography contours and desert oasis landmarks.
- **32 Scattered Resource Nodes**: Iron, Copper, and Limestone deposits placed in organic geological clusters.
- **Purity Color Codes**: Green for Pure (`120/m`), Orange for Normal (`60/m`), and Red for Impure (`30/m`).
- **0.25x Macro Zoom**: Machines and nodes stay detailed until zooming past `0.25x`.
- **Smooth Flow Animation**: Item motion adapts seamlessly down to single-digit rates (`1/m` to `9/m`).

---

## [0.0.04] — 2026-11-02 (`0.0.04 dev build`)

### ⛏️ Natural Resource Deposits
- **Fixed Planetary Nodes**: Replaced buildable deposits with fixed planetary resource nodes.
- **Official Icons**: Integrated 13 item icons and 8 building icons from the official Satisfactory Wiki.

---

## [0.0.03] — 2026-11-02 (`0.0.03 dev build`)

### 📱 Android & Performance
- **Macro Icon Boxes**: Low-overhead icon boxes when zooming out to maintain 60 FPS on large factories.
- **Android Game Mode**: Immersive sticky fullscreen in landscape mode (`16:9` / `20:9`).

---

## [0.0.02] — 2026-11-02 (`0.0.02 dev build`)

### 🔍 Camera Controls
- **Bounded Sector Map**: Clean camera boundaries preventing lost viewports.
- **Touch & Mouse Zoom**: Pinch-to-zoom, mouse wheel zoom, and double-tap-and-drag one-finger zoom.

---

## [0.0.01] — 2026-11-02 (`0.0.01 dev build`)

### 🚀 Initial Foundation
- **Core Engine**: HTML5 Canvas factory node graph at 60 FPS.
- **Management**: Build menu (`[Q]`), save/load system with JSON clipboard export/import, and settings modal.
