# FICSIT Labs — `0.0.11 dev build`
*Published 2026-11-03*

### 🧲 Satisfactory-Style Snap Mode & Visual Alignment Guidelines
- **Smart Magnetic Snapping**: Snaps buildings to connected ports, nearby compatible ports, and building centerlines within 18px.
- **Dynamic Laser Guidelines**: Real-time cyan dashed guidelines for port-to-port alignment with port reticles, and amber guidelines for centerline alignment.
- **Dedicated Touch Toggle**: Quick `Snap: ON / OFF` button in the HUD toolbar and Settings modal.

### 📐 Standardized Grid-Aligned Machine & Port Heights
- **Uniform Proportions**: Single-port buildings standardized to 144px height (ports at +96px); multi-port buildings standardized to 168px height (ports at +72px, +96px, +120px).
- **100% Straight Belts**: Collinear machines connect via clean 2-point horizontal conveyor lines without kinks or stair-stepping.

### 📊 Belt HUD & In-Transit Telemetry Polish
- **Always Above Machines**: Belt HUD badges and in-transit percentages render at top z-index, never hiding underneath machine cards.
- **Drag Consistency**: Telemetry stays visible and updates smoothly while dragging nodes.
- **Upright Item Icons**: Items traveling along vertical conveyors remain strictly upright without turning sideways.

### 🔄 Conveyor Routing & Transfer Physics
- **Loop Elimination**: Fixed close-distance vertical routing loops; no unexpected detour paths.
- **Physical Transit Speed**: Maintains strict conveyor speed and item travel delay physics regardless of belt geometry.

### 📱 Pure Mobile Touch Experience
- **Zero Keyboard Shortcuts**: Removed all `keydown` handlers (`Escape`, `Q`, `Delete`, `1-4`) and desktop badge hints (`[Esc]`, `[Q]`).

---
*Full historical changelog available in [`CHANGELOG.md`](./CHANGELOG.md)*
