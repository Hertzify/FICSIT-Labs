/**
 * MODULE INDEX (`src/components/CanvasOverlays.tsx`)
 * -----------------------------------------------------------------------------
 * Floating HUD banners, multi-select/waypoint action bars, and connected
 * NodeInspectorPanel & BeltInspectorPanel mutation handlers for `NodeCanvas`.
 *
 * Line Map:
 * - [L20–L65]   `CopiedMachineSettings` & `CanvasOverlaysProps` interfaces
 * - [L67–L165]  Floating Top Action Bars (Waypoint Corner Dot, Multi-Selection, Placement Banner, Tap-to-Tap Port Banner)
 * - [L167–L415] Connected `NodeInspectorPanel` (recipe, overclock, standby, copy/paste, buffer fill/flush, belt upgrade, unwire, dismantle)
 * - [L417–L515] Connected `BeltInspectorPanel` (tier upgrade, clear items, reset route, dismantle belt) + Bottom Status Toast
 */

import React from 'react';
import { playSynthSfx } from '../game/audio';
import { BUILDINGS } from '../game/catalog';
import { factoryHistory } from '../game/history';
import {
  changeNodeRecipe,
  invalidateAllConveyorCaches,
  stepSimulation,
  upgradeConveyorBeltTier,
} from '../game/rules';
import {
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { BeltInspectorPanel } from './BeltInspectorPanel';
import { NodeInspectorPanel } from './NodeInspectorPanel';

export interface CopiedMachineSettings {
  buildingId: string;
  recipeId: string | null;
  clockSpeedPct: number;
  powerShards: number;
  isStandby: boolean;
}

export interface CanvasOverlaysProps {
  mode: 'background' | 'interactive';
  settings: SettingsConfig;
  nodesRef: React.MutableRefObject<MachineNode[]>;
  connectionsRef: React.MutableRefObject<ConveyorConnection[]>;
  selectedWaypoint: { connId: string; index: number } | null;
  setSelectedWaypoint: React.Dispatch<
    React.SetStateAction<{ connId: string; index: number } | null>
  >;
  selectedNodeIds: string[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedNodeSnapshot: MachineNode | null;
  setSelectedNodeSnapshot: React.Dispatch<React.SetStateAction<MachineNode | null>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedConnectionSnapshot: ConveyorConnection | null;
  setSelectedConnectionSnapshot: React.Dispatch<
    React.SetStateAction<ConveyorConnection | null>
  >;
  setSelectedConnectionId: React.Dispatch<React.SetStateAction<string | null>>;
  pendingBuildId: string | null;
  onClearPendingBuild: () => void;
  tapSourcePort: { nodeId: string; portId: string; label: string } | null;
  setTapSourcePort: React.Dispatch<
    React.SetStateAction<{ nodeId: string; portId: string; label: string } | null>
  >;
  copiedMachineSettings: CopiedMachineSettings | null;
  setCopiedMachineSettings: React.Dispatch<
    React.SetStateAction<CopiedMachineSettings | null>
  >;
  statusToast: string | null;
  showToast: (msg: string) => void;
  dismantleSelectedWaypoint: () => void;
  dismantleSelectedGroup: () => void;
  onGraphMutated: () => void;
  drawNow: () => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  mode,
  settings,
  nodesRef,
  connectionsRef,
  selectedWaypoint,
  setSelectedWaypoint,
  selectedNodeIds,
  setSelectedNodeIds,
  selectedNodeSnapshot,
  setSelectedNodeSnapshot,
  setSelectedNodeId,
  selectedConnectionSnapshot,
  setSelectedConnectionSnapshot,
  setSelectedConnectionId,
  pendingBuildId,
  onClearPendingBuild,
  tapSourcePort,
  setTapSourcePort,
  copiedMachineSettings,
  setCopiedMachineSettings,
  statusToast,
  showToast,
  dismantleSelectedWaypoint,
  dismantleSelectedGroup,
  onGraphMutated,
  drawNow,
}) => {
  // Helper to run steady-state telemetry propagation immediately after any mutation
  const syncTelemetryAndRedraw = (refreshNodeId?: string | null) => {
    const simRes = stepSimulation(nodesRef.current, connectionsRef.current, 0);
    nodesRef.current = simRes.nodes;
    connectionsRef.current = simRes.connections;
    if (refreshNodeId) {
      const updated = nodesRef.current.find((n) => n.id === refreshNodeId) ?? null;
      setSelectedNodeSnapshot(updated ? { ...updated } : null);
    }
    onGraphMutated();
    drawNow();
  };

  return (
    <>
      {/* Selected Corner Dot Floating Action Bar (Mobile-first Touch Bar) */}
      {mode === 'interactive' && selectedWaypoint && selectedNodeIds.length <= 1 && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E1524]/95 border border-amber-500/80 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>CORNER #{selectedWaypoint.index + 1}</span>
          </div>
          <button
            type="button"
            onClick={dismantleSelectedWaypoint}
            className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Dismantle Dot
          </button>
          <button
            type="button"
            onClick={() => setSelectedWaypoint(null)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      )}

      {/* Multi-Selection Floating Action Bar (Mobile-first Touch Bar) */}
      {mode === 'interactive' && selectedNodeIds.length > 1 && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E1524]/95 border border-amber-500/80 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{selectedNodeIds.length} SELECTED</span>
          </div>
          <button
            type="button"
            onClick={dismantleSelectedGroup}
            className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Dismantle All
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedNodeIds([]);
              setSelectedNodeId(null);
            }}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 transition-all"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Placement Mode Banner */}
      {mode === 'interactive' && pendingBuildId && BUILDINGS[pendingBuildId] && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#131B2E] border border-amber-500/70 shadow-xl"
        >
          <span className="text-xs font-medium text-amber-300 whitespace-nowrap">
            Tap inside Sector 01 to place{' '}
            <strong className="font-display text-white">
              {BUILDINGS[pendingBuildId].name}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClearPendingBuild}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tap-to-Tap Active Port Prompt */}
      {mode === 'interactive' && tapSourcePort && !pendingBuildId && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#131B2E] border border-cyan-500/70 shadow-xl"
        >
          <span className="text-xs text-cyan-200 whitespace-nowrap">
            Wiring Output ({tapSourcePort.label}) · Tap any Input Port
          </span>
          <button
            type="button"
            onClick={() => setTapSourcePort(null)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selected Machine Node / Natural Deposit Inspector Popover */}
      {mode === 'interactive' && selectedNodeSnapshot && (
        <NodeInspectorPanel
          node={selectedNodeSnapshot}
          nodes={nodesRef.current}
          settings={settings}
          onClose={() => setSelectedNodeId(null)}
          onSelectRecipe={(rId) => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Change Recipe'
            );
            nodesRef.current = nodesRef.current.map((n) =>
              n.id === selectedNodeSnapshot.id ? changeNodeRecipe(n, rId) : n
            );
            playSynthSfx('click', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
          }}
          onUpdateOverclock={(clockSpeedPct, powerShards) => {
            nodesRef.current = nodesRef.current.map((n) =>
              n.id === selectedNodeSnapshot.id
                ? { ...n, clockSpeedPct, powerShards }
                : n
            );
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
          }}
          onToggleStandby={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Toggle Machine Standby'
            );
            nodesRef.current = nodesRef.current.map((n) =>
              n.id === selectedNodeSnapshot.id
                ? { ...n, isStandby: !n.isStandby }
                : n
            );
            playSynthSfx('click', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
            const updated =
              nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ?? null;
            showToast(
              updated?.isStandby
                ? `${updated.title} switched to STANDBY`
                : `${updated?.title ?? 'Machine'} resumed operation`
            );
          }}
          onCopySettings={() => {
            setCopiedMachineSettings({
              buildingId: selectedNodeSnapshot.buildingId,
              recipeId: selectedNodeSnapshot.recipeId,
              clockSpeedPct: selectedNodeSnapshot.clockSpeedPct ?? 100,
              powerShards: selectedNodeSnapshot.powerShards ?? 0,
              isStandby: Boolean(selectedNodeSnapshot.isStandby),
            });
            playSynthSfx('click', settings);
            showToast(`Copied settings from ${selectedNodeSnapshot.title}`);
          }}
          hasCopiedSettings={Boolean(copiedMachineSettings)}
          onPasteSettings={() => {
            if (!copiedMachineSettings) return;
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Paste Machine Settings'
            );
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              const canApplyRecipe =
                copiedMachineSettings.buildingId === n.buildingId &&
                copiedMachineSettings.recipeId &&
                copiedMachineSettings.recipeId !== n.recipeId &&
                n.buildingId !== 'miner_mk1';
              const baseNode = canApplyRecipe
                ? changeNodeRecipe(n, copiedMachineSettings.recipeId)
                : n;
              return {
                ...baseNode,
                clockSpeedPct: copiedMachineSettings.clockSpeedPct,
                powerShards: copiedMachineSettings.powerShards,
                isStandby: copiedMachineSettings.isStandby,
              };
            });
            playSynthSfx('place', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
            showToast(
              `Pasted settings (${copiedMachineSettings.clockSpeedPct}% Clock Speed)`
            );
          }}
          onFlushBuffer={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Flush Machine Storage'
            );
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              return {
                ...n,
                inputStoredCount: 0,
                storedCount: 0,
                inputs: n.inputs.map((p) => ({ ...p, bufferedCount: 0 })),
                outputs: n.outputs.map((p) => ({ ...p, bufferedCount: 0 })),
              };
            });
            playSynthSfx('click', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
            showToast('Flushed internal input & output storages');
          }}
          onFillInputBuffer={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Fill Machine Input Storage'
            );
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              const isPassThrough =
                n.buildingId === 'storage_container' ||
                n.buildingId === 'the_hub' ||
                n.buildingId === 'splitter' ||
                n.buildingId === 'merger';
              const maxOut = n.maxStoredCount ?? 100;
              const filledInputs = n.inputs.map((p) => {
                const pMax = p.maxBuffer ?? 100;
                return { ...p, bufferedCount: pMax };
              });
              const totalIn = filledInputs.reduce(
                (acc, p) => acc + (p.bufferedCount ?? 0),
                0
              );
              return {
                ...n,
                progress: 0,
                inputStoredCount: totalIn,
                storedCount: isPassThrough ? maxOut : n.storedCount,
                inputs: filledInputs,
                outputs: isPassThrough
                  ? n.outputs.map((p) => ({ ...p, bufferedCount: maxOut }))
                  : n.outputs,
              };
            });
            playSynthSfx('click', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
            showToast('Filled node input storage to 100%');
          }}
          onFillOutputBuffer={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Fill Machine Output Storage'
            );
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              const maxOut = n.maxStoredCount ?? 100;
              return {
                ...n,
                progress: 0,
                storedCount: maxOut,
                outputs: n.outputs.map((p) => ({ ...p, bufferedCount: maxOut })),
              };
            });
            playSynthSfx('click', settings);
            syncTelemetryAndRedraw(selectedNodeSnapshot.id);
            showToast('Filled node output storage to 100%');
          }}
        />
      )}

      {/* Selected Conveyor Belt Inspector Popover */}
      {mode === 'interactive' &&
        selectedConnectionSnapshot &&
        !selectedNodeSnapshot && (
          <BeltInspectorPanel
            connection={selectedConnectionSnapshot}
            nodes={nodesRef.current}
            settings={settings}
            onClose={() => setSelectedConnectionId(null)}
            onUpgradeBeltTier={(tier, shortLabel, capacityPerMin) => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                `Upgrade Belt to ${shortLabel}`
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? upgradeConveyorBeltTier(c, tier)
                  : c
              );
              syncTelemetryAndRedraw(null);
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(
                updated
                  ? {
                      ...updated,
                      inFlightItems: updated.inFlightItems?.map((p) => ({
                        ...p,
                      })),
                    }
                  : null
              );
              playSynthSfx('place', settings);
              showToast(
                `Upgraded belt to ${shortLabel} (${capacityPerMin}/m)`
              );
            }}
            onClearBeltItems={() => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Clear Belt Items'
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? { ...c, inFlightItems: [], isBackedUp: false }
                  : c
              );
              syncTelemetryAndRedraw(null);
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(updated ? { ...updated } : null);
              playSynthSfx('click', settings);
              showToast('Cleared in-transit items from conveyor belt');
            }}
            onResetWaypoints={() => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Reset Conveyor Route'
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? { ...c, waypoints: undefined }
                  : c
              );
              invalidateAllConveyorCaches();
              syncTelemetryAndRedraw(null);
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(updated ? { ...updated } : null);
              playSynthSfx('click', settings);
              showToast('Reset belt route to default orthogonal path');
            }}
            onDismantleBelt={() => {
              const targetId = selectedConnectionSnapshot.id;
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Dismantle Conveyor Belt'
              );
              connectionsRef.current = connectionsRef.current.filter(
                (c) => c.id !== targetId
              );
              invalidateAllConveyorCaches();
              setSelectedConnectionId(null);
              playSynthSfx('disconnect', settings);
              syncTelemetryAndRedraw(null);
              showToast('Conveyor belt dismantled');
            }}
          />
        )}

      {statusToast && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-[#131B2E] border border-[#26334D] text-xs text-slate-200 shadow-lg pointer-events-none whitespace-nowrap">
          {statusToast}
        </div>
      )}
    </>
  );
};
