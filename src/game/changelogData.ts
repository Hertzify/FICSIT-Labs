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
