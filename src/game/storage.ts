/**
 * ============================================================================
 * MODULE INDEX: Persistence & Save Slot Manager (`src/game/storage.ts`)
 * ============================================================================
 * [Lines 018-060] DEFAULT_SETTINGS, loadSettings, saveSettings
 * [Lines 062-080] createInitialSeedSaveSlot
 * [Lines 082-150] loadSaveSlots (with legacy coordinate migration & fallback)
 * [Lines 152-198] persistSaveSlots, upsertSaveSlot, upsertAutoSaveForSession, deleteSaveSlotById
 * ============================================================================
 */

import {
  createSectorWorldDeposits,
  createStarterFactory,
  ensureWorldDepositsPresent,
  stepSimulation,
} from './rules';
import { SaveSlot, SettingsConfig } from './types';

const SETTINGS_KEY = 'ficsit_node_labs_settings_v1';
const SAVES_KEY = 'ficsit_node_labs_saves_v1';

export const DEFAULT_SETTINGS: SettingsConfig = {
  conveyorStyle: 'orthogonal',
  gridSnap: true,
  snapMode: true,
  gridSize: 24,
  uiScale: 1.0,
  showPortRates: true,
  rateDisplayFormat: 'per_minute',
  performanceMode: 'high',
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
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const rawGrid = Number(parsed.gridSize);
    const rawScale = Number(parsed.uiScale);
    const rawAutoSaveSec = Number(parsed.autoSaveIntervalSec);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      gridSize: Number.isFinite(rawGrid) && rawGrid >= 12 ? rawGrid : DEFAULT_SETTINGS.gridSize,
      uiScale:
        Number.isFinite(rawScale) && rawScale >= 0.7 && rawScale <= 1.5
          ? rawScale
          : DEFAULT_SETTINGS.uiScale,
      autoSaveIntervalSec:
        Number.isFinite(rawAutoSaveSec) && rawAutoSaveSec >= 5
          ? rawAutoSaveSec
          : DEFAULT_SETTINGS.autoSaveIntervalSec,
      conveyorStyle: 'orthogonal',
      rateDisplayFormat:
        parsed.rateDisplayFormat === 'compact' ? 'compact' : 'per_minute',
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
    : stepSimulation(createSectorWorldDeposits(), [], 0.016);
  return {
    id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sessionName,
    slotName: 'Initial Deployment',
    kind: 'manual',
    updatedAt: Date.now(),
    nodes: starter.nodes,
    connections: starter.connections,
    // Focus initial camera on the Starter Basin cluster at (2544, 2784)
    camera: { x: -1820, y: -1920, zoom: 0.74 },
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
    const validSlots: SaveSlot[] = [];
    for (const rawSlot of parsed) {
      if (!rawSlot || typeof rawSlot !== 'object') continue;
      try {
        const slot = rawSlot as SaveSlot;
        const rawNodes = Array.isArray(slot.nodes)
          ? slot.nodes.filter(
              (n) =>
                Boolean(
                  n &&
                    typeof n === 'object' &&
                    typeof n.id === 'string' &&
                    typeof n.buildingId === 'string' &&
                    Number.isFinite(n.x) &&
                    Number.isFinite(n.y)
                )
            )
          : [];
        const sanitizedInputNodes = rawNodes.map((n) => ({
          ...n,
          x: Number.isFinite(n.x) ? n.x : 2544,
          y: Number.isFinite(n.y) ? n.y : 2784,
          width: Number.isFinite(n.width) && n.width > 0 ? n.width : 192,
          height: Number.isFinite(n.height) && n.height > 0 ? n.height : 120,
          storedCount: Number.isFinite(n.storedCount) ? Math.max(0, n.storedCount!) : 0,
          inputStoredCount: Number.isFinite(n.inputStoredCount)
            ? Math.max(0, n.inputStoredCount!)
            : 0,
          progress: Number.isFinite(n.progress)
            ? Math.min(1, Math.max(0, n.progress!))
            : 0,
          clockSpeedPct:
            Number.isFinite(n.clockSpeedPct) && n.clockSpeedPct! > 0
              ? Math.min(250, Math.max(1, n.clockSpeedPct!))
              : 100,
          inputs: Array.isArray(n.inputs)
            ? n.inputs.map((p, idx) => ({
                ...p,
                id: p?.id || `in-${idx}`,
                bufferedCount: Number.isFinite(p?.bufferedCount)
                  ? Math.max(0, Math.round(p.bufferedCount!))
                  : 0,
              }))
            : [],
          outputs: Array.isArray(n.outputs)
            ? n.outputs.map((p, idx) => ({
                ...p,
                id: p?.id || `out-${idx}`,
                bufferedCount: Number.isFinite(p?.bufferedCount)
                  ? Math.max(0, Math.round(p.bufferedCount!))
                  : 0,
              }))
            : [],
        }));

        const syncedNodes = ensureWorldDepositsPresent(sanitizedInputNodes);
        const legacyMiner = syncedNodes.find(
          (n) => n.id === 'starter_miner' && n.x === 408 && n.y === 216
        );
        let finalNodes = syncedNodes;
        let finalCamera =
          slot.camera &&
          Number.isFinite(slot.camera.x) &&
          Number.isFinite(slot.camera.y) &&
          Number.isFinite(slot.camera.zoom) &&
          slot.camera.zoom > 0.05
            ? slot.camera
            : { x: -1820, y: -1920, zoom: 0.74 };

        if (legacyMiner) {
          const offsets: Record<string, { x: number; y: number }> = {
            starter_miner: { x: 2544, y: 2784 },
            starter_smelter: { x: 2544 + 408, y: 2784 },
            starter_constructor: { x: 2544 + 816, y: 2784 },
            starter_hub: { x: 2544 + 1224, y: 2808 },
          };
          finalNodes = syncedNodes.map((n) =>
            offsets[n.id] ? { ...n, x: offsets[n.id].x, y: offsets[n.id].y } : n
          );
          finalCamera = { x: -1820, y: -1920, zoom: 0.74 };
        }

        const nodeById = new Map(finalNodes.map((n) => [n.id, n]));
        const rawConnections = Array.isArray(slot.connections) ? slot.connections : [];
        const validConns = rawConnections
          .filter((c) => {
            if (!c || typeof c !== 'object') return false;
            const fromN = nodeById.get(c.fromNodeId);
            const toN = nodeById.get(c.toNodeId);
            if (!fromN || !toN) return false;
            if (fromN.buildingId === 'resource_deposit' || toN.buildingId === 'miner_mk1') {
              return false;
            }
            return true;
          })
          .map((c) => ({
            ...c,
            waypoints: Array.isArray(c.waypoints)
              ? c.waypoints
                  .filter(
                    (w) =>
                      Boolean(
                        w &&
                          typeof w === 'object' &&
                          Number.isFinite(w.x) &&
                          Number.isFinite(w.y)
                      )
                  )
                  .slice(0, 16)
              : undefined,
            inFlightItems: Array.isArray(c.inFlightItems)
              ? c.inFlightItems
                  .filter(
                    (pkt) =>
                      Boolean(
                        pkt &&
                          typeof pkt === 'object' &&
                          Number.isFinite(pkt.distancePx) &&
                          pkt.distancePx >= 0
                      )
                  )
                  .slice(0, 300)
              : undefined,
          }));

        // Use dt = 0 so steady-state telemetry and capacities are computed without draining stored items on load
        const sim = stepSimulation(finalNodes, validConns, 0);
        validSlots.push({
          ...slot,
          id: slot.id || `slot_${Date.now()}_${validSlots.length}`,
          sessionName: slot.sessionName || 'Rocky Desert Sector 01',
          slotName: slot.slotName || 'Manual Save',
          kind: slot.kind === 'autosave' ? 'autosave' : 'manual',
          updatedAt: Number.isFinite(slot.updatedAt) ? slot.updatedAt : Date.now(),
          nodes: sim.nodes,
          connections: sim.connections,
          camera: finalCamera,
        });
      } catch {
        // Skip individual corrupted save slot instead of crashing startup
      }
    }

    validSlots.sort((a: SaveSlot, b: SaveSlot) => b.updatedAt - a.updatedAt);

    if (validSlots.length === 0) {
      const seed = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
      localStorage.setItem(SAVES_KEY, JSON.stringify([seed]));
      return [seed];
    }
    return validSlots;
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

export function cloneSaveGraph(
  nodes: SaveSlot['nodes'],
  connections: SaveSlot['connections']
): { nodes: SaveSlot['nodes']; connections: SaveSlot['connections'] } {
  return {
    nodes: nodes.map((n) => {
      const syncedInputs = Array.isArray(n.inputs)
        ? n.inputs.map((p) => ({
            ...p,
            bufferedCount: Math.max(0, Math.round(p.bufferedCount ?? 0)),
          }))
        : [];
      const sumInBuf = syncedInputs.reduce((acc, p) => acc + (p.bufferedCount ?? 0), 0);
      const effectiveInStored = Math.max(Math.round(n.inputStoredCount ?? 0), sumInBuf);
      if (syncedInputs.length > 0 && sumInBuf === 0 && effectiveInStored > 0) {
        syncedInputs[0].bufferedCount = Math.min(
          syncedInputs[0].maxBuffer ?? 100,
          effectiveInStored
        );
      }
      const effectiveOutStored = Math.max(
        0,
        Math.round(Math.max(n.storedCount ?? 0, n.outputs?.[0]?.bufferedCount ?? 0))
      );
      const syncedOutputs = Array.isArray(n.outputs)
        ? n.outputs.map((p, idx) =>
            idx === 0
              ? { ...p, bufferedCount: effectiveOutStored }
              : { ...p, bufferedCount: Math.max(0, Math.round(p.bufferedCount ?? 0)) }
          )
        : [];

      return {
        ...n,
        inputStoredCount: syncedInputs.reduce((acc, p) => acc + (p.bufferedCount ?? 0), 0),
        storedCount: effectiveOutStored,
        inputs: syncedInputs,
        outputs: syncedOutputs,
      };
    }),
    connections: connections.map((c) => ({
      ...c,
      waypoints: c.waypoints ? c.waypoints.map((w) => ({ ...w })) : undefined,
      inFlightItems: c.inFlightItems
        ? c.inFlightItems.map((pkt) => ({ ...pkt }))
        : undefined,
    })),
  };
}

export function upsertSaveSlot(slots: SaveSlot[], slot: SaveSlot): SaveSlot[] {
  const cloned = cloneSaveGraph(slot.nodes, slot.connections);
  const safeSlot: SaveSlot = {
    ...slot,
    updatedAt: Date.now(),
    nodes: cloned.nodes,
    connections: cloned.connections,
    camera: { ...slot.camera },
  };
  const existingIdx = slots.findIndex((s) => s.id === safeSlot.id);
  const next = [...slots];
  if (existingIdx >= 0) {
    next[existingIdx] = safeSlot;
  } else {
    next.unshift(safeSlot);
  }
  return persistSaveSlots(next);
}

export function upsertAutoSaveForSession(
  slots: SaveSlot[],
  sessionName: string,
  nodes: SaveSlot['nodes'],
  connections: SaveSlot['connections'],
  camera: SaveSlot['camera'],
  activeSlotId?: string
): { slots: SaveSlot[]; autoSlot: SaveSlot } {
  const cloned = cloneSaveGraph(nodes, connections);
  const now = Date.now();
  const existingAuto = slots.find(
    (s) => s.sessionName === sessionName && s.kind === 'autosave'
  );
  const autoSlot: SaveSlot = {
    id: existingAuto
      ? existingAuto.id
      : `autosave_${sessionName.replace(/\s+/g, '_').toLowerCase()}`,
    sessionName,
    slotName: 'Auto-Save',
    kind: 'autosave',
    updatedAt: now,
    nodes: cloned.nodes,
    connections: cloned.connections,
    camera: { ...camera },
  };

  // Also keep the active slot (and the session's Initial Deployment slot) synced with live node storages
  // so reloading, continuing, or loading the session's slot never loses machine storages!
  const syncedSlots = slots.map((s) => {
    const isTargetActive = activeSlotId && s.id === activeSlotId && s.id !== autoSlot.id;
    const isInitialDeploymentForSession =
      s.sessionName === sessionName &&
      s.kind === 'manual' &&
      s.slotName === 'Initial Deployment';
    if (!isTargetActive && !isInitialDeploymentForSession) return s;
    const activeClone = cloneSaveGraph(nodes, connections);
    return {
      ...s,
      updatedAt: now - 1,
      nodes: activeClone.nodes,
      connections: activeClone.connections,
      camera: { ...camera },
    };
  });

  const next = upsertSaveSlot(syncedSlots, autoSlot);
  return { slots: next, autoSlot };
}

export function deleteSaveSlotById(slots: SaveSlot[], slotId: string): SaveSlot[] {
  const filtered = slots.filter((s) => s.id !== slotId);
  if (filtered.length === 0) {
    const fallback = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
    return persistSaveSlots([fallback]);
  }
  return persistSaveSlots(filtered);
}

