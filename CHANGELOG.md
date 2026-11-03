# Changelog — FICSIT Node Labs

All notable changes for **FICSIT Node Labs** are documented below. Straight to the point, no fluff.

---

## [0.0.08] — 2026-11-02 (`0.0.08 dev build`)

### 🎛️ Minimal HUD & Corner Controls
- **Compact Belt Tab**: Replaced the wide belt bar with a small bottom-left button (`Mk.X`) that opens an upward flyout tab of all belt tiers (Mk.1–Mk.6).
- **Persistent Colored Toggle**: Belt button remains visible at all times, turning bright amber when its tab is shown.
- **Click-Anywhere Dismissal**: Tapping anywhere on the screen or pressing Escape immediately closes the belt tab.
- **Bottom-Right Build Button**: Moved the Build button to the bottom-right corner as a compact icon button with small "build" text underneath.

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
