# Changelog — FICSIT Labs

Short, straight to the point.

---

## [0.0.1] — 2026-11-06 (`0.0.1 Initial Release`)

- **Initial Open Source Release**: Clean initial public release licensed under the GNU General Public License v3.0 (GPLv3).
- **Satisfactory Factory Loop**: Natural resource deposits with purity modifiers, Miner Mk.1, Smelter, Constructor, Assembler, Logistics, and Conveyor Belts Mk.1–Mk.6.
- **Authentic Machine GUI**: Real Satisfactory top & lower machine plates, 1%–250% manual overclocking, Power Shard slots, 45-slot Pioneer Inventory, and interactive Standby switches.
- **2D Conveyor Physics**: Discrete item simulation with backpressure, tight 1.2m item spacing, filleted 90° corners, and automated overpass crossings.
- **Continuous Camera & Controls**: Smooth panning and zooming from `0.06x` to `1.85x` with no edge snapping, touch pinch/double-tap, and keyboard shortcuts.
- **Offline PWA & Saves**: Local storage persistence, auto-saving, and JSON save export/import.

---

## [0.0.21] — 2026-11-06 (`0.0.21 dev build`)

- **Authentic Satisfactory Machine UI**: Replaced custom inspector plates with real Satisfactory UI plates (`miner_top_bay_clean.png`, `processor_top_bay_clean.png`, `machine_lower_bay_clean.png`) with live values.
- **Miner Node Icon**: Replaced the top-left ribbed drum on the Miner Mk.1 canvas card with the themed Miner Mk.1 build menu icon.
- **Manual Clock Speed & Rate Inputs**: Type exact clock speed (`%`) or target items/min directly into the overclock fields; removed clock speed SFX.
- **Manual Power Shards Only**: Increasing clock speed clamps to the unlocked limit (`100%` / `150%` / `200%` / `250%`) without auto-inserting Power Shards.
- **Satisfactory Inventory Fixes**: Fixed slot box styling, blocked mobile browser auto-dark inversion, and matched the stepped Sort icon and solid tapered Trash Can icon.
- **Cleanup & Optimization**: Deleted unused assets/dead code, preloaded game icons, skipped redundant per-tick belt sorting, and added `Delete`/`Backspace` keyboard dismantling.

---

## [0.0.20] — 2026-11-06 (`0.0.20 dev build`)

- **Official Game Icons**: Added official Power Shard, Somersloop, Power Bolt, Stopwatch, and Efficiency Bar icons.
- **Standby Rocker Switch**: Added symmetrical `I / O` illuminated Standby switch inside the inspector and on exterior Miner cards.
- **Rate Display Toggle**: Added `60 per minute` (default) vs `60/m` (compact) setting.
- **Storage Persistence**: Preserved all machine input/output buffers across saves and reloads.
- **Removed In-Game Changelog**: Kept patch notes strictly in `CHANGELOG.md` for GitHub.

---

## [0.0.19] — 2026-11-05 (`0.0.19 dev build`)

- **Clickable Exterior Standby Switch**: Toggle Miner Mk.1 Standby directly from the canvas node.
- **Real-Time Buffer Auto-Save**: Continuous `localStorage` sync for input/output buffers.

---

## [0.0.18] — 2026-11-05 (`0.0.18 dev build`)

- **Machine Inspector & Pioneer Inventory**: Added two-column Satisfactory Machine GUI and 45-slot Pioneer Inventory.
- **250% Overclocking**: Added 3 Power Shard slots (`150%` / `200%` / `250%`) and exponential MW power scaling.
- **Rolling Efficiency**: Stabilized machine efficiency display across discrete crafting cycles.

---

## [0.0.17] — 2026-11-04 (`0.0.17 dev build`)

- **Top Control Bar**: Added Edit, Move, Multi-Select, 90° Corner Dot, and Undo/Redo tools.
- **90° Corner Dot Router**: Added obstacle-avoiding orthogonal belt routing through user-placed corner dots.

---

## [0.0.16] — 2026-11-03 (`0.0.16 dev build`)

- **Natural Resource Deposits**: Turned ore deposits into ground outcrops that require a mounted Miner Mk.1.
- **Miner Single Output Buffer**: Removed input ports from Miner Mk.1; extracts directly into a 100-item output buffer.

---

## [0.0.15] — 2026-11-03 (`0.0.15 dev build`)

- **20 Hz Simulation Engine**: Decoupled 20 Hz simulation ticks from 60 FPS canvas rendering and added Battery Saver mode.
- **Offline PWA Support**: Added offline asset caching and fullscreen toggle.
