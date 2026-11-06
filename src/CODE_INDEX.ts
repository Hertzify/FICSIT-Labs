/**
 * MODULE INDEX (`src/CODE_INDEX.ts`)
 * -----------------------------------------------------------------------------
 * Programmatic Feature & Architecture Index for FICSIT Mobile Sector 01.
 * Maps every feature domain to its exact file path, line range, and key symbols
 * so developers and tools can jump directly to the implementation without
 * reading entire files.
 */

export interface CodeIndexEntry {
  feature: string;
  file: string;
  lines: string;
  symbols: string[];
  description: string;
}

export const CODEBASE_FEATURE_INDEX: Record<string, CodeIndexEntry[]> = {
  /**
   * 1. CANVAS RENDERING & EXTERIOR MACHINE HUD
   */
  canvasRendering: [
    {
      feature: 'Miner Mk.1 Exterior HUD (Media item 1 Authentic Card, 0%–250% Overclock)',
      file: 'src/components/canvasNodeRenderer.ts',
      lines: 'L305–L685',
      symbols: ['renderMachineNodesAndDeposits'],
      description:
        'Renders the riveted steel frame, left centrifugal drum with status LED, dark center status monitor (Mining, MW, cycle sec, efficiency %), white OUTPUT card with live item count, 0%–250% segmented clock bar, and STANDBY switch.',
    },
    {
      feature: 'Standard Processor Exterior Cards (Smelter, Constructor, Assembler, Logistics)',
      file: 'src/components/canvasNodeRenderer.ts',
      lines: 'L687–L848',
      symbols: ['renderMachineNodesAndDeposits'],
      description:
        'Renders non-miner machine bodies, status indicator beacons (green/yellow/red), clock speed, power consumption, and live output item boxes.',
    },
    {
      feature: 'Natural Resource Deposit Outcrops & Macro Map Pins',
      file: 'src/components/canvasNodeRenderer.ts',
      lines: 'L60–L303',
      symbols: ['renderMachineNodesAndDeposits'],
      description:
        'Renders hexagonal planetary ore deposits with purity rings (Impure/Normal/Pure) and zoomed-out macro map pins below zoom 0.42.',
    },
    {
      feature: 'Conveyor Belt Tracks, Bridges, In-Flight Packets & Throughput Pills',
      file: 'src/components/canvasRenderer.ts',
      lines: 'L195–L710',
      symbols: ['renderFactoryScene'],
      description:
        'Renders filleted orthogonal conveyor belts (Mk.1–Mk.6), overpass bridge housings at belt crossings, animated item icons, and throughput rate badges.',
    },
    {
      feature: 'Building Ghost Placement Preview & Snap Guidelines',
      file: 'src/components/canvasRenderer.ts',
      lines: 'L135–L193, L712–L879',
      symbols: ['renderFactoryScene'],
      description:
        'Renders cyan/amber snap alignment lines, marquee selection box, and valid/invalid building placement ghost previews.',
    },
  ],

  /**
   * 2. INTERNAL SATISFACTORY MACHINE GUI & PIONEER INVENTORY
   */
  machineInspectorUI: [
    {
      feature: 'Satisfactory Machine Window Shell & Recipe / Production Tabs',
      file: 'src/components/NodeInspectorPanel.tsx',
      lines: 'L115–L288',
      symbols: ['NodeInspectorPanel'],
      description:
        'Authentic dark brushed-metal Satisfactory window header, Select Recipe browser grid, and Production tab layout.',
    },
    {
      feature: 'Miner Mk.1 Internal GUI & Standard Machine Input/Output Columns',
      file: 'src/components/NodeInspectorPanel.tsx',
      lines: 'L290–L655',
      symbols: ['NodeInspectorPanel'],
      description:
        'Renders the internal Miner Mk.1 centrifugal drum + status monitor + output slot, or the Smelter/Constructor/Assembler Recipe banner + INPUT + Center Monitor + OUTPUT columns.',
    },
    {
      feature: 'Overclocking Slider (1%–250%), 3 Power Shard Slots & Standby Footer',
      file: 'src/components/MachineOverclockSection.tsx',
      lines: 'L50–L429',
      symbols: ['MachineOverclockSection'],
      description:
        'Interactive 1%–250% clock speed slider with 100%/150%/200%/250% tick marks, 3 clickable Power Shard slots, Somersloop Output Multiplier box, Belt Tier quick-upgrade, and Copy/Paste/Standby footer.',
    },
    {
      feature: 'Right-Hand Pioneer Inventory Panel (Relevant Items + 9x5 All Items Grid)',
      file: 'src/components/PioneerInventoryPanel.tsx',
      lines: 'L65–L352',
      symbols: ['PioneerInventoryPanel', 'ScrewHead', 'PowerShardCrystalIcon'],
      description:
        'Displays Relevant Items for the selected machine, the 45-slot Pioneer Inventory grid with live factory item counts, Sort button, and Trash slot.',
    },
  ],

  /**
   * 3. CANVAS INTERACTION, POINTER GESTURES & OVERLAYS
   */
  canvasInteraction: [
    {
      feature: '60 FPS Render Loop, 20 Hz Simulation Accumulator & Keyboard Shortcuts',
      file: 'src/components/NodeCanvas.tsx',
      lines: 'L227–L595',
      symbols: ['NodeCanvas'],
      description:
        'Manages requestAnimationFrame loop, ResizeObserver, selection reconciliation on Undo/Redo, and Escape / Ctrl+Z / Ctrl+Y shortcuts.',
    },
    {
      feature: 'Pointer Down Handler (Build Placement, Port Wiring, Corner Dots, Pinch Start)',
      file: 'src/components/canvasPointerDown.ts',
      lines: 'L177–L535',
      symbols: ['executeCanvasPointerDown', 'tryCreateConnection', 'createInitialInteractionState'],
      description:
        'Handles building placement validation, port tap/drag wiring, conveyor waypoint insertion, node/belt selection, and two-finger pinch initialization.',
    },
    {
      feature: 'Pointer Move, Pointer Up/Cancel & Smooth Wheel Zoom',
      file: 'src/components/canvasPointerMoveUp.ts',
      lines: 'L50–L615',
      symbols: ['executeCanvasPointerMove', 'executeCanvasPointerUpOrCancel', 'executeCanvasWheel'],
      description:
        'Handles pinch zoom, double-tap drag zoom, marquee selection, obstacle-safe corner dot dragging, single/group node dragging with snap, and collision revert.',
    },
    {
      feature: 'Floating Action Bars & Connected Inspector Mutation Handlers',
      file: 'src/components/CanvasOverlays.tsx',
      lines: 'L67–L550',
      symbols: ['CanvasOverlays'],
      description:
        'Renders Corner Dot & Multi-Selection action bars, placement banners, and connects NodeInspectorPanel & BeltInspectorPanel actions with instant telemetry sync.',
    },
  ],

  /**
   * 4. FACTORY SIMULATION, ROUTING & CATALOG DATA
   */
  simulationAndRouting: [
    {
      feature: 'Discrete 20 Hz Factory Simulation Step',
      file: 'src/game/simulation.ts',
      lines: 'L45–L679',
      symbols: ['stepSimulation'],
      description:
        'Advances in-flight belt packets, transfers items into input buffers, runs machine crafting cycles, and computes rolling-average productivity.',
    },
    {
      feature: 'Steady-State Throughput Propagation & Bottleneck Diagnostics',
      file: 'src/game/simulationTelemetry.ts',
      lines: 'L215–L748',
      symbols: ['propagateSteadyStateTelemetry', 'computeDestPortMaxAcceptRate'],
      description:
        'Propagates theoretical and actual items/min rates across extractors, splitters, mergers, belts, and multi-input machines.',
    },
    {
      feature: 'Obstacle-Avoiding Orthogonal Conveyor Router & Route Cache',
      file: 'src/game/conveyorRouting.ts',
      lines: 'L135–L757',
      symbols: ['computeConveyorPathWithWaypoints', 'getCachedConveyorRoute', 'invalidateAllConveyorCaches'],
      description:
        'Computes clean 90° orthogonal belt routes that detour around buildings and deposits while honoring user-placed corner waypoints.',
    },
    {
      feature: 'Filleted Conveyor Corners & Bridge Crossing Detector',
      file: 'src/game/conveyorCurves.ts',
      lines: 'L85–L359',
      symbols: ['computeFilletedConveyorPath', 'sampleFilletedPath', 'findConveyorCrossings'],
      description:
        'Converts orthogonal polylines into smooth quarter-circle arcs and detects perpendicular belt intersections for bridge rendering.',
    },
    {
      feature: 'Buildings, Recipes, Belt Tiers (Mk.1–Mk.6) & Sector 01 Deposits',
      file: 'src/game/catalog.ts',
      lines: 'L1–L584',
      symbols: ['ITEMS', 'BUILDINGS', 'RECIPES', 'CONVEYOR_BELT_TIERS', 'PURITY_CONFIG'],
      description:
        'Canonical catalog of FICSIT items, machines, crafting recipes, belt capacities, and re-exported Sector 01 deposit specs.',
    },
  ],
};
