# Version 13 (`0.0.13 dev build`) — Codebase Cleanup, Modularization & Mobile Performance Plan

## 1. Plain-English Overview & Engineering Decisions

Based on your feedback, I evaluated all options—including keeping the files as-is—and selected the safest, highest-benefit approach that **guarantees zero changes to gameplay or save files** while making the game noticeably smoother on mobile devices.

### Option Comparison: File Organization
1. **Option A — Keep Files As-Is (No File Split):**
   * *Pros:* Zero file movement.
   * *Cons:* `NodeCanvas.tsx` (2,545 lines) and `rules.ts` (2,075 lines) remain very large, making future updates slower and harder to maintain.
2. **Option B — Extreme Micro-Splitting (20+ tiny files):**
   * *Pros:* Very small individual files.
   * *Cons:* High risk of circular dependency bugs and harder to follow how game rules work together.
3. **Option C — Safe Domain Split with Compatibility Re-Exports (Selected Best Choice):**
   * We split the two huge files into **6 clear, self-contained modules** by responsibility, while keeping `src/game/rules.ts` as an automatic pass-through index (`export *`).
   * **Why this is best:** Every existing import and test continues to work without breaking, and each file shrinks to a clean, readable size (300–700 lines).

---

## 2. Planned Architecture & File Split

### A. Game Engine (`src/game/`)
* **`src/game/catalog.ts`** — Single source of truth for all building specs, recipes, stack sizes, and physical conveyor constants (`PIXELS_PER_METER`, `BELT_ITEM_LENGTH_METERS`, `BELT_ITEM_FOOTPRINT_PX`).
* **`src/game/geometry.ts` (New)** — World bounds clamping, grid snapping, port coordinates (`getPortWorldPosition`), AABB collision checks (`doNodesOverlap`, `isNodePositionValid`), orthogonal belt pathfinder (`computeOrthogonalConveyorPath`), belt length & sampling, and overpass bridge crossings (`findConveyorCrossings`).
* **`src/game/snap.ts` (New)** — Bounded 240px (16m) Snap Mode alignment solver (`computeNodeSnapAlignment`, `getBoxEdgeGap`) and laser guideline builders.
* **`src/game/world.ts` (New)** — Natural planetary resource deposits (`WORLD_RESOURCE_DEPOSITS`), starter factory creation (`createStarterFactory`), node/belt constructors, storage helpers, and save import/export (`serializeSaveExport`, `parseSaveImport`).
* **`src/game/simulation.ts` (New)** — Tick-by-tick factory production, internal storage buffers, splitter/merger routing, and physical conveyor item movement (`stepSimulation`).
* **`src/game/rules.ts` (Refactored to Barrel Index)** — Re-exports all public functions and constants from `geometry.ts`, `snap.ts`, `world.ts`, and `simulation.ts` so all callers and tests remain 100% compatible.

### B. Canvas & UI Components (`src/components/`)
* **`src/components/canvasRenderer.ts` (New)** — Pure 2D HTML5 Canvas drawing functions (`drawScene`, belt roller animation, item icons in transit, macro zoom pins, detailed machine cards, floating HUD badges, and laser snap lines).
* **`src/components/NodeInspectorPanel.tsx` (New)** — Selected machine/deposit floating inspector card (recipe selector, internal storage bars, flush button, connected belt upgrade buttons, move & dismantle actions).
* **`src/components/NodeCanvas.tsx` (Streamlined)** — Multi-touch/pointer gesture handlers (pan, pinch-to-zoom, double-tap zoom, drag-to-wire), `requestAnimationFrame` simulation loop, and placement/wiring banners.

---

## 3. Bug-Safe Runtime Optimizations (And How We Prevent Side Effects)

All three performance optimizations will be included with built-in safety guards to prevent visual glitches or stale state:

1. **Geometry-Keyed Conveyor Belt Path Caching**
   * *What it fixes:* Currently, the obstacle-avoiding belt pathfinder runs **twice per frame for every belt** (~70 times/sec per belt) even when no buildings are moving.
   * *Trade-off & Bug Prevention:* A naive cache could leave a belt path outdated if a building moves. To prevent this, the cache is keyed by a live layout revision stamp that automatically invalidates the instant any building is moved, added, resized, or deleted. When buildings are stationary, belt paths and lengths are reused at near-zero CPU cost.
2. **Padded Camera Viewport Culling (`240px` Safety Margin)**
   * *What it fixes:* Skips drawing machine cards and resource deposits that are off-screen across the `12,000 × 8,000` world map.
   * *Trade-off & Bug Prevention:* Culling right at the screen edge can cause cards or shadows to pop in visibly while panning. We use a generous `240px` world-space buffer around the camera viewport so nodes are already drawn before they enter the screen, and conveyor belts remain drawn whenever their bounding box intersects the padded view.
3. **Smart Inspector React State Diffing**
   * *What it fixes:* Selecting a building currently triggers `setSelectedNodeSnapshot` on every animation frame (35 times/sec), forcing React to re-render the UI continuously even when numbers haven't changed.
   * *Trade-off & Bug Prevention:* A time delay could make buttons feel sluggish. Instead of a timer, we compare the visible inspector fields (status, recipe, integer storage counts, actual rates, and 2% progress increments) and only re-render React when a visible value changes—while user actions (upgrading belts, changing recipes, flushing storage) update on the exact same tap.

---

## 4. Dead & Duplicated Code Removal

* **Delete unused `computeConveyorBeltFlowVisuals` & `BELT_ITEM_SLOT_PX`:** Left over from an early prototype before physical `1.2m` (`18px`) belt items were introduced; never called anywhere in the game.
* **Deduplicate Belt Constants:** Remove duplicate `PIXELS_PER_METER`, `BELT_ITEM_LENGTH_METERS`, and `BELT_ITEM_FOOTPRINT_PX` definitions in `rules.ts` and import them from `catalog.ts`.
* **Remove Redundant Wrapper:** Replace `getPortWorldCoords` in `NodeCanvas.tsx` with direct use of `getPortWorldPosition`.
* **Clean Up Global Listeners in `App.tsx`:** Replace the 4 redundant window listeners (`pointerdown`, `mousedown`, `touchstart`, `click`) for closing the belt selector with a single clean `pointerdown` listener.

---

## 5. Version Bump & Verification (`0.0.13 dev build`)

* Bump version to `0.0.13` (`0.0.13 dev build`) in `package.json`, `src/game/version.ts`, and `src/game/changelogData.ts`.
* Run the full automated test suite (`npm test`), TypeScript typecheck, and production build (`npm run build`) to verify zero regressions.
