export type GameState = 'title' | 'playing' | 'paused';

export type ConveyorLineStyle = 'orthogonal';
export type TouchWiringMode = 'drag' | 'tap' | 'both';

export type PerformanceMode = 'high' | 'battery_saver';

export interface SettingsConfig {
  conveyorStyle: ConveyorLineStyle;
  gridSnap: boolean;
  snapMode: boolean; // Satisfactory-style magnetic port & center alignment with laser guidelines
  gridSize: number; // 24 px default
  uiScale: number; // 0.85 to 1.15
  showPortRates: boolean; // Toggle item rate numbers on port dots
  performanceMode?: PerformanceMode; // 'high' (default) or 'battery_saver' (1.0x DPR & zero shadow overhead for low-end devices)
  wiringMode: TouchWiringMode; // Drag vs Tap-to-Tap
  skipMainMenu: boolean; // Option to skip main menu directly to latest save
  masterVolume: number; // 0 to 100
  sfxVolume: number; // 0 to 100
  muted: boolean;
  hapticsEnabled: boolean; // Android vibration toggle
  autoSaveEnabled: boolean;
  autoSaveIntervalSec: number; // 30s default
}

export type BuildCategory = 'special' | 'production' | 'logistics' | 'organization';

export interface RecipeIngredient {
  itemId: string;
  itemName: string;
  ratePerMin: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  machineType: string;
  cycleTimeSec: number;
  inputs: RecipeIngredient[];
  outputs: RecipeIngredient[];
}

export type ResourcePurity = 'impure' | 'normal' | 'pure';

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildCategory;
  subcategory: string;
  description: string;
  accentColor: string;
  width: number;
  height: number;
  inputPortCount: number;
  outputPortCount: number;
  defaultRecipeId: string | null;
  availableRecipeIds: string[];
  powerMw: number;
  buildable?: boolean;
}

export interface PortSocket {
  id: string;
  index: number;
  side: 'input' | 'output';
  label: string;
  itemName: string | null;
  targetRatePerMin: number;
  actualRatePerMin: number;
  bufferedCount?: number; // Current items stored in this port's internal slot
  maxBuffer?: number; // Satisfactory 1-stack capacity limit for this port (100, 200, or 500)
}

export type MachineStatus = 'optimal' | 'working' | 'waiting' | 'starved' | 'backed_up' | 'idle';

export interface MachineNode {
  id: string;
  buildingId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  recipeId: string | null;
  purity?: ResourcePurity;
  isWorldDeposit?: boolean;
  status: MachineStatus;
  efficiency: number; // 0..100 integer
  progress: number; // 0..1 animation progress
  storedCount: number; // Current items in primary building storage (output buffer or container slots)
  maxStoredCount?: number; // Maximum storage capacity (1 stack for machines, 24 stacks for containers)
  inputs: PortSocket[];
  outputs: PortSocket[];
}

export type ConveyorBeltTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface ConveyorBeltTierDef {
  tier: ConveyorBeltTier;
  id: string;
  name: string;
  shortLabel: string;
  capacityPerMin: number;
  speedMetersPerSec: number; // Belt movement speed (1.2, 2.4, 5.4, 9.6, 15.6, 24.0 m/s)
  speedPxPerSec: number; // World pixel speed (1m = 15px, 1.2m item footprint = 18px)
  accentColor: string;
  ingredientName: string;
  unlockTier: string;
  description: string;
}

export interface BeltItemPacket {
  id: string;
  itemName: string;
  distancePx: number; // 0 .. lengthPx along the belt path
}

export interface ConveyorConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  beltTier?: ConveyorBeltTier; // 1 = 60/m, 2 = 120/m, 3 = 270/m, 4 = 480/m, 5 = 780/m, 6 = 1200/m
  itemName: string | null;
  ratePerMin: number; // Delivered throughput arriving at the destination input port
  sourceRatePerMin?: number; // Rate entering the belt at the source output port
  maxCapacityPerMin: number;
  lengthPx?: number; // Physical belt path length in world pixels
  travelTimeSec?: number; // Time in seconds for an item to travel from output port to input port
  spawnAccumulator?: number; // 0..1 fractional item spawn progress at belt entrance
  inFlightItems?: BeltItemPacket[]; // Discrete physical items currently traveling along the belt
  firstItemArrived?: boolean; // True once the leading item packet has physically reached the destination port
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface SaveSlot {
  id: string;
  sessionName: string;
  slotName: string;
  kind: 'manual' | 'autosave';
  updatedAt: number;
  nodes: MachineNode[];
  connections: ConveyorConnection[];
  camera: CameraState;
}
