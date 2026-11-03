# Engine Architecture & Low-End Performance Upgrade Plan (v0.0.15)

## 1. Executive Summary (Plain-English Recommendation)

You do **not** need to switch to a heavy external 3D engine (like Unity or Three.js), nor will you ever need to rewrite the game later. 

For a 2D node-and-conveyor factory game, our **HTML5 2D Canvas + TypeScript** architecture is the exact same foundation used by hit commercial 2D factory games like *Shapez.io*. Heavy game engines use hundreds of megabytes of RAM, drain battery quickly, and struggle to render crisp text cards on budget phones. By contrast, a custom 2D Canvas engine boots in under half a second, runs on any low-end phone or PC, and can be wrapped into a standalone Android (`.apk`), iOS, or Steam desktop app at any time without rewriting a single line of game code.

To make sure this engine **never hits a wall as your factory grows** and **feels like a real installed game on low-end devices**, we will upgrade four core pillars of the engine right now.

---

## 2. Planned Engine Upgrades

### A. Decoupled Fixed-Timestep Game Loop (Smooth 60 FPS Panning + Lightweight 20 Hz Factory Math)
- **Current Issue**: `NodeCanvas.tsx` currently uses a `28ms` `setTimeout` loop that caps frame rate at ~35 FPS and runs the entire factory simulation (`stepSimulation`) on every single visual frame—and even re-runs `stepSimulation` on every pixel of finger movement while dragging a building.
- **Upgrade**:
  - Separate **Visual Rendering** (`requestAnimationFrame` for silky-smooth camera panning, pinch-zooming, and conveyor belt motion) from **Factory Simulation Ticks** (a fixed `20 Hz` / `50ms` accumulator tick for buffer math, rates, and item spawning, with smooth visual interpolation between ticks).
  - Stop running full simulation passes during `pointermove` when dragging a building—only update the dragged building's coordinates and cached belt routes.

### B. `O(1)` Graph Indexing & Early-Exit Simulation Solver (`src/game/simulation.ts`)
- **Current Issue**: `stepSimulation` currently runs up to `N` passes (where `N` is the number of buildings) and uses `.find()` and `.filter()` across the connections array inside nested loops (`O(N³)` complexity). On a low-end phone, a 100-building factory would run ~1,000,000 array checks per second.
- **Upgrade**:
  - Pre-index incoming and outgoing connections per port (`Map<string, ConveyorConnection>`) and per node (`Map<string, ConveyorConnection[]>`) once at the start of each tick so every lookup is instant (`O(1)`).
  - Add **early-exit convergence detection**: as soon as flow rates stop changing between passes (typically in 2–4 passes instead of `N` passes), the solver finishes immediately.
  - Reuse item packet objects in-place during belt transit instead of cloning every packet object on every frame, dramatically reducing garbage collection pauses on budget phones.

### C. Cached Conveyor Overpass Crossings & Low-End Performance Mode (`src/components/canvasRenderer.ts` & `src/game/types.ts`)
- **Current Issue**: Every single frame, `renderFactoryScene` recalculates `findConveyorCrossings` across all belts (`O(B²)`), even when no belts or buildings have moved. High-DPI mobile screens also force 2x pixel rendering even on budget GPUs.
- **Upgrade**:
  - Cache conveyor crossings against a lightweight geometry signature so overpass bridges are only recomputed when a building moves or a belt is added/removed (`O(1)` during normal play).
  - Add a **Performance / Low-End Device Mode** setting (`performanceMode: 'auto' | 'high' | 'battery_saver'`):
    - Lowers canvas pixel density to `1.0x` DPR on budget devices to cut GPU fill-rate load by 75%.
    - Automatically simplifies belt item shadows and sub-pixel strokes when zoomed out or when many items are on screen.

### D. Installable Offline Native-Feel Game Shell (PWA + Fullscreen Toggle)
- **Current Issue**: The game runs inside a standard browser tab without offline caching, compliant home-screen icons, or a one-tap Fullscreen / Install button.
- **Upgrade**:
  - Integrate `vite-plugin-pwa` in `vite.config.ts` with automatic service worker precaching and runtime caching for all game scripts, styles, fonts, and Satisfactory Wiki building/item icons so the game works **100% offline**.
  - Generate compliant `192x192`, `512x512`, maskable, and `apple-touch-icon.png` icons in `public/` and update the Web App Manifest (`display: 'fullscreen'`, `orientation: 'landscape'`).
  - Add an **Install Game App** button (with automatic detection and iOS instructions) and a **Fullscreen Mode** toggle directly in the Main Menu and Settings modal.

---

## 3. Files to Create or Modify

- `package.json` & `vite.config.ts`: Add `vite-plugin-pwa` and configure service worker precaching + runtime asset caching.
- `public/icon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon.png`: Compliant home-screen and launcher icons.
- `index.html`: Add iOS/Android standalone meta tags and apple-touch-icon links.
- `src/game/types.ts` & `src/game/storage.ts`: Add `performanceMode` setting (`'high' | 'battery_saver'`) and persist it in settings.
- `src/game/simulation.ts`: Implement `O(1)` connection lookup maps, early-exit flow convergence, and low-allocation packet updates.
- `src/components/canvasRenderer.ts`: Cache conveyor crossings by geometry signature and apply `battery_saver` rendering optimizations.
- `src/components/NodeCanvas.tsx`: Upgrade the game loop to decoupled `requestAnimationFrame` + fixed-timestep simulation accumulator, and respect `performanceMode` DPR scaling.
- `src/components/usePWAInstall.ts`: Hook for native app installation (`beforeinstallprompt`), standalone detection, and fullscreen toggling.
- `src/components/MainMenu.tsx` & `src/components/SettingsModal.tsx`: Add one-tap **Fullscreen** toggle, **Install App** button, and **Low-End / Battery Saver Mode** toggle.
- `src/game/version.ts`, `src/game/changelogData.ts`, `src/game/rules.test.ts`: Bump version to `0.0.15` and verify all unit tests pass.
