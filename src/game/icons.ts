// Official Satisfactory Wiki Item & Building Icons Cache + Metadata

export const ITEM_ICON_PATHS: Record<string, string> = {
  iron_ore: './icons/items/iron_ore.png',
  copper_ore: './icons/items/copper_ore.png',
  limestone: './icons/items/limestone.png',
  iron_ingot: './icons/items/iron_ingot.png',
  copper_ingot: './icons/items/copper_ingot.png',
  iron_plate: './icons/items/iron_plate.png',
  iron_rod: './icons/items/iron_rod.png',
  screw: './icons/items/screw.png',
  wire: './icons/items/wire.png',
  cable: './icons/items/cable.png',
  concrete: './icons/items/concrete.png',
  reinforced_plate: './icons/items/reinforced_plate.png',
  rotor: './icons/items/rotor.png',
};

export const BUILDING_ICON_PATHS: Record<string, string> = {
  the_hub: './icons/buildings/the_hub.png',
  miner_mk1: './icons/buildings/miner_mk1.png',
  smelter: './icons/buildings/smelter.png',
  constructor: './icons/buildings/constructor.png',
  assembler: './icons/buildings/assembler.png',
  splitter: './icons/buildings/splitter.png',
  merger: './icons/buildings/merger.png',
  storage_container: './icons/buildings/storage_container.png',
  conveyor_belt_mk1: './icons/buildings/conveyor_belt_mk1.png',
  conveyor_belt_mk2: './icons/buildings/conveyor_belt_mk2.png',
  conveyor_belt_mk3: './icons/buildings/conveyor_belt_mk3.png',
  conveyor_belt_mk4: './icons/buildings/conveyor_belt_mk4.png',
  conveyor_belt_mk5: './icons/buildings/conveyor_belt_mk5.png',
  conveyor_belt_mk6: './icons/buildings/conveyor_belt_mk6.png',
};

const NAME_TO_ITEM_ID: Record<string, string> = {
  'iron ore': 'iron_ore',
  'copper ore': 'copper_ore',
  limestone: 'limestone',
  'iron ingot': 'iron_ingot',
  'copper ingot': 'copper_ingot',
  'iron plate': 'iron_plate',
  'iron rod': 'iron_rod',
  screw: 'screw',
  screws: 'screw',
  wire: 'wire',
  'copper wire': 'wire',
  cable: 'cable',
  'insulated cable': 'cable',
  concrete: 'concrete',
  'reinforced plate': 'reinforced_plate',
  'reinforced iron plate': 'reinforced_plate',
  rotor: 'rotor',
  'modular rotor': 'rotor',
};

const ITEM_ACCENT_COLORS: Record<string, string> = {
  iron_ore: '#94A3B8',
  copper_ore: '#F97316',
  limestone: '#E2E8F0',
  iron_ingot: '#CBD5E1',
  copper_ingot: '#FB923C',
  iron_plate: '#38BDF8',
  iron_rod: '#60A5FA',
  screw: '#3B82F6',
  wire: '#EA580C',
  cable: '#06B6D4',
  concrete: '#D6D3D1',
  reinforced_plate: '#818CF8',
  rotor: '#F59E0B',
};

export function resolveItemId(itemIdOrName: string | null | undefined): string | null {
  if (!itemIdOrName) return null;
  const key = itemIdOrName.trim().toLowerCase();
  if (ITEM_ICON_PATHS[key]) return key;
  return NAME_TO_ITEM_ID[key] ?? null;
}

export function getItemIconUrl(itemIdOrName: string | null | undefined): string | null {
  const id = resolveItemId(itemIdOrName);
  return id ? ITEM_ICON_PATHS[id] ?? null : null;
}

export function getItemAccentColor(itemIdOrName: string | null | undefined): string {
  const id = resolveItemId(itemIdOrName);
  return (id && ITEM_ACCENT_COLORS[id]) || '#F59E0B';
}

export function getBuildingIconUrl(
  buildingId: string,
  recipeId?: string | null
): string | null {
  if (buildingId === 'resource_deposit') {
    if (recipeId?.includes('copper')) return ITEM_ICON_PATHS.copper_ore;
    if (recipeId?.includes('limestone')) return ITEM_ICON_PATHS.limestone;
    return ITEM_ICON_PATHS.iron_ore;
  }
  return BUILDING_ICON_PATHS[buildingId] ?? null;
}

const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadImage(src: string | null): HTMLImageElement | null {
  if (!src || typeof Image === 'undefined') return null;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  if (img.complete && img.naturalWidth > 0) {
    return img;
  }
  return null;
}

export function getCanvasItemImage(
  itemIdOrName: string | null | undefined
): HTMLImageElement | null {
  return getOrLoadImage(getItemIconUrl(itemIdOrName));
}

export function getCanvasBuildingImage(
  buildingId: string,
  recipeId?: string | null
): HTMLImageElement | null {
  return getOrLoadImage(getBuildingIconUrl(buildingId, recipeId));
}
