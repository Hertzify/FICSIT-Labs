export type GameState = 'title' | 'playing' | 'paused';

export type ConveyorLineStyle = 'bezier' | 'orthogonal';
export type TouchWiringMode = 'drag' | 'tap' | 'both';

export interface SettingsConfig {
  conveyorStyle: ConveyorLineStyle;
  gridSnap: boolean;
  gridSize: number; // 24 px default
  uiScale: number; // 0.85 to 1.15
  showPortRates: boolean; // Toggle item rate numbers on port dots
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
}

export type MachineStatus = 'optimal' | 'working' | 'starved' | 'backed_up' | 'idle';

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
  storedCount: number; // For storage container / HUB
  inputs: PortSocket[];
  outputs: PortSocket[];
}

export interface ConveyorConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  itemName: string | null;
  ratePerMin: number;
  maxCapacityPerMin: number;
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
