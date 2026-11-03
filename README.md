# FICSIT Node Labs

**FICSIT Node Labs** is a 2D widescreen factory automation and logistics tycoon game for **Android (Landscape APK)** and **Web**, blending the industrial production chains, resource node purities, and conveyor belt physics of ***Satisfactory*** with a clean, tactile node-graph interface inspired by ***Upload Labs***.

![Version](https://img.shields.io/badge/version-0.0.08%20dev%20build-F59E0B?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android%20(Landscape)%20%7C%20Web-38BDF8?style=flat-square)
![Engine](https://img.shields.io/badge/engine-React%2019%20%2B%20HTML5%20Canvas%20%2B%20Capacitor%207-22C55E?style=flat-square)

---

## Core Gameplay & Mechanics

### 1. Authentic *Satisfactory* Conveyor Belt Physics & Tiers (`Mk.1` – `Mk.6`)
Unlike instant-transfer node games, resources in **FICSIT Node Labs** physically travel as tightly packed discrete items (`1.2m` / `18px` item footprint) along the length of each conveyor belt:
- **Tight Bumper-to-Bumper Resource Queue**: At 100% belt capacity (e.g., `60 items/min` on a Mk.1 belt), resource items sit tightly squeezed right next to each other (`1.2m` spacing) and march in lockstep at the belt's exact pace (`1.2 m/s` on Mk.1 up to `24 m/s` on Mk.6).
- **Distance & Transit Time Matter**: When two connected machines are far apart on the map, you watch the tightly packed train of resources travel across the belt and wait for the leading item to physically reach the destination input port before production begins (`WAITING` status + live `Transit %` readout).
- **Six Official Conveyor Belt Tiers**:

| Belt Tier | Max Capacity | Belt Speed | Unlock Tier | Primary Ingredient |
| :--- | :--- | :--- | :--- | :--- |
| **Conveyor Belt Mk.1** | **60** items/min | `1.2 m/s` | Tier 0 (HUB Upgrade 4) | Iron Plate |
| **Conveyor Belt Mk.2** | **120** items/min | `2.4 m/s` | Tier 2 (Logistics Mk.2) | Reinforced Iron Plate |
| **Conveyor Belt Mk.3** | **270** items/min | `5.4 m/s` | Tier 4 (Logistics Mk.3) | Steel Beam |
| **Conveyor Belt Mk.4** | **480** items/min | `9.6 m/s` | Tier 5 (Logistics Mk.4) | Encased Industrial Beam |
| **Conveyor Belt Mk.5** | **780** items/min | `15.6 m/s` | Tier 7 (Logistics Mk.5) | Aluminum Casing |
| **Conveyor Belt Mk.6** | **1,200** items/min | `24.0 m/s` | Tier 9 (Peak Efficiency) | Fused Modular Frame |

- **In-Place Belt Upgrades**: Select your active belt tier from the bottom-left thumb bar (`Mk.1` – `Mk.6`) before wiring, or select any machine on the canvas to upgrade its attached belts in place.

### 2. Scattered Planetary Resource Nodes & Purity Qualities
- **12,000 × 8,000 Sector 01 Map**: Features **32 natural Resource Nodes** (Iron Ore, Copper Ore, Limestone) scattered in organic geological clusters and solo outcrops across ridges, valleys, and plateaus.
- **Three Purity Modifiers**:
  - **Impure (`0.5×` — Red `#EF4444`)**: Base output of **30 items/min** with a Miner Mk.1.
  - **Normal (`1.0×` — Orange `#F97316`)**: Base output of **60 items/min** with a Miner Mk.1.
  - **Pure (`2.0×` — Green `#22C55E`)**: Base output of **120 items/min** with a Miner Mk.1 (requires **Conveyor Belt Mk.2+** to transport full output without bottlenecking).

### 3. Semantic Zoom & Google Maps-Style Camera Controls
- **Detailed Node Cards (`>= 0.25x` Zoom)**: Displays live machine efficiency, active recipe, progress bars, port rates, and official *Satisfactory* Wiki item/building icons.
- **Macro Map View (`< 0.25x` Zoom)**: Collapses player-built machines into *Upload Labs*-style Macro Icon Boxes and renders natural Resource Nodes as circular *Satisfactory* interactive map pins color-coded by purity.
- **Touch & Mouse Camera Gestures**:
  - **Drag Empty Canvas**: Pan across Sector 01.
  - **Two-Finger Pinch / Mouse Wheel**: Zoom smoothly anchored at your fingers or cursor.
  - **Double-Tap / Double-Tap & Drag**: One-handed Google Maps-style zoom for mobile play.

### 4. Native Android Game Mode & Landscape Widescreen UI
- Built for `16:9` and `20:9` widescreen landscape displays.
- Configured with `android:isGame="true"`, `android:appCategory="game"`, `android:screenOrientation="sensorLandscape"`, and **Immersive Sticky Fullscreen** so Android Game Launchers (Samsung Game Booster, Xiaomi Game Turbo, Pixel Game Dashboard) recognize the app as a game and hide the system status and navigation bars.

---

## Local Development & Testing

```bash
# Install dependencies
npm install

# Start the development server on http://localhost:3000
npm run dev

# Run the unit test suite (Conveyor belt physics, purity math, LOD thresholds, save serialization)
npx tsx --test src/game/rules.test.ts

# Build production web bundle
npm run build
```

---

## Building the Android APK (GitHub Actions & Local)

Every push to `main`/`master` (or manual workflow dispatch) runs `.github/workflows/android-release.yml`, which:
1. Builds the Vite production bundle (`npm run build`).
2. Packages the app into a native Android project using **Capacitor 7** and runs `node scripts/configure-android.mjs` to inject game manifest flags and immersive fullscreen mode.
3. Compiles the APK with Gradle (`./gradlew assembleDebug`).
4. Extracts the current version's release notes from [`CHANGELOG.md`](./CHANGELOG.md) via `node scripts/extract-release-notes.mjs` and publishes a GitHub Pre-Release (`v0.0.06-dev`) with the downloadable `ficsit-node-labs-0.0.06-dev.apk`.

---

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for the complete history of every development build (`0.0.01 dev build` – `0.0.06 dev build`).
