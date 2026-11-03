# FICSIT Node Labs — `0.0.14 dev build`

### 🛠️ Blueprint Grid Rendering & Camera Viewport Fix
- **Fixed Horizontal Major Grid Line Cutoff**: Resolved a coordinate bug in `canvasRenderer.ts` where horizontal major grid lines terminated at `endWorldY` instead of `endWorldX`, causing grid lines to shift and disappear while panning or zooming.
- **True Camera Viewport Grid Bounds**: Aligned blueprint grid line endpoints directly with the visible camera viewport bounds while preserving the `0.42x` minor and `0.14x` major grid zoom thresholds.

---
*Full changelog in [`CHANGELOG.md`](./CHANGELOG.md)*
