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
