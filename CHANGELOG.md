# Changelog — FICSIT Node Labs

All notable changes and development builds for **FICSIT Node Labs** are documented in this file.
Every update increments the build number by `+0.0001`.

---

## [0.0.08] — 2026-11-02 (`0.0.08 dev build`)

### Removed
- **Removed Unused Pioneer Movement Fields (`bladeRunnersKmh`, `speedKmh`)**:
  - Removed irrelevant first-person pioneer movement fields from `ConveyorBeltTierDef`, `CONVEYOR_BELT_TIERS`, the Logistics Build Menu inspector, unit tests, and documentation, keeping only the conveyor belt item transport properties (`capacityPerMin`, `speedMetersPerSec`, `speedPxPerSec`, and `1.2m` tight item spacing).

---

## [0.0.07] — 2026-11-02 (`0.0.07 dev build`)

### Changed
- **Tight Bumper-to-Bumper Conveyor Belt Item Packing (`1.2m` / `18px` Item Footprint)**:
  - Matched *Satisfactory*'s physical item spacing where every item occupies `1.2 meters` (`18 world px` at `15 px/m`) along the belt.
  - On a belt running at 100% capacity (e.g., `60 items/min` on a **Mk.1** belt or `120 items/min` on a **Mk.2** belt), actual resource items (`15.5×15.5 px` crates with official *Satisfactory* Wiki item icons) are tightly squeezed bumper-to-bumper (`18 px` center-to-center) in a continuous marching queue.
  - Enforced physical front-to-back collision spacing (`BELT_ITEM_FOOTPRINT_PX = 18`) so items on a belt never overlap and form a tight queue.
- **Conveyor Belt Movement Pace (`1.2 m/s` – `24.0 m/s`)**:
  - Calibrated all 6 Conveyor Belt tiers to their *Satisfactory* item transport speeds:
    - **Mk.1 (`60/m`)**: `1.2 m/s` (`18 px/s`)
    - **Mk.2 (`120/m`)**: `2.4 m/s` (`36 px/s`)
    - **Mk.3 (`270/m`)**: `5.4 m/s` (`81 px/s`)
    - **Mk.4 (`480/m`)**: `9.6 m/s` (`144 px/s`)
    - **Mk.5 (`780/m`)**: `15.6 m/s` (`234 px/s`)
    - **Mk.6 (`1,200/m`)**: `24.0 m/s` (`360 px/s`)
- **Unobstructed Industrial Roller Belt Rendering**:
  - Upgraded conveyor belts to a `16 px` wide industrial roller track with animated roller slats synchronized to the belt's `m/s` speed.
  - Moved the belt telemetry pill (`Mk.1 · 60/60/m · 1.2m/s`) above the belt with a vertical leader line so the tightly squeezed resource items marching along the belt are 100% visible end-to-end.

---

## [0.0.06] — 2026-11-02 (`0.0.06 dev build`)

### Added
- **Satisfactory Conveyor Belt Tiers (Mk.1 – Mk.6)**:
  - **Conveyor Belt Mk.1**: `60 items/min` max capacity (`96 px/s` physical travel speed).
  - **Conveyor Belt Mk.2**: `120 items/min` max capacity (`192 px/s` physical travel speed — 2× faster).
  - **Conveyor Belt Mk.3**: `270 items/min` max capacity (`432 px/s` physical travel speed).
  - **Conveyor Belt Mk.4**: `480 items/min` max capacity (`768 px/s` physical travel speed).
  - **Conveyor Belt Mk.5**: `780 items/min` max capacity (`1,248 px/s` physical travel speed).
  - **Conveyor Belt Mk.6**: `1,200 items/min` max capacity (`1,920 px/s` physical travel speed).
- **Physical Resource Travel & Distance Delay on Conveyor Belts**:
  - Replaced instantaneous *Upload Labs*-style rate transfer with discrete `BeltItemPacket` physical simulation (`inFlightItems`, `lengthPx`, `travelTimeSec`).
  - When two connected nodes are far apart, discrete resource packets spawn at the output port (`distancePx = 0`) and physically travel along the belt path at `speedPxPerSec`.
  - Destination machines display **`WAITING`** (`#38BDF8`) and `0/m` input until the leading resource packet physically reaches the destination input port (`distancePx >= lengthPx`).
  - Belt midpoint badges display live transit progress (`Mk.1 · Transit 45%`) while resources are traveling and switch to capacity readouts (`Mk.1 · 60/60/m`, `Mk.2 · 120/120/m`) upon arrival.
- **Conveyor Belt Tier Selector & In-Place Belt Upgrades**:
  - Added a quick-equip **Conveyor Belt Tier bar (`Mk.1` – `Mk.6`)** in the bottom-left Android thumb zone with official Satisfactory Wiki Conveyor Belt icons (`conveyor_belt_mk1.png` – `conveyor_belt_mk6.png`).
  - Added Conveyor Belt Mk.1 – Mk.6 cards and technical specs to the **Logistics** tab in the Build Menu (`[Q]`).
  - Added one-tap **Connected Belt Tier Upgrade** buttons inside the Node Inspector popover to upgrade or downgrade existing belts attached to any machine.
- **Documentation & Automated Release Notes**:
  - Added comprehensive `README.md` and `CHANGELOG.md`.
  - Added `scripts/extract-release-notes.mjs` and updated `.github/workflows/android-release.yml` so GitHub Releases automatically publish full version changelogs and APK installation instructions.

---

## [0.0.05] — 2026-11-02 (`0.0.05 dev build`)

### Changed
- **Expanded Sector 01 Map (`12000 × 8000`) & Clustered Resource Nodes**:
  - Expanded the playable Sector 01 map from `3840 × 2160` to **`12000 × 8000`** with topographic ridge contours and desert oasis landmarks.
  - Scattered **32 natural Resource Nodes** in organic geological clusters and solo outcrops modeled after the *Satisfactory* Rocky Desert map.
  - Updated Purity color coding and zoomed-out circular map pins to match the *Satisfactory* interactive map (**Green `#22C55E` for Pure `120/m`**, **Orange `#F97316` for Normal `60/m`**, **Red `#EF4444` for Impure `30/m`**).
- **`0.25x` Macro Zoom Threshold**:
  - Lowered `LOD_ICON_BOX_ZOOM_THRESHOLD` to `0.25` (with `MIN_ZOOM = 0.06`) so full node cards stay visible until zooming out past `0.25x`.
- **Single-Digit Adaptive Belt Flow**:
  - Removed the minimum speed floor clamp so single-digit flow rates (`1/m` through `9/m`) scale strictly linearly.

---

## [0.0.04] — 2026-11-02 (`0.0.04 dev build`)

### Added
- **Natural Pre-Spawned Resource Deposits with Purity Tiers**:
  - Replaced buildable resource deposits with fixed planetary Resource Nodes (`Impure 0.5× = 30/m`, `Normal 1.0× = 60/m`, `Pure 2.0× = 120/m`).
  - Bundled 13 official *Satisfactory* Wiki resource/part icons (`public/icons/items/`) and 8 building icons (`public/icons/buildings/`).
- **Fixed Android Gradle Build**:
  - Extracted Android manifest & immersive fullscreen configuration into `scripts/configure-android.mjs` to prevent YAML newline escaping issues in `MainActivity.java`.

---

## [0.0.03] — 2026-11-02 (`0.0.03 dev build`)

### Added
- **Zoomed-Out Macro Icon Boxes**:
  - Added Level-of-Detail (LOD) rendering when zoomed out so nodes collapse into clean icon boxes instead of tiny unreadable text.
- **Widescreen Android Landscape Optimization & Native Game Mode**:
  - Redesigned Main Menu, Build Menu, Settings, and Save/Load modals for `16:9` / `20:9` landscape viewports (`844×390`).
  - Configured `android:isGame="true"`, `android:appCategory="game"`, `sensorLandscape`, and Android Immersive Sticky Fullscreen so mobile Game Launchers detect the app as a game and hide the system status/navigation bars.
  - Fixed canvas buffer clear flickering when selecting nodes.

---

## [0.0.02] — 2026-11-02 (`0.0.02 dev build`)

### Changed
- **Bounded Sector Map & Google Maps-Style Zooming**:
  - Replaced the infinite canvas with a bounded Sector 01 map (`clampCameraToWorld`, `clampNodeToWorld`).
  - Added focal-point pinch-to-zoom, double-tap-and-drag one-finger zoom, and cursor-anchored wheel zoom.
  - Removed the floating Center button and fixed `@tailwindcss/vite` dependency pinning (`4.3.3`) in CI.

---

## [0.0.01] — 2026-11-02 (`0.0.01 dev build`)

### Added
- **Initial Foundation Release**:
  - 60 FPS HTML5 Canvas factory node graph (`NodeCanvas`), *Satisfactory*-inspired Main Menu, Build Menu (`[Q]`), Save/Load manager with JSON clipboard import/export, and Settings modal.
  - Automated GitHub Actions Android APK build and pre-release workflow (`.github/workflows/android-release.yml`).
