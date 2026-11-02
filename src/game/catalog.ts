import { BuildingDef, BuildCategory, RecipeDef } from './types';

export const BUILD_CATEGORIES: { id: BuildCategory; label: string; subtitle: string }[] = [
  { id: 'special', label: 'Special', subtitle: 'FICSIT Command & Milestones' },
  { id: 'production', label: 'Production', subtitle: 'Resource Deposits, Miners & Processors' },
  { id: 'logistics', label: 'Logistics', subtitle: 'Splitters, Mergers & Flow Routing' },
  { id: 'organization', label: 'Organization', subtitle: 'Storage Buffers & Depot Sinks' },
];

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

  // Miner Mk.1 Recipes
  mine_iron: {
    id: 'mine_iron',
    name: 'Extract Iron Ore',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [{ itemId: 'iron_ore', itemName: 'Iron Ore', ratePerMin: 60 }],
    outputs: [{ itemId: 'iron_ore', itemName: 'Iron Ore', ratePerMin: 60 }],
  },
  mine_copper: {
    id: 'mine_copper',
    name: 'Extract Copper Ore',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [{ itemId: 'copper_ore', itemName: 'Copper Ore', ratePerMin: 60 }],
    outputs: [{ itemId: 'copper_ore', itemName: 'Copper Ore', ratePerMin: 60 }],
  },
  mine_limestone: {
    id: 'mine_limestone',
    name: 'Extract Limestone',
    machineType: 'miner_mk1',
    cycleTimeSec: 1.0,
    inputs: [{ itemId: 'limestone', itemName: 'Limestone', ratePerMin: 60 }],
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
    cycleTimeSec: 3.0,
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
    name: 'Resource Node',
    category: 'production',
    subcategory: 'Natural World Deposit',
    description: 'Permanent planetary mineral vein generated on the sector map. Connect its output port to a Miner Mk.1 to extract raw ore based on node purity (Impure 30/m, Normal 60/m, Pure 120/m).',
    accentColor: '#10B981',
    width: 248,
    height: 136,
    inputPortCount: 0,
    outputPortCount: 1,
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
    description: 'Extracts solid ore from a connected Resource Deposit at a base rate of 60 items/min.',
    accentColor: '#F59E0B',
    width: 268,
    height: 140,
    inputPortCount: 1,
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
    height: 140,
    inputPortCount: 1,
    outputPortCount: 1,
    defaultRecipeId: 'smelt_iron',
    availableRecipeIds: ['smelt_iron', 'smelt_copper'],
    powerMw: 4,
  },
  constructor: {
    id: 'constructor',
    name: 'Constructor',
    category: 'production',
    subcategory: 'Manufacturers',
    description: 'Shapes a single ingot or mineral input into structural plates, rods, wire, or concrete.',
    accentColor: '#06B6D4',
    width: 268,
    height: 142,
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
    height: 176,
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
    height: 188,
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
    height: 188,
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
    height: 140,
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

export interface WorldDepositSpec {
  id: string;
  title: string;
  recipeId: 'deposit_iron' | 'deposit_copper' | 'deposit_limestone';
  purity: 'impure' | 'normal' | 'pure';
  x: number;
  y: number;
}

/**
 * 32 Natural Planetary Resource Nodes scattered in authentic Satisfactory-style
 * geological clusters and solo outcrops across the 12000 x 8000 Sector 01 map.
 */
export const SECTOR_01_DEPOSIT_SPECS: WorldDepositSpec[] = [
  // ============================================================================
  // WEST ROCKY DESERT (Matches attached Satisfactory interactive map screenshot)
  // ============================================================================
  // Solo Pure Limestone Outcrop (Top-Left Forest Clearing)
  {
    id: 'world_dep_limestone_pure_nw',
    title: 'Limestone Node (Pure)',
    recipeId: 'deposit_limestone',
    purity: 'pure',
    x: 960,
    y: 1560,
  },
  // Far-West Ridge Solo Impure Iron
  {
    id: 'world_dep_iron_impure_fw1',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 432,
    y: 2760,
  },
  // Southwest Twin Impure Iron Vein
  {
    id: 'world_dep_iron_impure_sw1',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 384,
    y: 3960,
  },
  {
    id: 'world_dep_iron_impure_sw2',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 648,
    y: 4128,
  },

  // North-West Cliff Cluster (3x Tight Impure Iron Nodes)
  {
    id: 'world_dep_iron_impure_nw1',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 2064,
    y: 1056,
  },
  {
    id: 'world_dep_iron_impure_nw2',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 2376,
    y: 912,
  },
  {
    id: 'world_dep_iron_impure_nw3',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 2352,
    y: 1224,
  },

  // Upper Canyon Ridge (2x Impure Iron + 1x Normal Limestone + 1x Normal Copper)
  {
    id: 'world_dep_iron_impure_uc1',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 3168,
    y: 1704,
  },
  {
    id: 'world_dep_iron_impure_uc2',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 3456,
    y: 1536,
  },
  {
    id: 'world_dep_limestone_normal_uc1',
    title: 'Limestone Node (Normal)',
    recipeId: 'deposit_limestone',
    purity: 'normal',
    x: 3744,
    y: 1272,
  },
  {
    id: 'world_dep_copper_normal_uc1',
    title: 'Copper Node (Normal)',
    recipeId: 'deposit_copper',
    purity: 'normal',
    x: 4272,
    y: 1080,
  },

  // Starter Basin Ridge (3x Normal Iron Cluster + 2x Impure Limestone + 2x Impure Iron + 1x Normal Copper)
  {
    id: 'world_dep_limestone_impure_st1',
    title: 'Limestone Node (Impure)',
    recipeId: 'deposit_limestone',
    purity: 'impure',
    x: 1944,
    y: 2736,
  },
  {
    id: 'starter_deposit',
    title: 'Iron Node (Normal)',
    recipeId: 'deposit_iron',
    purity: 'normal',
    x: 2544,
    y: 2784,
  },
  {
    id: 'world_dep_iron_normal_st2',
    title: 'Iron Node (Normal)',
    recipeId: 'deposit_iron',
    purity: 'normal',
    x: 2376,
    y: 2976,
  },
  {
    id: 'world_dep_iron_normal_st3',
    title: 'Iron Node (Normal)',
    recipeId: 'deposit_iron',
    purity: 'normal',
    x: 2688,
    y: 3144,
  },
  {
    id: 'world_dep_limestone_impure_st2',
    title: 'Limestone Node (Impure)',
    recipeId: 'deposit_limestone',
    purity: 'impure',
    x: 3264,
    y: 3384,
  },
  {
    id: 'world_dep_iron_impure_st4',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 3648,
    y: 3672,
  },
  {
    id: 'world_dep_iron_impure_st5',
    title: 'Iron Node (Impure)',
    recipeId: 'deposit_iron',
    purity: 'impure',
    x: 3888,
    y: 3840,
  },
  {
    id: 'world_dep_copper_normal_st1',
    title: 'Copper Node (Normal)',
    recipeId: 'deposit_copper',
    purity: 'normal',
    x: 4128,
    y: 2880,
  },

  // ============================================================================
  // CENTRAL PLATEAU & SOUTHERN CANYON (Mid-Map Expansion Clusters)
  // ============================================================================
  // North Central Pure Iron & Copper Outcrop
  {
    id: 'world_dep_iron_pure_nc1',
    title: 'Iron Node (Pure)',
    recipeId: 'deposit_iron',
    purity: 'pure',
    x: 6144,
    y: 1344,
  },
  {
    id: 'world_dep_iron_pure_nc2',
    title: 'Iron Node (Pure)',
    recipeId: 'deposit_iron',
    purity: 'pure',
    x: 6432,
    y: 1488,
  },
  {
    id: 'world_dep_copper_pure_nc1',
    title: 'Copper Node (Pure)',
    recipeId: 'deposit_copper',
    purity: 'pure',
    x: 6816,
    y: 1200,
  },

  // Central Basin Limestone & Copper Triad
  {
    id: 'world_dep_limestone_normal_cb1',
    title: 'Limestone Node (Normal)',
    recipeId: 'deposit_limestone',
    purity: 'normal',
    x: 5856,
    y: 3984,
  },
  {
    id: 'world_dep_copper_normal_cb1',
    title: 'Copper Node (Normal)',
    recipeId: 'deposit_copper',
    purity: 'normal',
    x: 6144,
    y: 4152,
  },
  {
    id: 'world_dep_copper_impure_cb2',
    title: 'Copper Node (Impure)',
    recipeId: 'deposit_copper',
    purity: 'impure',
    x: 6408,
    y: 4032,
  },

  // Southern Dune Valley Cluster
  {
    id: 'world_dep_iron_normal_sd1',
    title: 'Iron Node (Normal)',
    recipeId: 'deposit_iron',
    purity: 'normal',
    x: 2880,
    y: 5904,
  },
  {
    id: 'world_dep_iron_normal_sd2',
    title: 'Iron Node (Normal)',
    recipeId: 'deposit_iron',
    purity: 'normal',
    x: 3168,
    y: 6048,
  },
  {
    id: 'world_dep_limestone_pure_sd1',
    title: 'Limestone Node (Pure)',
    recipeId: 'deposit_limestone',
    purity: 'pure',
    x: 3648,
    y: 6240,
  },

  // ============================================================================
  // EASTERN FRONTIER HIGHLANDS (High-Purity Deep Expedition Nodes)
  // ============================================================================
  {
    id: 'world_dep_iron_pure_ef1',
    title: 'Iron Node (Pure)',
    recipeId: 'deposit_iron',
    purity: 'pure',
    x: 9120,
    y: 2160,
  },
  {
    id: 'world_dep_copper_pure_ef1',
    title: 'Copper Node (Pure)',
    recipeId: 'deposit_copper',
    purity: 'pure',
    x: 9456,
    y: 2352,
  },
  {
    id: 'world_dep_limestone_pure_ef1',
    title: 'Limestone Node (Pure)',
    recipeId: 'deposit_limestone',
    purity: 'pure',
    x: 8928,
    y: 5472,
  },
  {
    id: 'world_dep_iron_pure_ef2',
    title: 'Iron Node (Pure)',
    recipeId: 'deposit_iron',
    purity: 'pure',
    x: 10368,
    y: 5184,
  },
];


