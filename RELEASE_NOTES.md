# FICSIT Labs — `0.0.17 dev build`

### 🛠️ Satisfactory Mobile Control Bar & 90° Corner Dot Routing
- **Satisfactory Mobile Control Bar (Edit, Move, Multi-Select, Corner Dot, Undo/Redo)**: Added a touch-first Satisfactory-styled top control toolbar with Edit, Safe-Move (camera pan without accidental edits), Multi-Select marquee box, Conveyor 90° Corner Dot tool, and Undo/Redo history.
- **2-State Perpendicular Corner DP Solver (Zero 180° Spikes or Overlaps)**: Upgraded conveyor corner-dot routing with a two-state dynamic programming solver (`H -> V` vs `V -> H` at each corner dot) that strictly guarantees 90° orthogonal corners, eliminates 180° fold-back spikes, and routes cleanly around buildings and planetary resource deposit rims.
- **Corner Dot Dismantling & Unified No-Overlap Enforcement**: Added one-tap corner dot dismantling in the Corner Dot tool plus a floating `CORNER #N` Dismantle bar in Edit mode, while preventing buildings, belts, and corner dots from ever overlapping.

### ⚡ Engine Optimization & Modular Architecture
- **Spatial Obstacle Culling & O(1) Deposit-Miner Indexing**: Added local bounding-box obstacle culling during orthogonal conveyor pathfinding and pre-indexed Miner-Deposit pairs in `O(N)` in both the 20 Hz simulation tick and 60 FPS canvas renderer.
- **Modular Canvas Artwork & Hit-Testing Architecture**: Extracted canvas vector/deposit artwork and spatial hit-testing into dedicated modules and synchronized selection state across Undo/Redo.

---
*Full changelog in [`CHANGELOG.md`](./CHANGELOG.md)*
