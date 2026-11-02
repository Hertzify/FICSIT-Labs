import { createStarterFactory } from './rules';
import { SaveSlot, SettingsConfig } from './types';

const SETTINGS_KEY = 'ficsit_node_labs_settings_v1';
const SAVES_KEY = 'ficsit_node_labs_saves_v1';

export const DEFAULT_SETTINGS: SettingsConfig = {
  conveyorStyle: 'bezier',
  gridSnap: true,
  gridSize: 24,
  uiScale: 1.0,
  showPortRates: true,
  wiringMode: 'both',
  skipMainMenu: false,
  masterVolume: 75,
  sfxVolume: 80,
  muted: false,
  hapticsEnabled: true,
  autoSaveEnabled: true,
  autoSaveIntervalSec: 30,
};

export function loadSettings(): SettingsConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: SettingsConfig): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function createInitialSeedSaveSlot(
  sessionName = 'Rocky Desert Sector 01',
  withStarterNodes = true
): SaveSlot {
  const starter = withStarterNodes
    ? createStarterFactory()
    : { nodes: [], connections: [] };
  return {
    id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sessionName,
    slotName: 'Initial Deployment',
    kind: 'manual',
    updatedAt: Date.now(),
    nodes: starter.nodes,
    connections: starter.connections,
    camera: { x: 36, y: 120, zoom: 0.76 },
  };
}

export function loadSaveSlots(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) {
      const seed = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
      localStorage.setItem(SAVES_KEY, JSON.stringify([seed]));
      return [seed];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
      localStorage.setItem(SAVES_KEY, JSON.stringify([seed]));
      return [seed];
    }
    return parsed.sort((a: SaveSlot, b: SaveSlot) => b.updatedAt - a.updatedAt);
  } catch {
    const seed = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
    return [seed];
  }
}

export function persistSaveSlots(slots: SaveSlot[]): SaveSlot[] {
  const sorted = [...slots].sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore quota issues
  }
  return sorted;
}

export function upsertSaveSlot(slots: SaveSlot[], slot: SaveSlot): SaveSlot[] {
  const existingIdx = slots.findIndex((s) => s.id === slot.id);
  const next = [...slots];
  if (existingIdx >= 0) {
    next[existingIdx] = { ...slot, updatedAt: Date.now() };
  } else {
    next.unshift({ ...slot, updatedAt: Date.now() });
  }
  return persistSaveSlots(next);
}

export function upsertAutoSaveForSession(
  slots: SaveSlot[],
  sessionName: string,
  nodes: SaveSlot['nodes'],
  connections: SaveSlot['connections'],
  camera: SaveSlot['camera']
): { slots: SaveSlot[]; autoSlot: SaveSlot } {
  const existingAuto = slots.find(
    (s) => s.sessionName === sessionName && s.kind === 'autosave'
  );
  const autoSlot: SaveSlot = {
    id: existingAuto ? existingAuto.id : `autosave_${sessionName.replace(/\s+/g, '_').toLowerCase()}`,
    sessionName,
    slotName: 'Auto-Save',
    kind: 'autosave',
    updatedAt: Date.now(),
    nodes,
    connections,
    camera,
  };
  const next = upsertSaveSlot(slots, autoSlot);
  return { slots: next, autoSlot };
}

export function deleteSaveSlotById(slots: SaveSlot[], slotId: string): SaveSlot[] {
  const filtered = slots.filter((s) => s.id !== slotId);
  return persistSaveSlots(filtered);
}
