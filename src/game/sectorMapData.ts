/**
 * ============================================================================
 * MODULE INDEX: Sector 01 Planetary Resource Map (`src/game/sectorMapData.ts`)
 * ============================================================================
 * [Lines 015-025] WorldDepositSpec             - Interface for static terrain mineral nodes
 * [Lines 027-315] SECTOR_01_DEPOSIT_SPECS      - 32 geological deposits across the 12000x8000 map:
 *   - West Rocky Desert (lines 032-194)
 *   - Starter Basin Ridge (lines 130-194, includes `starter_deposit` at 2544, 2784)
 *   - Central Plateau & Southern Canyon (lines 196-275)
 *   - Eastern Frontier Highlands (lines 277-315)
 * ============================================================================
 */

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
  // WEST ROCKY DESERT
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
    x: 4560,
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
