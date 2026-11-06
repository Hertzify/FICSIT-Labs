export interface ChangelogItem {
  title: string;
  description: string;
}

export interface ChangelogRelease {
  version: string;
  tag: string;
  date: string;
  categories: {
    category: string;
    items: ChangelogItem[];
  }[];
}

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '0.0.20',
    tag: '0.0.20 dev build',
    date: '2026-11-06',
    categories: [
      {
        category: '⚡ Authentic Satisfactory Icons, Overclocking & Standby Rocker Switch',
        items: [
          {
            title: 'Official Satisfactory Telemetry & Artifact Icons (Inside & Outside GUI)',
            description:
              'Replaced custom icons across both the exterior canvas machine cards and the internal Machine Inspector with the official Satisfactory game icons: Power Shard (power_shard.png), Somersloop Output Multiplier (somersloop.png), lightning bolt power consumption, stopwatch cycle timer with 270° sector fill, and the 4-bar production efficiency histogram.',
          },
          {
            title: 'Symmetrical Illuminated I / O Standby Rocker Switch',
            description:
              'Redesigned the Standby rocker switch both on the exterior Miner Mk.1 canvas card and inside the Machine Inspector with a symmetrical 50/50 split rocker, glowing orange active state (I), crimson standby state (O), and tactile bevel shading.',
          },
          {
            title: 'True-to-Game Machine Inspector Proportions & Overclocking Bay',
            description:
              'Refined the Machine Inspector layout to match the in-game Satisfactory UI with centered overlapping monitor/output cards, 3 Power Shard slots with 1/1 stack badges, and an Output Multiplier (Somersloop) panel.',
          },
        ],
      },
      {
        category: '📊 Rate Display Format Setting & Full Machine Storage Persistence',
        items: [
          {
            title: 'New Rate Display Format Setting ("60 per minute" Default vs "60/m")',
            description:
              'Added a Rate Display Format toggle under Settings → Visuals that displays throughput as "60 per minute" by default (matching Satisfactory) with an option to switch to compact "60/m" across all cards, ports, deposits, belt badges, and menus.',
          },
          {
            title: 'Direct Belt-Click Upgrading Only',
            description:
              'Removed conveyor belt tier upgrade controls from machine nodes so belt upgrades happen exclusively by clicking a conveyor belt directly.',
          },
          {
            title: 'Complete Machine Input & Output Storage Save Persistence',
            description:
              'Fixed save files and session auto-saves so all machine input and output buffers (including 100, 200, and 500 stack items and multi-input Assemblers) are reconciled and preserved across manual saves, auto-saves, JSON import/export, and reloads without draining while on the Title Screen or Pause Menu.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.19',
    tag: '0.0.19 dev build',
    date: '2026-11-05',
    categories: [
      {
        category: '🔘 Interactive Exterior Standby Switch & Real-Time Node Storage Saving',
        items: [
          {
            title: 'Interactive Exterior STANDBY Rocker Switch on Miner Mk.1',
            description:
              'Made the exterior STANDBY rocker switch on the bottom-right of Miner Mk.1 cards directly clickable from the canvas without opening the full inspector, complete with live rocker toggle state, Undo/Redo history, and instant telemetry update.',
          },
          {
            title: 'Real-Time Node Input & Output Storage Persistence',
            description:
              'Fixed node storage persistence across page reloads, tab switches, manual saves, and auto-saves by preserving exact input/output buffer counts (dt = 0 on load) and continuously syncing live machine storages to localStorage.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.18',
    tag: '0.0.18 dev build',
    date: '2026-11-05',
    categories: [
      {
        category: '🏭 Authentic Satisfactory Machine GUIs, Pioneer Inventory & Miner HUD',
        items: [
          {
            title: 'Authentic Satisfactory Machine Inspector & Pioneer Inventory GUI',
            description:
              'Redesigned the internal Machine Inspector to match the original Satisfactory FICSIT brushed-metal window with Select Recipe and Production tabs, Miner centrifugal drum, Input/Output cards, and the right-hand Pioneer Inventory (Relevant Items + 9×5 All Items grid + Sort & Trash).',
          },
          {
            title: '250% Overclocking Slider, 3 Power Shard Slots & Standby Switch',
            description:
              'Added authentic 1%–250% clock speed scaling with 3 interactive Power Shard slots (unlocking 150%, 200%, and 250% max clock speed), polynomial MW power scaling, Copy/Paste Settings, and an illuminated Standby rocker switch.',
          },
          {
            title: 'Miner Mk.1 Exterior Canvas HUD & Stable Rolling Efficiency',
            description:
              'Upgraded the Miner Mk.1 canvas node with the riveted industrial exterior HUD (ribbed drum, status LED, Mining monitor, white Output card, 0%–250% segmented clock bar, and Standby switch) plus rolling-average productivity telemetry.',
          },
        ],
      },
      {
        category: '🗂️ Modular Architecture, Feature Index & Stability Fixes',
        items: [
          {
            title: 'Modular Codebase Split & Feature Index (CODE_INDEX.md / CODE_INDEX.ts)',
            description:
              'Split large canvas, simulation, routing, and inspector files into focused single-responsibility modules and added a comprehensive Feature & Codebase Index mapping every feature by file and line range.',
          },
          {
            title: 'Instant Telemetry Sync on Dismantle/Unwire & Save Storage Hardening',
            description:
              'Ensured immediate route cache invalidation and zero-dt telemetry recalculation on node/group/belt dismantle and unwire actions, plus defensive save-slot validation and keyboard shortcuts (Escape, Ctrl/Cmd+Z, Ctrl/Cmd+Y).',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.17',
    tag: '0.0.17 dev build',
    date: '2026-11-04',
    categories: [
      {
        category: '🛠️ Satisfactory Mobile Control Bar & 90° Corner Dot Routing',
        items: [
          {
            title: 'Satisfactory Mobile Control Bar (Edit, Move, Multi-Select, Corner Dot, Undo/Redo)',
            description:
              'Added a touch-first Satisfactory-styled top control toolbar with Edit, Safe-Move (camera pan without accidental edits), Multi-Select marquee box, Conveyor 90° Corner Dot tool, and Undo/Redo history.',
          },
          {
            title: '2-State Perpendicular Corner DP Solver (Zero 180° Spikes or Overlaps)',
            description:
              'Upgraded conveyor corner-dot routing with a two-state dynamic programming solver (H -> V vs V -> H at each corner dot) that strictly guarantees 90° orthogonal corners, eliminates 180° fold-back spikes, and routes cleanly around buildings and planetary resource deposit rims.',
          },
          {
            title: 'Corner Dot Dismantling & Unified No-Overlap Enforcement',
            description:
              'Added one-tap corner dot dismantling in the Corner Dot tool plus a floating CORNER #N Dismantle bar in Edit mode, while preventing buildings, belts, and corner dots from ever overlapping.',
          },
        ],
      },
      {
        category: '⚡ Engine Optimization & Modular Architecture',
        items: [
          {
            title: 'Spatial Obstacle Culling & O(1) Deposit-Miner Indexing',
            description:
              'Added local bounding-box obstacle culling during orthogonal conveyor pathfinding and pre-indexed Miner-Deposit pairs in O(N) in both the 20 Hz simulation tick and 60 FPS canvas renderer.',
          },
          {
            title: 'Modular Canvas Artwork & Hit-Testing Architecture',
            description:
              'Extracted canvas vector/deposit artwork and spatial hit-testing into dedicated modules and synchronized selection state across Undo/Redo.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.16',
    tag: '0.0.16 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🎨 Sleek Conveyor Visuals & Multi-Angle Corner Arc Rotation',
        items: [
          {
            title: 'Thin Precision Roller Slats & Directional Chevrons',
            description:
              'Replaced thick blocky dashed lines with precision 1.5px industrial roller slats and periodic 1.7px forward directional chevrons that cleanly fit within the conveyor roller bed.',
          },
          {
            title: 'Continuous Corner Arc Radial Rotation',
            description:
              'Engineered circular fillet corner interpolation along 90-degree conveyor bends so moving lines and chevrons smoothly fan and rotate across multiple continuous radial angles instead of deforming into awkward squares.',
          },
          {
            title: 'Smooth Item Packet Corner Navigation',
            description:
              'Synchronized in-flight physical resource item packets to travel along rounded corner arcs, eliminating abrupt right-angle snapping.',
          },
          {
            title: 'Removed Artificial In-Transit HUD & Simplified Telemetry',
            description:
              'Eliminated artificial floating "Transit %" badges and cyan overrides, restoring clean Satisfactory-accurate belt telemetry badges displaying tier and real throughput capacity (or STALLED when backpressured).',
          },
        ],
      },
      {
        category: '⛏️ Planetary Resource Deposits & Strict Miner Clamping',
        items: [
          {
            title: 'Zero Wireless Mining & Strict Resource Deposit Requirement',
            description:
              'Miner Mk.1 extractors strictly require mounting directly on top of a planetary Resource Deposit. Moving a miner off a deposit or attempting to place it on bare terrain halts extraction immediately (0/m rate, 0% efficiency, Starved status, NO DEPOSIT warning), completely eliminating wireless ore extraction from empty air.',
          },
          {
            title: 'Satisfactory-Accurate Natural Geological Bedrock Deposits',
            description:
              'Resource Deposits feature craggy geological basalt bedrock, 3D mineral crystal clusters (Iron hematite, Copper amber, Limestone calcite), survey beacons, and central drill mounting collars.',
          },
          {
            title: 'Single Output Buffer for Miner Mk.1',
            description:
              'Miner Mk.1 features a single 100-item output storage buffer and 0 input ports, accurately matching Satisfactory building specifications.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.15',
    tag: '0.0.15 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🚀 Future-Proof 2D Engine & Low-End Device Performance',
        items: [
          {
            title: 'Decoupled 20 Hz Fixed-Timestep Simulation Loop',
            description:
              'Separated smooth 60 FPS camera/visual rendering from a fixed 20 Hz (50ms) factory simulation tick and removed per-pixel simulation steps while dragging machines.',
          },
          {
            title: 'O(1) Connection Indexing & Early-Exit Solver',
            description:
              'Indexed port/node connections via O(1) lookup maps and added convergence detection so settled factories finish flow calculation in 2 passes instead of N passes.',
          },
          {
            title: 'Cached Overpass Crossings & Low-End Battery Saver Mode',
            description:
              'Cached conveyor intersection checks by geometry signature and added a Low-End / Battery Saver mode in Settings that renders at 1.0x resolution and skips shadow passes.',
          },
        ],
      },
      {
        category: '📲 Standalone Offline Game Shell (PWA & Fullscreen)',
        items: [
          {
            title: 'Offline Installable Game & Asset Caching',
            description:
              'Configured service worker caching for all game scripts, UI, and Satisfactory icons so FICSIT Labs can be installed to the home screen and played 100% offline.',
          },
          {
            title: 'One-Tap Fullscreen & Install Controls',
            description:
              'Added Fullscreen toggle and Install Offline Game buttons directly in the Main Menu and Settings.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.14',
    tag: '0.0.14 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🛠️ Blueprint Grid Rendering & Camera Viewport Fix',
        items: [
          {
            title: 'Fixed Horizontal Major Grid Line Cutoff',
            description:
              'Resolved a coordinate bug in canvasRenderer.ts where horizontal major grid lines terminated at endWorldY instead of endWorldX, causing grid lines to shift and disappear while panning or zooming.',
          },
          {
            title: 'True Camera Viewport Grid Bounds',
            description:
              'Aligned blueprint grid line endpoints directly with the visible camera viewport bounds while preserving the 0.42x minor and 0.14x major grid zoom thresholds.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.13',
    tag: '0.0.13 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🗂️ Modular Architecture & Code Organization',
        items: [
          {
            title: 'Engine Domain Split (geometry, snap, world, simulation)',
            description:
              'Split the 2,075-line rules.ts monolith into focused domain modules for orthogonal geometry/pathfinding, bounded Snap Mode alignment, world deposits/save serialization, and factory tick simulation.',
          },
          {
            title: 'Canvas Renderer & Inspector Separation',
            description:
              'Extracted the 2D HTML5 Canvas drawing pipeline into canvasRenderer.ts and the floating machine/deposit inspector UI into a memoized NodeInspectorPanel.tsx component.',
          },
          {
            title: 'Dead & Duplicate Code Removal',
            description:
              'Removed unused legacy belt visual helpers, consolidated duplicate meter/pixel constants into catalog.ts, removed redundant coordinate wrappers, and simplified global pointer event listeners.',
          },
        ],
      },
      {
        category: '⚡ Safe Runtime Performance Optimizations',
        items: [
          {
            title: 'Geometry-Keyed Conveyor Belt Path Caching',
            description:
              'Cached obstacle-avoiding orthogonal belt paths and lengths by node geometry signature so stationary factories reuse precalculated routes across simulation and rendering passes.',
          },
          {
            title: 'Smart Inspector State Diffing',
            description:
              'Eliminated 35 FPS React DOM re-render thrashing when a machine is selected by updating the inspector snapshot only when visible item counts, flow rates, or statuses change.',
          },
          {
            title: 'Padded Camera Viewport Frustum Culling',
            description:
              'Skipped off-screen canvas draw calls for distant deposits, machines, and conveyor belts outside the active camera viewport plus a 240px safety margin.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.12',
    tag: '0.0.12 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🧲 Bounded Local Snap Mode Proximity',
        items: [
          {
            title: '240px (16m) Local Snap Range Limit',
            description:
              'Bounded Snap Mode and laser alignment guidelines to a tight 240px (~16m) edge-to-edge proximity around neighboring buildings, preventing buildings from snapping across the map.',
          },
          {
            title: 'Local Connected Port Snapping',
            description:
              'Connected conveyor belts only trigger magnetic port snapping and amber guidelines when the two buildings are within local proximity.',
          },
        ],
      },
      {
        category: '📦 Satisfactory Internal Building Storage & Stack Limits',
        items: [
          {
            title: 'Canonical Item Stack Sizes (100 / 200 / 500)',
            description:
              'Implemented official Satisfactory stack limits: 100/stack for Ores, Ingots, Reinforced Plates, and Rotors; 200/stack for Plates, Rods, and Cable; 500/stack for Wire, Concrete, and Screws.',
          },
          {
            title: '1-Stack Machine Input & Output Buffers',
            description:
              'Miners, Smelters, Constructors, and Assemblers buffer up to 1 full stack per input port and 1 full stack in their output slot, entering BACKED UP standby when output capacity reaches 100%.',
          },
          {
            title: '24-Slot Storage Container & HUB Capacity',
            description:
              'Storage Containers and The HUB store up to 24 full item stacks (2,400–12,000 parts) and automatically discharge buffered items onto connected output belts.',
          },
          {
            title: 'Dual Storage Capacity & Crafting Bars on Cards',
            description:
              'Machine cards now display both a Storage Capacity Bar (0%–100% with exact Stored / Max item count) and the Crafting Cycle Progress Bar, plus individual Input/Output slot bars in the Inspector.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.11',
    tag: '0.0.11 dev build',
    date: '2026-11-03',
    categories: [
      {
        category: '🧲 Satisfactory Snap Mode & Visual Guidelines',
        items: [
          {
            title: 'Smart Magnetic Port & Centerline Snapping',
            description: 'Moving or placing machines magnetically snaps to connected ports, nearby compatible ports, and building centerlines within an 18px attraction zone.',
          },
          {
            title: 'Dynamic Cyan & Amber Laser Guidelines',
            description: 'Live cyan dashed laser guides with circular reticles render for port alignment; amber dashed laser guides project across the factory floor for center axis alignment.',
          },
          {
            title: 'Touch Snap Mode HUD Toggle',
            description: 'Added a dedicated Snap: ON / OFF touch toggle button beside the belt selector and in Settings, allowing instant one-tap control.',
          },
        ],
      },
      {
        category: '📐 Standardized Port Heights & Straight Belts',
        items: [
          {
            title: 'Standardized 24px Grid Machine Proportions',
            description: 'Single-port machines (Miner, Smelter, Constructor, Storage, Deposit) normalized to 144px height (port at +96px); multi-port machines (Assembler, Splitter, Merger) normalized to 168px height (+72px, +96px, +120px).',
          },
          {
            title: '100% Straight Collinear Belts',
            description: 'Horizontally aligned machines connect with clean 2-point straight conveyor belts with zero stair-stepping, unnecessary kinks, or detour jogs.',
          },
        ],
      },
      {
        category: '📊 Belt HUD & In-Transit Telemetry Polish',
        items: [
          {
            title: 'Always-Visible Elevated Belt HUD',
            description: 'Belt telemetry badges and in-transit percentage HUD now render at top z-index, preventing badges from disappearing under machine nodes when placed close together.',
          },
          {
            title: 'Consistent In-Transit Drag Telemetry',
            description: 'Fixed an issue where in-transit progress badges flickered or disappeared while actively dragging machines around.',
          },
          {
            title: 'Strictly Upright Item Icons',
            description: 'Resource items on conveyor belts now remain strictly upright without tilting 90 degrees sideways on vertical belt segments.',
          },
        ],
      },
      {
        category: '🔄 Conveyor Routing & Travel Physics',
        items: [
          {
            title: 'Loop Detour Elimination',
            description: 'Fixed routing pathfinder to eliminate spurious upward circular loops when connected nodes are placed in close vertical proximity.',
          },
          {
            title: 'Physical Transit Speed Preservation',
            description: 'Preserved physical conveyor speed rules and transit delays on close-quarters vertical connections without forgetting belt transfer rates.',
          },
        ],
      },
      {
        category: '📱 Mobile-First Controls & Game Polish',
        items: [
          {
            title: 'Complete Desktop Keyboard Purge',
            description: 'Removed all desktop keydown listeners ([Esc], [Q], [Delete], [1-4]) and purged all keyboard shortcut hint badges across UI menus for a clean mobile-first touch UX.',
          },
          {
            title: 'FICSIT Labs Rebranding',
            description: 'Updated application title, header emblem, and metadata to FICSIT Labs.',
          },
          {
            title: 'Starter Map Collision Adjustment',
            description: 'Relocated starter copper deposit to prevent physical overlap with the Starter HUB.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.10',
    tag: '0.0.10 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '📦 Android In-Place Updates & Keystore',
        items: [
          {
            title: 'Permanent Signing Keystore',
            description: 'Fixed update failure by binding a permanent cryptographic signing key across all GitHub builds, allowing seamless updates without uninstalling.',
          },
          {
            title: 'Auto-Incrementing Version Code',
            description: 'Automated Android versionCode directly from package.json so the package installer recognizes each release as an update.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.09',
    tag: '0.0.09 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '🎛️ Minimal HUD & Corner Controls',
        items: [
          {
            title: 'Compact Belt Selector Button',
            description: 'Replaced wide bottom bar with a small bottom-left button (Mk.X) that opens an upward flyout tab of all belt tiers (Mk.1–Mk.6).',
          },
          {
            title: 'Active Button State',
            description: 'Belt trigger button stays visible at all times and turns bright amber while its tab is open.',
          },
          {
            title: 'Tap-Anywhere Dismissal',
            description: 'Tapping anywhere on the screen immediately closes the belt tab.',
          },
          {
            title: 'Bottom-Right Build Button',
            description: 'Moved Build button to the bottom-right corner as a compact icon button with small "build" text underneath.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.08',
    tag: '0.0.08 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '⚡ Conveyor Belt Polish',
        items: [
          {
            title: 'Belt Tier Icon on Badges',
            description: 'Belt telemetry now displays the conveyor belt tier icon instead of the resource item icon.',
          },
          {
            title: 'Cleaner Badge Format',
            description: 'Removed the speed (m/s) and /m suffix. Badges now read cleanly: [Belt Icon] Mk.2 · 60/120.',
          },
          {
            title: 'No Belt Dots on Far Zoom',
            description: 'Removed oversized blue/white dots when zoomed out far. Belts remain clean at macro view.',
          },
        ],
      },
      {
        category: '🧹 Cleanup',
        items: [
          {
            title: 'Removed Blade Runners',
            description: 'Stripped unused pioneer movement speeds (bladeRunnersKmh, speedKmh) from all code and UI.',
          },
        ],
      },
      {
        category: '📖 In-Game Patch Notes',
        items: [
          {
            title: 'In-App Changelog',
            description: 'View clean, quick-read update notes anytime directly in the game.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.07',
    tag: '0.0.07 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '🔄 Satisfactory Conveyor Belts',
        items: [
          {
            title: 'Tight Item Queues',
            description: 'Items pack tightly bumper-to-bumper (1.2m spacing) on belts running at 100% capacity.',
          },
          {
            title: 'Accurate Belt Speeds',
            description: 'Calibrated item movement to official speeds (Mk.1 @ 1.2 m/s up to Mk.6 @ 24 m/s).',
          },
          {
            title: 'Industrial Roller Belts',
            description: 'Animated 16px wide industrial roller belts with elevated telemetry badges.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.06',
    tag: '0.0.06 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '⚡ Logistics & Transit Delay',
        items: [
          {
            title: '6 Conveyor Tiers (Mk.1 – Mk.6)',
            description: 'Capacities of 60, 120, 270, 480, 780, and 1,200 items/min.',
          },
          {
            title: 'Physical Travel Delay',
            description: 'Items physically travel across distance; destination machines wait for items before producing.',
          },
          {
            title: 'In-Place Belt Upgrades',
            description: 'Quick-equip belt bar and one-tap upgrades for belts attached to machines.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.05',
    tag: '0.0.05 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '🗺️ World & Map Expansion',
        items: [
          {
            title: '12,000 × 8,000 Sector 01 Map',
            description: 'Expanded world with 32 scattered resource deposits across geological clusters.',
          },
          {
            title: 'Purity Tiers & Map Pins',
            description: 'Green for Pure (120/m), Orange for Normal (60/m), Red for Impure (30/m).',
          },
          {
            title: '0.25x Macro Zoom Threshold',
            description: 'Full machine cards remain visible until zooming past 0.25x.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.04',
    tag: '0.0.04 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '⛏️ Natural Resource Deposits',
        items: [
          {
            title: 'Planetary Deposit Nodes',
            description: 'Replaced buildable deposits with fixed natural planetary resource deposits.',
          },
          {
            title: 'Official Satisfactory Icons',
            description: 'Integrated 13 official item icons and 8 building icons from the Satisfactory Wiki.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.03',
    tag: '0.0.03 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '📱 Mobile & Visuals',
        items: [
          {
            title: 'Macro Icon Boxes',
            description: 'Low-overhead clean icon cards when zooming far out for smooth 60 FPS.',
          },
          {
            title: 'Android Game Mode',
            description: 'Widescreen landscape with immersive sticky fullscreen for mobile play.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.02',
    tag: '0.0.02 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '🔍 Camera Controls',
        items: [
          {
            title: 'Bounded World & Zooming',
            description: 'Pinch-to-zoom, mouse wheel zoom, and double-tap-and-drag camera navigation.',
          },
        ],
      },
    ],
  },
  {
    version: '0.0.01',
    tag: '0.0.01 dev build',
    date: '2026-11-02',
    categories: [
      {
        category: '🚀 Foundation',
        items: [
          {
            title: 'Initial Release',
            description: 'Factory node graph, build menu, save/load manager, and automation engine.',
          },
        ],
      },
    ],
  },
];
