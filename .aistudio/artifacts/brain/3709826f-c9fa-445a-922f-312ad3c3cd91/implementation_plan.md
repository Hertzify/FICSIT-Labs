# Satisfactory-Style Snap Mode, Port Alignment & Mobile-Only Controls

A precision building and conveyor alignment upgrade for **FICSIT Labs** designed exclusively for mobile touch play—standardizing port vertical offsets across the 24px world grid, introducing an always-on smart **Snap Mode** with a dedicated touch HUD button and visual laser guidelines, and stripping out all desktop keyboard shortcuts and keycap labels across the interface.

## User Review & Critical Decisions

- **Touch-Only HUD Toggle (Zero Keyboard Shortcuts)**: Snap Mode is enabled by default as an always-on smart snapping system, controlled strictly via a dedicated touch HUD toggle button (`Snap: ON / OFF`). All existing keyboard event listeners and desktop shortcut labels (such as `[Esc]` on the Menu button, `[B]`, `[Del]`, etc.) will be completely removed from the game.
- **Alignment Targets & Visual Guidelines**: Dragging or placing a building by touch actively snaps to **connected input/output ports**, **nearby compatible input/output ports**, and **building centers/edges**, rendering high-contrast Satisfactory-style guideline lasers across the canvas to confirm exact alignment.
- **Standardized Grid-Aligned Port Heights**: Building heights and port vertical offsets are standardized onto exact multiples of the 24px world grid so any two top-aligned or port-aligned nodes connect with a perfectly straight, zero-kink horizontal conveyor belt.

---

## 1. Overview & Core Concept

Currently, each building category computes its input and output port coordinates dynamically as a fraction of its total card height (`136px`, `140px`, `142px`, `168px`, `176px`, `188px`). Because those heights are not uniform multiples of the 24px world grid, two buildings snapped to the exact same top row (`node.y`) place their ports 1px to 5px apart vertically—forcing the orthogonal belt router to insert a tiny vertical jog instead of a clean horizontal line.

This update resolves the issue at both the **geometric level** and the **touch interaction level**, while cleaning up desktop artifacts:
1. **Grid-Quantized Port Geometry**: Single-port buildings share a unified `144px` (`6 × 24px`) chassis height with their primary port locked at `node.y + 96px` (`4 × 24px`), while multi-port buildings (Assemblers, Splitters, Mergers, and The HUB) space their ports on exact `24px` grid increments around that same `96px` baseline.
2. **Satisfactory-Style Smart Snap Mode**: While dragging an existing machine or positioning a new building on the touch canvas, the position resolver evaluates nearby and connected machines within a magnetic capture corridor, snapping the node so its ports or centerlines lock into exact collinearity and projecting visual alignment lasers across the factory floor.
3. **Complete Removal of Keyboard Shortcuts**: All `keydown`/`keyup` listeners and UI shortcut hints (`[Esc]`, `[B]`, `[1-3]`, `[Del]`, etc.) are removed so every button and HUD element is clean and tailored for mobile screens.

---

## 2. User Experience & Visual Design

- **Touch HUD Snap Mode Button**:
  - Positioned in the bottom-left HUD dock directly beside the Conveyor Belt Mark selector (`Mk.1 / Mk.2 / Mk.3`).
  - Displays a clean touch button (`Snap: ON` highlighted in FICSIT cyan/amber when active, `Snap: OFF` in muted slate when disabled) and persists in player settings.
- **Clean Mobile HUD Labels**:
  - Top-left menu button displays simply `Menu` (removing `[Esc]`), and all tooltips/buttons across the HUD, Build drawer, and Inspector use touch-only copy.
- **Satisfactory-Style Laser Guidelines**:
  - **Port-to-Port Alignment Laser (Cyan / Amber)**: When a building's input or output port locks onto the exact Y-coordinate of a connected or nearby compatible port, a glowing dashed guideline laser (`#38BDF8` for input alignment, `#F59E0B` for output alignment) spans directly between the two port sockets with target reticles at both ends.
  - **Center / Edge Alignment Line (Subtle Slate-Cyan)**: When a building's horizontal or vertical center/top edge aligns with a neighboring machine in the same row or column, a clean architectural guide line renders across the shared axis.
- **Zero-Kink Straight Conveyor Routing**:
  - When two connected ports share the same Y-coordinate (`|y1 - y2| < 0.5px`) and the destination port faces the source port without intervening obstacles, the belt renders as a single straight horizontal segment with uniform item spacing and an unobstructed midpoint badge.

---

## 3. Key Product Decisions & Trade-Offs

- **Priority Hierarchy for Magnetic Snapping**:
  - *Decision*: Connected ports take first priority, followed by nearby compatible ports within a `900px` horizontal corridor, followed by building center/top-edge alignment, and finally the standard `24px` world grid.
  - *Rationale*: When adjusting a machine that is already wired into a production line on a touchscreen, straightening the active conveyor belt is the player's primary intent. Prioritizing connected ports guarantees the belt snaps straight without requiring pixel-perfect finger placement.
- **Grid-Quantized Multi-Port Spacing (`24px` Pitch)**:
  - *Decision*: Standardize single-port offset to `+96px`, 2-port offsets to `+72px` and `+120px` on a `168px` (`7 × 24px`) chassis, and 3-port Splitter/Merger offsets to `+72px`, `+96px`, and `+120px` on a `168px` (`7 × 24px`) chassis.
  - *Rationale*: Because every port offset (`+72px`, `+96px`, `+120px`) is an exact multiple of the `24px` world grid, *every* port on a Splitter, Merger, or Assembler can form a 100% straight horizontal belt with a Smelter, Constructor, Miner, or Storage Container simply by stepping the machine up or down by one `24px` grid unit.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  Touch / Pointer Move (Drag Node / Build)               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Raw World Coordinates (x, y)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Snap Mode Resolver (snapMode === ON)                │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Connected Port Match (|Δy| ≤ 14px) ──► Lock Port Y & Emit Laser     │
│  2. Nearby Compatible Port (|Δy| ≤ 14px, Δx ≤ 900px) ──► Lock Port Y    │
│  3. Building Center / Top Edge Match (|Δx| or |Δy| ≤ 12px) ──► Lock Axis│
│  4. Fallback 24px World Grid Quantization (Math.round(v / 24) * 24)     │
└─────────────────┬───────────────────────────────────┬───────────────────┘
                  │ Snapped { x, y }                  │ Active Guidelines[]
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│   Orthogonal Belt Path Router     │ │   Canvas Overlay Pass (Top HUD)   │
│  Produces 2-Point Straight Segment│ │  Renders Dashed Cyan/Amber Lasers │
│     When |y1 - y2| < 0.5px        │ │    & Port Alignment Reticles      │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

- **Unified Port Coordinate Calculation**: Both the simulation engine and the canvas renderer share a single deterministic port offset table indexed by total port count (`1 → [+96]`, `2 → [+72, +120]`, `3 → [+72, +96, +120]`), eliminating any discrepancy between visual port sockets and belt path endpoints.
- **Starter & Existing Factory Migration**: Existing nodes and starter factory layouts automatically snap their Y coordinates to the nearest 24px grid multiple on load so existing saves immediately benefit from straight horizontal belts.
