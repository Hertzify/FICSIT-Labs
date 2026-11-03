# Version 12 Implementation Plan: Local Snap Mode Proximity & Authentic Satisfactory Building Storage

## 1. Overview
Version 12 introduces two core improvements modeled after *Satisfactory*:
1. **Bounded Local Snap Mode Proximity (`240px` / `~15m`)**: Prevents buildings from snapping to or drawing alignment lasers toward distant machines across the factory floor, even if connected by a long conveyor belt.
2. **Full *Satisfactory* Internal Building Buffers & Capacity Limits**: Implements canonical item stack sizes (`100`, `200`, `500`), 1-stack input and output buffers inside production/extraction machines, 24-slot Storage Containers, `BACKED UP` status when output storage reaches 100%, and **both** the crafting progress bar and a new storage capacity bar (`0%–100%` fill + `Stored / Max` item count) on node cards.

---

## 2. Bounded Local Snap Mode (`src/game/rules.ts`)
- **Strict Local Proximity Constant**:
  - Replace the long-range `960px` / `840px` corridor constants and unbounded connected-port snap checks in `computeNodeSnapAlignment` with a strict local edge-to-edge proximity limit (`MAX_SNAP_PROXIMITY = 240`, ~15m in grid units).
- **2D Bounding Box Distance Check Across All Priorities**:
  - Require both horizontal and vertical edge-to-edge gaps (`hDist <= 240` and `vDist <= 240`) before considering any candidate building for:
    - **Priority 1A**: Connected input/output port Y-alignment.
    - **Priority 1B**: Nearby facing input/output port Y-alignment.
    - **Priority 1C**: Building vertical center Y-alignment.
    - **Priority 2**: Building horizontal X-alignment (center X and left/right edges).
  - Cull all cyan/emerald snap laser guidelines beyond the `240px` neighborhood so dragging a machine only projects guidelines to immediate neighbors.

---

## 3. Canonical *Satisfactory* Stack Sizes & Building Buffers (`src/game/types.ts`, `src/game/rules.ts`)
- **Item Stack Sizes (`ITEM_STACK_SIZES`)**:
  - `100` items/stack: `iron_ore`, `copper_ore`, `limestone`, `iron_ingot`, `copper_ingot`, `reinforced_iron_plate`, `rotor`
  - `200` items/stack: `iron_plate`, `iron_rod`, `cable`
  - `500` items/stack: `wire`, `concrete`, `screw`
- **Port & Building Storage State**:
  - Add `bufferedCount?: number` and `maxBuffer?: number` to `PortState` (and `maxStoredCount?: number` on `MachineNode`) so each input port and output port tracks its stored items and stack limit.
- **Production & Extraction Machine Buffers (`Miner Mk.1`, `Smelter`, `Constructor`, `Assembler`)**:
  - **Input Slots (1 Stack per Input Port)**:
    - Incoming belts deliver items into the target input port's buffer up to `1 × stackSize` (e.g., `100` Iron Ore).
    - Once an input buffer reaches `100%` full, backpressure throttles the incoming belt to the machine's active consumption rate.
    - If an incoming belt is disconnected or starved, the machine continues crafting by consuming directly from its buffered input items until empty.
  - **Output Slot (1 Stack per Output Port)**:
    - Crafted or mined items enter the machine's output buffer (`1 × stackSize`, e.g., `200` Iron Plates).
    - Connected output belts pull items from the output buffer up to the belt's speed (`60/m` or `120/m`) and downstream demand.
    - When production exceeds outgoing belt flow (or when no output belt is connected), excess crafted items accumulate in the output buffer.
    - When the output buffer reaches **100% capacity**, the machine transitions to **`backed_up` (`BACKED UP`)** and pauses crafting until outgoing belts drain space in the buffer.
- **Storage Container (`24 Slots`)**:
  - Capacity is `24 × itemStackSize` (e.g., `2,400` Ingots, `4,800` Iron Plates, `12,000` Screws; defaults to `2,400` before an item type is locked in).
  - Acts as a true flow buffer: accumulates incoming items up to 24 full stacks and discharges stored items onto connected output belts even if upstream inputs stop.
  - Enters `backed_up` when `storedCount >= maxStoredCount` and throttles incoming belts once full.

---

## 4. Node Card & Inspector UI (`src/components/NodeCanvas.tsx`, `src/App.tsx`)
- **Both Bars on Building Cards**:
  - Increase standard machine card footer space slightly (`getNodeHeight` adjusted cleanly) so every production, extraction, and storage building card renders:
    1. **Storage Capacity Bar + Item Count**: Shows a dedicated storage bar that fills from `0%` to `100%` capacity alongside the exact `Stored / Max` item count (e.g., `142 / 200` or `1,250 / 4,800`). Turns amber when `100%` full (`BACKED UP`).
    2. **Crafting / Extraction Cycle Progress Bar**: Kept below the storage bar to show active cycle progress when the machine is running.
- **Inspector Popover Slot Breakdown**:
  - In the bottom-right Node Inspector panel, display individual **Input Slot Buffers** (`Stored / Stack Limit` per ingredient) and **Output / Container Buffer** (`Stored / Max Capacity` and slot count) with fill bars and a button to clear/flush internal buffers if desired.
- **Version 12 Badge & Changelog**:
  - Update the version badge and changelog history entry to **v12**.
