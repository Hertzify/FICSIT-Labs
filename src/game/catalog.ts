import {
  BuildingDef,
  BuildCategory,
  ConveyorBeltTier,
  ConveyorBeltTierDef,
  RecipeDef,
} from './types';

export const BUILD_CATEGORIES: { id: BuildCategory; label: string; subtitle: string }[] = [
  { id: 'special', label: 'Special', subtitle: 'FICSIT Command & Milestones' },
  { id: 'production', label: 'Production', subtitle: 'Resource Deposits, Miners & Processors' },
  { id: 'logistics', label: 'Logistics', subtitle: 'Conveyor Belts Mk.1–Mk.6, Splitters & Mergers' },
  { id: 'organization', label: 'Organization', subtitle: 'Storage Buffers & Depot Sinks' },
];

/**
 * Official Satisfactory Conveyor Belt Tiers (Mk.1 – Mk.6).
 * Each item on a belt occupies 1.2 meters (18 world px at 15 px/m).
 * At 100% capacity, items are tightly squeezed bumper-to-bumper (18 px pitch)
 * and move at the belt's m/s pace:
 * - Mk.1 (60/m = 1/s):    1.2 m/s  -> 18 px/s
 * - Mk.2 (120/m = 2/s):   2.4 m/s  -> 36 px/s
 * - Mk.3 (270/m = 4.5/s): 5.4 m/s  -> 81 px/s
 * - Mk.4 (480/m = 8/s):   9.6 m/s  -> 144 px/s
 * - Mk.5 (780/m = 13/s):  15.6 m/s -> 234 px/s
 * - Mk.6 (1200/m = 20/s): 24.0 m/s -> 360 px/s
 */
export const PIXELS_PER_METER = 15;
export const BELT_ITEM_LENGTH_METERS = 1.2;
export const BELT_ITEM_FOOTPRINT_PX = 18; // 1.2m * 15 px/m = 18px tight bumper-to-bumper item spacing

export const CONVEYOR_BELT_TIERS: Record<ConveyorBeltTier, ConveyorBeltTierDef> = {
  1: {
    tier: 1,
    id: 'conveyor_belt_mk1',
    name: 'Conveyor Belt Mk.1',
    shortLabel: 'Mk.1',
    capacityPerMin: 60,
    speedMetersPerSec: 1.2,
    speedPxPerSec: 18,
    accentColor: '#94A3B8',
    ingredientName: 'Iron Plate',
    unlockTier: 'Tier 0 (HUB Upgrade 4)',
    description:
      'Transports up to 60 resources/min between factory nodes. Built with standard Iron Plates.',
  },
  2: {
    tier: 2,
    id: 'conveyor_belt_mk2',
    name: 'Conveyor Belt Mk.2',
    shortLabel: 'Mk.2',
    capacityPerMin: 120,
    speedMetersPerSec: 2.4,
    speedPxPerSec: 36,
    accentColor: '#F59E0B',
    ingredientName: 'Reinforced Iron Plate',
    unlockTier: 'Tier 2 (Logistics Mk.2)',
    description:
      'Transports up to 120 resources/min for Pure resource deposits and dual-smelter lines.',
  },
  3: {
    tier: 3,
    id: 'conveyor_belt_mk3',
    name: 'Conveyor Belt Mk.3',
    shortLabel: 'Mk.3',
    capacityPerMin: 270,
    speedMetersPerSec: 5.4,
    speedPxPerSec: 81,
    accentColor: '#38BDF8',
    ingredientName: 'Steel Beam',
    unlockTier: 'Tier 4 (Logistics Mk.3)',
    description:
      'Transports up to 270 resources/min for medium-range manifold distribution.',
  },
  4: {
    tier: 4,
    id: 'conveyor_belt_mk4',
    name: 'Conveyor Belt Mk.4',
    shortLabel: 'Mk.4',
    capacityPerMin: 480,
    speedMetersPerSec: 9.6,
    speedPxPerSec: 144,
    accentColor: '#818CF8',
    ingredientName: 'Encased Industrial Beam',
    unlockTier: 'Tier 5 (Logistics Mk.4)',
    description:
      'Transports up to 480 resources/min for high-volume regional resource buses.',
  },
  5: {
    tier: 5,
    id: 'conveyor_belt_mk5',
    name: 'Conveyor Belt Mk.5',
    shortLabel: 'Mk.5',
    capacityPerMin: 780,
    speedMetersPerSec: 15.6,
    speedPxPerSec: 234,
    accentColor: '#A855F7',
    ingredientName: 'Aluminum Casing',
    unlockTier: 'Tier 7 (Logistics Mk.5)',
    description:
      'Transports up to 780 resources/min across cross-sector factory networks.',
  },
  6: {
    tier: 6,
    id: 'conveyor_belt_mk6',
    name: 'Conveyor Belt Mk.6',
    shortLabel: 'Mk.6',
    capacityPerMin: 1200,
    speedMetersPerSec: 24.0,
    speedPxPerSec: 360,
    accentColor: '#EC4899',
    ingredientName: 'Fused Modular Frame',
    unlockTier: 'Tier 9 (Peak Efficiency)',
    description:
      'Transports up to 1,200 resources/min for maximum-throughput production lines.',
  },
};

export const CONVEYOR_BELT_TIER_LIST: ConveyorBeltTierDef[] = [
  CONVEYOR_BELT_TIERS[1],
  CONVEYOR_BELT_TIERS[2],
  CONVEYOR_BELT_TIERS[3],
  CONVEYOR_BELT_TIERS[4],
  CONVEYOR_BELT_TIERS[5],
  CONVEYOR_BELT_TIERS[6],
];

/**
 * Official Satisfactory Item Stack Sizes & Storage Slot Counts:
 * - 100 items/stack: Ores, Ingots, Reinforced Iron Plates, Rotors
 * - 200 items/stack: Iron Plates, Iron Rods, Cables
 * - 500 items/stack: Wire, Concrete, Screws
 * - Production Machines: 1 stack per input port + 1 stack per output port
 * - Storage Container / HUB Terminal: 24 inventory slots (24 * stack size)
 */
export const STORAGE_CONTAINER_SLOTS = 24;

export const ITEM_STACK_SIZES: Record<string, number> = {
  iron_ore: 100,
  'iron ore': 100,
  copper_ore: 100,
  'copper ore': 100,
  limestone: 100,
  iron_ingot: 100,
  'iron ingot': 100,
  copper_ingot: 100,
  'copper ingot': 100,
  iron_plate: 200,
  'iron plate': 200,
  iron_rod: 200,
  'iron rod': 200,
  wire: 500,
  'copper wire': 500,
  cable: 200,
  'insulated cable': 200,
  concrete: 500,
  screw: 500,
  screws: 500,
  reinforced_plate: 100,
  'reinforced plate': 100,
  'reinforced iron plate': 100,
  rotor: 100,
  'modular rotor': 100,
};

export function getItemStackSize(itemIdOrName?: string | null): number {
  if (!itemIdOrName) return 100;
  const key = itemIdOrName.trim().toLowerCase();
  if (ITEM_STACK_SIZES[key]) {
    return ITEM_STACK_SIZES[key];
  }
  if (key.includes('screw') || key.includes('wire') || key.includes('concrete')) {
    return 500;
  }
  if (key.includes('plate') && !key.includes('reinforced')) {
    return 200;
  }
  if (key.includes('rod') || key.includes('cable')) {
    return 200;
  }
  return 100;
}

export function getBuildingMaxStorage(
  buildingId: string,
  recipeId?: string | null,
  itemName?: string | null
): number {
  if (buildingId === 'storage_container' || buildingId === 'the_hub') {
    return STORAGE_CONTAINER_SLOTS * getItemStackSize(itemName);
  }
  if (buildingId === 'splitter' || buildingId === 'merger') {
    return 9; // Satisfactory internal 9-item routing buffer
  }
  if (buildingId === 'resource_deposit') {
    return 100;
  }
  const recipe = recipeId ? RECIPES[recipeId] : null;
  const outItem =
    recipe?.outputs[0]?.itemId ??
    recipe?.outputs[0]?.itemName ??
    itemName ??
    null;
  return getItemStackSize(outItem);
}

/**
 * Official Satisfactory Overclocking Rules (1% – 250%):
 * - 0 Power Shards: 1% to 100% clock speed
 * - 1 Power Shard:  up to 150% clock speed
 * - 2 Power Shards: up to 200% clock speed
 * - 3 Power Shards: up to 250% clock speed
 * - Production rate scales linearly: baseRate * (clockSpeedPct / 100)
 * - Cycle duration scales inversely: baseCycleSec / (clockSpeedPct / 100)
 * - Power consumption scales exponentially: baseMw * (clockSpeedPct / 100) ^ 1.321928
 */
export const OVERCLOCK_POWER_EXPONENT = 1.321928;

export function getMaxClockSpeedPct(powerShards = 0): number {
  const clampedShards = Math.min(3, Math.max(0, Math.floor(powerShards || 0)));
  return 100 + clampedShards * 50;
}

export function getRequiredPowerShards(clockSpeedPct = 100): number {
  if (clockSpeedPct <= 100) return 0;
  if (clockSpeedPct <= 150) return 1;
  if (clockSpeedPct <= 200) return 2;
  return 3;
}

export function clampClockSpeedPct(clockSpeedPct = 100, powerShards = 0): number {
  const maxClock = getMaxClockSpeedPct(powerShards);
  const raw = Number.isFinite(clockSpeedPct) ? clockSpeedPct : 100;
  const clamped = Math.min(maxClock, Math.max(1, raw));
  return Math.round(clamped * 10) / 10;
}

export function getScaledRatePerMin(baseRatePerMin: number, clockSpeedPct = 100): number {
  const scaled = baseRatePerMin * (Math.max(1, clockSpeedPct) / 100);
  return Math.round(scaled * 10) / 10;
}

export function getScaledCycleTimeSec(baseCycleSec: number, clockSpeedPct = 100): number {
  const ratio = Math.max(0.01, clockSpeedPct / 100);
  return Number((baseCycleSec / ratio).toFixed(2));
}

export function getBuildingPowerMw(
  buildingId: string,
  clockSpeedPct = 100,
  isStandby = false
): number {
  const bDef = BUILDINGS[buildingId];
  const baseMw = bDef?.powerMw ?? 0;
  if (baseMw <= 0) return 0;
  if (isStandby) return 0.1;
  const ratio = Math.max(0.01, clockSpeedPct / 100);
  return Number((baseMw * Math.pow(ratio, OVERCLOCK_POWER_EXPONENT)).toFixed(1));
}


export const RECIPES: Record<string, RecipeDef> = {
  // Resource Deposits (Raw Nodes)
  deposit_iron: {
    id: 'deposit_iron',
    name: 'Pure Iron Vein',
    machineType: 'resource_deposit',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'iron_ore', itemName: 'Iron Ore', ratePerMin: 60 }],
  },
  deposit_copper: {
    id: 'deposit_copper',
    name: 'Pure Copper Vein',
    machineType: 'resource_deposit',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'copper_ore', itemName: 'Copper Ore', ratePerMin: 60 }],
  },
  deposit_limestone: {
    id: 'deposit_limestone',
    name: 'Limestone Deposit',
    machineType: 'resource_deposit',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'limestone', itemName: 'Limestone', ratePerMin: 60 }],
  },

  // Miner Mk.1 Recipes (Extracts directly from underlying deposit without input belt)
  mine_iron: {
    id: 'mine_iron',
    name: 'Extract Iron Ore',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'iron_ore', itemName: 'Iron Ore', ratePerMin: 60 }],
  },
  mine_copper: {
    id: 'mine_copper',
    name: 'Extract Copper Ore',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'copper_ore', itemName: 'Copper Ore', ratePerMin: 60 }],
  },
  mine_limestone: {
    id: 'mine_limestone',
    name: 'Extract Limestone',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [],
    outputs: [{ itemId: 'limestone', itemName: 'Limestone', ratePerMin: 60 }],
  },

  // Smelter Recipes
  smelt_iron: {
    id: 'smelt_iron',
    name: 'Iron Ingot',
    machineType: 'smelter',
    cycleTimeSec: 2.0,
    inputs: [{ itemId: 'iron_ore', itemName: 'Iron Ore', ratePerMin: 30 }],
    outputs: [{ itemId: 'iron_ingot', itemName: 'Iron Ingot', ratePerMin: 30 }],
  },
  smelt_copper: {
    id: 'smelt_copper',
    name: 'Copper Ingot',
    machineType: 'smelter',
    cycleTimeSec: 2.0,
    inputs: [{ itemId: 'copper_ore', itemName: 'Copper Ore', ratePerMin: 30 }],
    outputs: [{ itemId: 'copper_ingot', itemName: 'Copper Ingot', ratePerMin: 30 }],
  },

  // Constructor Recipes
  construct_iron_plate: {
    id: 'construct_iron_plate',
    name: 'Iron Plate',
    machineType: 'constructor',
    cycleTimeSec: 6.0,
    inputs: [{ itemId: 'iron_ingot', itemName: 'Iron Ingot', ratePerMin: 30 }],
    outputs: [{ itemId: 'iron_plate', itemName: 'Iron Plate', ratePerMin: 20 }],
  },
  construct_iron_rod: {
    id: 'construct_iron_rod',
    name: 'Iron Rod',
    machineType: 'constructor',
    cycleTimeSec: 4.0,
    inputs: [{ itemId: 'iron_ingot', itemName: 'Iron Ingot', ratePerMin: 15 }],
    outputs: [{ itemId: 'iron_rod', itemName: 'Iron Rod', ratePerMin: 15 }],
  },
  construct_screws: {
    id: 'construct_screws',
    name: 'Screws',
    machineType: 'constructor',
    cycleTimeSec: 6.0,
    inputs: [{ itemId: 'iron_rod', itemName: 'Iron Rod', ratePerMin: 10 }],
    outputs: [{ itemId: 'screw', itemName: 'Screws', ratePerMin: 40 }],
  },
  construct_wire: {
    id: 'construct_wire',
    name: 'Copper Wire',
    machineType: 'constructor',
    cycleTimeSec: 4.0,
    inputs: [{ itemId: 'copper_ingot', itemName: 'Copper Ingot', ratePerMin: 15 }],
    outputs: [{ itemId: 'wire', itemName: 'Wire', ratePerMin: 30 }],
  },
  construct_cable: {
    id: 'construct_cable',
    name: 'Insulated Cable',
    machineType: 'constructor',
    cycleTimeSec: 2.0,
    inputs: [{ itemId: 'wire', itemName: 'Wire', ratePerMin: 60 }],
    outputs: [{ itemId: 'cable', itemName: 'Cable', ratePerMin: 30 }],
  },
  construct_concrete: {
    id: 'construct_concrete',
    name: 'Concrete',
    machineType: 'constructor',
    cycleTimeSec: 4.0,
    inputs: [{ itemId: 'limestone', itemName: 'Limestone', ratePerMin: 45 }],
    outputs: [{ itemId: 'concrete', itemName: 'Concrete', ratePerMin: 15 }],
  },

  // Assembler Recipes
  assemble_reinforced_plate: {
    id: 'assemble_reinforced_plate',
    name: 'Reinforced Iron Plate',
    machineType: 'assembler',
    cycleTimeSec: 12.0,
    inputs: [
      { itemId: 'iron_plate', itemName: 'Iron Plate', ratePerMin: 30 },
      { itemId: 'screw', itemName: 'Screws', ratePerMin: 60 },
    ],
    outputs: [{ itemId: 'reinforced_plate', itemName: 'Reinforced Plate', ratePerMin: 5 }],
  },
  assemble_rotor: {
    id: 'assemble_rotor',
    name: 'Modular Rotor',
    machineType: 'assembler',
    cycleTimeSec: 15.0,
    inputs: [
      { itemId: 'iron_rod', itemName: 'Iron Rod', ratePerMin: 20 },
      { itemId: 'screw', itemName: 'Screws', ratePerMin: 100 },
    ],
    outputs: [{ itemId: 'rotor', itemName: 'Rotor', ratePerMin: 4 }],
  },
};

export const BUILDINGS: Record<string, BuildingDef> = {
  the_hub: {
    id: 'the_hub',
    name: 'The HUB Terminal',
    category: 'special',
    subcategory: 'Core Command',
    description: 'Central FICSIT Pioneer logistics terminal. Receives processed parts into your factory storage network.',
    accentColor: '#F59E0B',
    width: 268,
    height: 168,
    inputPortCount: 2,
    outputPortCount: 0,
    defaultRecipeId: null,
    availableRecipeIds: [],
    powerMw: 0,
  },
  resource_deposit: {
    id: 'resource_deposit',
    name: 'Resource Deposit',
    category: 'production',
    subcategory: 'Natural World Deposit',
    description: 'Permanent planetary mineral vein outcrop generated on the sector terrain. Build a Miner Mk.1 directly on top of this deposit to extract raw ore based on node purity (Impure 30/m, Normal 60/m, Pure 120/m).',
    accentColor: '#10B981',
    width: 268,
    height: 144,
    inputPortCount: 0,
    outputPortCount: 0,
    defaultRecipeId: 'deposit_iron',
    availableRecipeIds: [],
    powerMw: 0,
    buildable: false,
  },
  miner_mk1: {
    id: 'miner_mk1',
    name: 'Miner Mk.1',
    category: 'production',
    subcategory: 'Extractors',
    description: 'Built directly on top of a Resource Deposit to extract solid ore into its output buffer at rates governed by deposit purity (30, 60, or 120/min).',
    accentColor: '#F59E0B',
    width: 268,
    height: 144,
    inputPortCount: 0,
    outputPortCount: 1,
    defaultRecipeId: 'mine_iron',
    availableRecipeIds: ['mine_iron', 'mine_copper', 'mine_limestone'],
    powerMw: 5,
  },
  smelter: {
    id: 'smelter',
    name: 'Smelter',
    category: 'production',
    subcategory: 'Smelters',
    description: 'Smelts raw ore into pure metal ingots at 30 items/min.',
    accentColor: '#F97316',
    width: 268,
    height: 144,
    inputPortCount: 1,
    outputPortCount: 1,
    defaultRecipeId: 'smelt_iron',
    availableRecipeIds: ['smelt_iron', 'smelt_copper'],
    powerMw: 4,
  },
  constructor: {
    id: 'constructor',
    name: 'Constructor',
    category: 'production' as BuildCategory,
    subcategory: 'Manufacturers',
    description: 'Shapes a single ingot or mineral input into structural plates, rods, wire, or concrete.',
    accentColor: '#06B6D4',
    width: 268,
    height: 144,
    inputPortCount: 1,
    outputPortCount: 1,
    defaultRecipeId: 'construct_iron_plate',
    availableRecipeIds: [
      'construct_iron_plate',
      'construct_iron_rod',
      'construct_screws',
      'construct_wire',
      'construct_cable',
      'construct_concrete',
    ],
    powerMw: 4,
  },
  assembler: {
    id: 'assembler',
    name: 'Assembler',
    category: 'production',
    subcategory: 'Manufacturers',
    description: 'Combines two distinct input parts into advanced intermediate components.',
    accentColor: '#3B82F6',
    width: 276,
    height: 168,
    inputPortCount: 2,
    outputPortCount: 1,
    defaultRecipeId: 'assemble_reinforced_plate',
    availableRecipeIds: ['assemble_reinforced_plate', 'assemble_rotor'],
    powerMw: 15,
  },
  splitter: {
    id: 'splitter',
    name: 'Conveyor Splitter',
    category: 'logistics',
    subcategory: 'Flow Routing',
    description: 'Divides incoming conveyor throughput evenly across up to three connected output lines.',
    accentColor: '#A855F7',
    width: 248,
    height: 168,
    inputPortCount: 1,
    outputPortCount: 3,
    defaultRecipeId: null,
    availableRecipeIds: [],
    powerMw: 0,
  },
  merger: {
    id: 'merger',
    name: 'Conveyor Merger',
    category: 'logistics',
    subcategory: 'Flow Routing',
    description: 'Combines up to three incoming conveyor lines into a single consolidated output stream.',
    accentColor: '#8B5CF6',
    width: 248,
    height: 168,
    inputPortCount: 3,
    outputPortCount: 1,
    defaultRecipeId: null,
    availableRecipeIds: [],
    powerMw: 0,
  },
  storage_container: {
    id: 'storage_container',
    name: 'Storage Container',
    category: 'organization',
    subcategory: 'Storage',
    description: 'Buffers incoming parts and passes surplus flow through its output port.',
    accentColor: '#14B8A6',
    width: 260,
    height: 144,
    inputPortCount: 1,
    outputPortCount: 1,
    defaultRecipeId: null,
    availableRecipeIds: [],
    powerMw: 0,
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDINGS).filter(
  (b) => b.buildable !== false
);

export const PURITY_CONFIG: Record<
  'impure' | 'normal' | 'pure',
  { label: string; multiplier: number; ratePerMin: number; badgeColor: string }
> = {
  impure: {
    label: 'IMPURE',
    multiplier: 0.5,
    ratePerMin: 30,
    badgeColor: '#EF4444',
  },
  normal: {
    label: 'NORMAL',
    multiplier: 1.0,
    ratePerMin: 60,
    badgeColor: '#F97316',
  },
  pure: {
    label: 'PURE',
    multiplier: 2.0,
    ratePerMin: 120,
    badgeColor: '#22C55E',
  },
};

export { SECTOR_01_DEPOSIT_SPECS, type WorldDepositSpec } from './sectorMapData';


