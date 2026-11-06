# FICSIT Mobile Sector 01 — Feature & Codebase Index (`CODE_INDEX.md`)

Use this index to jump directly to any feature, simulation rule, canvas renderer, or UI component by **file path**, **line range**, and **function/component name** without scanning large files.

---

## 1. File Size & Module Overview

Every source file is modularized (`< 900 lines`) and contains a `MODULE INDEX` header at the top:

| Layer | File Path | Lines | Responsibility |
| :--- | :--- | :---: | :--- |
| **Root Shell** | `/src/App.tsx` | ~700 | GameState (`title` / `playing` / `paused`), Save/Load orchestration, Auto-Save, Undo/Redo, Top/Bottom HUD bars |
| **Feature Index** | `/src/CODE_INDEX.ts` | ~220 | Typed programmatic directory of all features, files, line ranges, and entry points |
| **Canvas Controller** | `/src/components/NodeCanvas.tsx` | ~595 | 60 FPS `requestAnimationFrame` loop, 20 Hz fixed simulation accumulator, `ResizeObserver`, keyboard shortcuts |
| **Canvas Pointer Down** | `/src/components/canvasPointerDown.ts` | ~535 | `CanvasInteractionState`, `tryCreateConnection`, `executeCanvasPointerDown` (placement, wiring, corner dots, pinch) |
| **Canvas Pointer Move/Up** | `/src/components/canvasPointerMoveUp.ts` | ~615 | `executeCanvasPointerMove`, `executeCanvasPointerUpOrCancel`, `executeCanvasWheel`, `applyZoomAboutScreenPoint` |
| **Canvas Overlays** | `/src/components/CanvasOverlays.tsx` | ~550 | Floating HUD action bars + connected `NodeInspectorPanel` & `BeltInspectorPanel` mutation wrappers |
| **Scene & Belt Renderer** | `/src/components/canvasRenderer.ts` | ~879 | World grid, snap guidelines, conveyor belts, bridges, animated packets, throughput pills, ghost placement preview |
| **Node & Deposit Renderer** | `/src/components/canvasNodeRenderer.ts` | ~901 | Macro map pins, natural deposit outcrops, **Miner Mk.1 Exterior HUD (`Media item 1`, 250% max)**, processor cards, ports |
| **Canvas Artwork** | `/src/components/canvasArtwork.ts` | ~356 | Image cache (`getHtmlImage`), rounded rect helper, procedural vector fallback illustrations for parts & buildings |
| **Canvas Hit Testing** | `/src/components/canvasHitTesting.ts` | ~358 | Hit detection for ports (`findPortAtWorld`), nodes (`findNodeAtWorld`), belts (`findBeltAtWorld`), corner dots (`findWaypointAtWorld`) |
| **Machine Inspector GUI** | `/src/components/NodeInspectorPanel.tsx` | ~697 | Authentic Satisfactory dual-panel Machine Window (Select Recipe tab, Production tab, Miner centrifugal drum + status monitor) |
| **Overclock & Footer UI** | `/src/components/MachineOverclockSection.tsx` | ~429 | Overclocking (`1%–250%` slider + 3 Power Shard slots), Output Multiplier, Belt Quick-Upgrade, Copy/Paste/Standby footer |
| **Pioneer Inventory UI** | `/src/components/PioneerInventoryPanel.tsx` | ~352 | Right-hand Pioneer Inventory (`Relevant Items:`, `All Items:` 9×5 grid, `Sort`, `Trash`, `ScrewHead`, `PowerShardCrystalIcon`) |
| **Belt Inspector GUI** | `/src/components/BeltInspectorPanel.tsx` | ~264 | Conveyor Belt Inspector modal (Mk.1–Mk.6 tier upgrade, clear items, reset route, dismantle belt) |
| **Build Menu Modal** | `/src/components/BuildMenuModal.tsx` | ~370 | Categorized FICSIT Build Menu (Extractors, Smelters, Constructors, Assemblers, Logistics, Belt Tiers) |
| **Top Control Toolbar** | `/src/components/SatisfactoryToolbar.tsx` | ~194 | Top-center tool selector (`Edit`, `Move`, `Select`, `Corner`) + `Undo` / `Redo` buttons |
| **Main Menu & New Game** | `/src/components/MainMenu.tsx` | ~320 | Satisfactory-style title screen, Continue Latest, New Game session creator |
| **Save / Load Modal** | `/src/components/SaveLoadModal.tsx` | ~197 | Manual & Auto-Save slot browser, create/overwrite/delete save slots |
| **Settings Modal** | `/src/components/SettingsModal.tsx` | ~585 | UI Scale, Wiring Mode, Snap Mode, Performance Mode (`60fps` / `battery_saver`), JSON import/export, Factory Reset |
| **Core Types** | `/src/game/types.ts` | ~162 | `MachineNode`, `ConveyorConnection`, `PortDescriptor`, `BuildingDefinition`, `RecipeDefinition`, `SettingsConfig` |
| **Buildings & Recipes** | `/src/game/catalog.ts` | ~584 | `ITEMS`, `BUILDINGS`, `RECIPES`, `CONVEYOR_BELT_TIERS` (Mk.1 60/m to Mk.6 1200/m), `PURITY_CONFIG` |
| **Sector 01 Deposits** | `/src/game/sectorMapData.ts` | ~309 | `SECTOR_01_DEPOSIT_SPECS` (32 planetary resource deposits across 4 biomes) |
| **World & Node Factory** | `/src/game/world.ts` | ~497 | `createMachineNode`, `changeNodeRecipe`, `createConveyorConnection`, `upgradeConveyorBeltTier`, `createStarterFactoryGraph` |
| **Discrete Simulation** | `/src/game/simulation.ts` | ~679 | `stepSimulation` (20 Hz sub-stepping, packet advancement, machine crafting cycles, rolling-average efficiency) |
| **Steady-State Telemetry**| `/src/game/simulationTelemetry.ts` | ~748 | `propagateSteadyStateTelemetry`, `computeDestPortMaxAcceptRate`, `getEffectiveOutgoingBeltCapacity`, `isBeltPackedBackToSource` |
| **World & Port Geometry** | `/src/game/geometry.ts` | ~615 | World bounds (`4800×3200`), zoom limits, port coordinates (`getPortWorldPosition`), AABB & miner-on-deposit collision |
| **Conveyor Curves** | `/src/game/conveyorCurves.ts` | ~359 | `computeFilletedConveyorPath`, `sampleFilletedPath`, `sampleOrthogonalPath`, `findConveyorCrossings` |
| **Conveyor Routing** | `/src/game/conveyorRouting.ts` | ~757 | `computeConveyorPathWithWaypoints` (obstacle-avoiding orthogonal router), `getCachedConveyorRoute`, `invalidateAllConveyorCaches` |
| **Snap Alignment** | `/src/game/snap.ts` | ~455 | `computeNodeSnapAlignment` (port-to-port, center-to-center, and 24px grid snap with cyan/amber guidelines) |
| **Save Slot Storage** | `/src/game/storage.ts` | ~219 | `loadSettings`, `saveSettings`, `loadSaveSlots`, `upsertSaveSlot`, `upsertAutoSaveForSession`, `deleteSaveSlotById` |
| **Undo / Redo History** | `/src/game/history.ts` | ~137 | `factoryHistory` stack (50-step deep clone undo/redo with subscriber notifications) |
| **Original Wiki Icons** | `/src/game/icons.ts` | ~130 | `getItemIconUrl`, `getBuildingIconUrl` mapping item/building IDs to `/assets/satisfactory/items/` & `/buildings/` |
| **WebAudio Synth SFX** | `/src/game/audio.ts` | ~101 | `playSynthSfx` (`click`, `place`, `connect`, `disconnect`, `error`, `save`) |

---

## 2. Quick Feature Lookup (Where to Go for Specific Changes)

### A. Exterior Canvas Node UI & Miner Mk.1 (`Media item 1` Card)
- **Miner Mk.1 Exterior Card (Drum + Status Light + Central Monitor + Output Card + 0%–250% Clock Bar + Standby)**:
  - File: `/src/components/canvasNodeRenderer.ts`
  - Lines: `L305–L685`
- **Standard Processor Machine Exterior Card (Smelter, Constructor, Assembler, Foundry, Splitter, Merger, HUB, Storage)**:
  - File: `/src/components/canvasNodeRenderer.ts`
  - Lines: `L687–L848`
- **Natural Resource Deposit Outcrops (Hexagonal Ore Patch + Purity Ring)**:
  - File: `/src/components/canvasNodeRenderer.ts`
  - Lines: `L175–L303`
- **Macro Map View Pins (Zoom < `0.42`)**:
  - File: `/src/components/canvasNodeRenderer.ts`
  - Lines: `L60–L173`
- **Input & Output Port Sockets & Rate Pills (`60/m`)**:
  - File: `/src/components/canvasNodeRenderer.ts`
  - Lines: `L850–L901`

### B. Internal Satisfactory Machine Inspector & Pioneer Inventory GUI
- **Machine Window Header, `Select Recipe` / `Production` Tabs, and Dual-Column Shell**:
  - File: `/src/components/NodeInspectorPanel.tsx`
  - Lines: `L115–L275`
- **Miner Mk.1 Internal Top Section (Centrifugal Drum + Dark Status Monitor + White Output Card)**:
  - File: `/src/components/NodeInspectorPanel.tsx`
  - Lines: `L290–L445`
- **Standard Machine Internal Top Section (`Recipe:` Banner + Left `INPUT` Box + Center Status Monitor + Right `OUTPUT` Box)**:
  - File: `/src/components/NodeInspectorPanel.tsx`
  - Lines: `L447–L655`
- **Overclocking Panel (`1%–250%` Slider, 3 Power Shard Slots, `OVERCLOCK` Label, `MULTIPLIER` Box, Belt Tier Quick-Upgrade, Footer)**:
  - File: `/src/components/MachineOverclockSection.tsx`
  - Lines: `L50–L429`
- **Pioneer Inventory Panel (`Relevant Items:`, `All Items:` 9×5 Grid, `Sort` & `Trash` Footer)**:
  - File: `/src/components/PioneerInventoryPanel.tsx`
  - Lines: `L65–L352`

### C. Overclocking & Power Shard Math (`1%–250%`)
- **Power Consumption Formula (`basePowerMW * (clockSpeedPct / 100) ^ 1.321928`) & Cycle Duration Scaling**:
  - File: `/src/game/simulationTelemetry.ts` (`L515–L555`)
  - File: `/src/game/simulation.ts` (`L350–L415`)
  - File: `/src/components/NodeInspectorPanel.tsx` (`L75–L105`)
- **Power Shard Slot Unlocking (`0 shards = 100%`, `1 shard = 150%`, `2 shards = 200%`, `3 shards = 250%`)**:
  - File: `/src/components/MachineOverclockSection.tsx` (`L45–L195`)

### D. Conveyor Belts, Waypoint Corner Dots & Obstacle Avoidance
- **Orthogonal Path Generation & Obstacle Detour Routing**:
  - File: `/src/game/conveyorRouting.ts` (`L135–L650`, `computeConveyorPathWithWaypoints`)
- **Rounded 90° Corner Fillets & Belt Crossing Bridges**:
  - File: `/src/game/conveyorCurves.ts` (`L85–L359`, `computeFilletedConveyorPath`, `findConveyorCrossings`)
- **Belt Tracks, Animated Chevrons, In-Flight Item Packets & Throughput Pills**:
  - File: `/src/components/canvasRenderer.ts` (`L195–L710`)
- **Corner Dot Addition, Dragging & Dismantling**:
  - File: `/src/components/canvasPointerDown.ts` (`L230–L335`)
  - File: `/src/components/canvasPointerMoveUp.ts` (`L145–L235`, `L515–L555`)

### E. Simulation Engine & Throughput Telemetry
- **Discrete 20 Hz Simulation Tick (`stepSimulation`)**:
  - File: `/src/game/simulation.ts` (`L45–L679`)
- **Steady-State Rate Propagation & Bottleneck Diagnostics (`propagateSteadyStateTelemetry`)**:
  - File: `/src/game/simulationTelemetry.ts` (`L215–L748`)
- **Unit Test Suite (32 Tests covering Placement, Routing, Simulation, Snap, Waypoints)**:
  - File: `/src/game/rules.test.ts` (`L1–L1496`)
