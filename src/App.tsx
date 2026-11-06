/**
 * MODULE INDEX (`src/App.tsx`)
 * -----------------------------------------------------------------------------
 * Root application shell managing GameState ('title' | 'playing' | 'paused'),
 * save slot persistence, auto-save intervals, Undo/Redo history triggers, and
 * top/bottom HUD controls (SatisfactoryToolbar, Belt Tier Selector, Build Menu).
 *
 * Line Map:
 * - [L48–L105]  Root state initialization (`settings`, `saveSlots`, `activeSlot`, `gameState`, `nodesRef`, `connectionsRef`, `cameraRef`)
 * - [L107–L175] `hydrateSlotIntoEngine`, `triggerSessionAutoSave`, `handleUndo`, `handleRedo`
 * - [L210–L305] Save/Load & Reset handlers (`handleContinueLatest`, `handleStartNewGame`, `handleCreateManualSave`, `handleDeleteSlot`, `handleFactoryReset`)
 * - [L307–L695] Full-viewport `<NodeCanvas />`, `<MainMenu />`, playing HUD overlays, Pause dialog, and modals
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BuildMenuModal } from './components/BuildMenuModal';
import { MainMenu } from './components/MainMenu';
import { NodeCanvas } from './components/NodeCanvas';
import { SatisfactoryToolbar } from './components/SatisfactoryToolbar';
import { SaveLoadModal } from './components/SaveLoadModal';
import { SettingsModal } from './components/SettingsModal';
import { playSynthSfx } from './game/audio';
import {
  CONVEYOR_BELT_TIER_LIST,
  CONVEYOR_BELT_TIERS,
  formatRatePerMin,
} from './game/catalog';
import { invalidateAllConveyorCaches } from './game/geometry';
import { factoryHistory } from './game/history';
import { getBuildingIconUrl } from './game/icons';
import { stepSimulation } from './game/rules';
import {
  cloneSaveGraph,
  createInitialSeedSaveSlot,
  DEFAULT_SETTINGS,
  deleteSaveSlotById,
  loadSaveSlots,
  loadSettings,
  persistSaveSlots,
  saveSettings,
  upsertAutoSaveForSession,
  upsertSaveSlot,
} from './game/storage';
import {
  ActiveCanvasTool,
  CameraState,
  ConveyorBeltTier,
  ConveyorConnection,
  GameState,
  MachineNode,
  SaveSlot,
  SettingsConfig,
} from './game/types';

export default function App() {
  const [settings, setSettings] = useState<SettingsConfig>(() => loadSettings());
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>(() => loadSaveSlots());
  const [activeSlot, setActiveSlot] = useState<SaveSlot>(
    () => saveSlots[0] ?? createInitialSeedSaveSlot('Rocky Desert Sector 01', true)
  );

  const [gameState, setGameState] = useState<GameState>(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('autostart') === '1' ||
      (settings.skipMainMenu && saveSlots.length > 0)
    ) {
      return 'playing';
    }
    return 'title';
  });

  // Active Modals & Belt Tier Selection
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [saveLoadModalMode, setSaveLoadModalMode] = useState<
    'load' | 'save_and_load' | null
  >(null);
  const [pendingBuildId, setPendingBuildId] = useState<string | null>(null);
  const [activeBeltTier, setActiveBeltTier] = useState<ConveyorBeltTier>(1);
  const [showBeltTab, setShowBeltTab] = useState(false);
  const [autoSaveNotice, setAutoSaveNotice] = useState<string | null>(null);

  // Active Canvas Tool (Upload Labs toolbar controls in Satisfactory style)
  const [activeTool, setActiveTool] = useState<ActiveCanvasTool>('edit');
  const [, setHistoryVersion] = useState<number>(0);

  useEffect(() => {
    return factoryHistory.subscribe(() => {
      setHistoryVersion((v) => v + 1);
    });
  }, []);

  // Mutable refs for 60fps canvas engine and synchronous storage persistence
  const beltContainerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<MachineNode[]>(activeSlot.nodes);
  const connectionsRef = useRef<ConveyorConnection[]>(activeSlot.connections);
  const cameraRef = useRef<CameraState>({ ...activeSlot.camera });
  const saveSlotsRef = useRef<SaveSlot[]>(saveSlots);
  const activeSlotRef = useRef<SaveSlot>(activeSlot);

  useEffect(() => {
    saveSlotsRef.current = saveSlots;
  }, [saveSlots]);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  // Mirror state to document.body.dataset.state & CSS variable --ui-scale
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  }, [settings.uiScale]);

  const hydrateSlotIntoEngine = useCallback((slot: SaveSlot) => {
    const cloned = cloneSaveGraph(slot.nodes, slot.connections);
    nodesRef.current = cloned.nodes;
    connectionsRef.current = cloned.connections;
    cameraRef.current = { ...slot.camera };
    invalidateAllConveyorCaches();
    factoryHistory.clear();
    activeSlotRef.current = slot;
    setActiveSlot(slot);
  }, []);

  const handleUpdateSettings = (next: SettingsConfig) => {
    setSettings(next);
    saveSettings(next);
    playSynthSfx('click', next);
  };

  // Trigger Auto-Save helper: writes synchronously to localStorage AND updates saveSlots + activeSlot
  const triggerSessionAutoSave = useCallback(
    (showBadge = true) => {
      if (!settings.autoSaveEnabled && showBadge) return;
      const curActive = activeSlotRef.current;
      const { slots: updatedSlots, autoSlot } = upsertAutoSaveForSession(
        saveSlotsRef.current,
        curActive.sessionName,
        nodesRef.current,
        connectionsRef.current,
        cameraRef.current,
        curActive.id
      );
      saveSlotsRef.current = updatedSlots;
      setSaveSlots(updatedSlots);
      const syncedCurrent =
        updatedSlots.find((s) => s.id === curActive.id) ?? autoSlot;
      activeSlotRef.current = syncedCurrent;
      setActiveSlot(syncedCurrent);

      if (showBadge && settings.autoSaveEnabled) {
        setAutoSaveNotice('Auto-Saved');
      }
    },
    [settings.autoSaveEnabled]
  );

  const handleUndo = useCallback(() => {
    const res = factoryHistory.undo(nodesRef.current, connectionsRef.current);
    if (!res) return;
    invalidateAllConveyorCaches();
    const simRes = stepSimulation(res.nodes, res.connections, 0);
    nodesRef.current = simRes.nodes;
    connectionsRef.current = simRes.connections;
    playSynthSfx('click', settings);
    setAutoSaveNotice(`Undo: ${res.description}`);
    triggerSessionAutoSave(false);
  }, [settings, triggerSessionAutoSave]);

  const handleRedo = useCallback(() => {
    const res = factoryHistory.redo(nodesRef.current, connectionsRef.current);
    if (!res) return;
    invalidateAllConveyorCaches();
    const simRes = stepSimulation(res.nodes, res.connections, 0);
    nodesRef.current = simRes.nodes;
    connectionsRef.current = simRes.connections;
    playSynthSfx('click', settings);
    setAutoSaveNotice(`Redo: ${res.description}`);
    triggerSessionAutoSave(false);
  }, [settings, triggerSessionAutoSave]);

  useEffect(() => {
    if (!autoSaveNotice) return;
    const t = window.setTimeout(() => setAutoSaveNotice(null), 2200);
    return () => window.clearTimeout(t);
  }, [autoSaveNotice]);

  // Continuous background storage persistence (every 2.5s while playing + on tab hide/unload)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const syncTimer = window.setInterval(() => {
      triggerSessionAutoSave(false);
    }, 2500);

    const handlePersistOnExit = () => {
      triggerSessionAutoSave(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerSessionAutoSave(false);
      }
    };

    window.addEventListener('beforeunload', handlePersistOnExit);
    window.addEventListener('pagehide', handlePersistOnExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener('beforeunload', handlePersistOnExit);
      window.removeEventListener('pagehide', handlePersistOnExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState, triggerSessionAutoSave]);

  // Periodic Auto-Save Badge Notification while playing
  useEffect(() => {
    if (gameState !== 'playing' || !settings.autoSaveEnabled) return;
    const intervalMs = Math.max(10, settings.autoSaveIntervalSec || 30) * 1000;
    const timer = window.setInterval(() => {
      triggerSessionAutoSave(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    gameState,
    settings.autoSaveEnabled,
    settings.autoSaveIntervalSec,
    triggerSessionAutoSave,
  ]);

  // Pressing anywhere in the screen automatically kills the belt tab
  useEffect(() => {
    if (!showBeltTab) return;
    const handleGlobalDismiss = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node) || (beltContainerRef.current && !beltContainerRef.current.contains(target))) {
        setShowBeltTab(false);
      }
    };
    window.addEventListener('pointerdown', handleGlobalDismiss);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalDismiss);
    };
  }, [showBeltTab]);

  const handleContinueLatest = () => {
    const latest = saveSlots[0] ?? activeSlot;
    hydrateSlotIntoEngine(latest);
    playSynthSfx('click', settings);
    setGameState('playing');
  };

  const handleStartNewGame = (sessionName: string, includeStarterNodes: boolean) => {
    const freshSlot = createInitialSeedSaveSlot(sessionName, includeStarterNodes);
    const updated = upsertSaveSlot(saveSlots, freshSlot);
    setSaveSlots(updated);
    hydrateSlotIntoEngine(freshSlot);
    playSynthSfx('place', settings);
    setGameState('playing');
  };

  const handleCreateManualSave = (slotName: string) => {
    const cloned = cloneSaveGraph(nodesRef.current, connectionsRef.current);
    const newSlot: SaveSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionName: activeSlot.sessionName,
      slotName,
      kind: 'manual',
      updatedAt: Date.now(),
      nodes: cloned.nodes,
      connections: cloned.connections,
      camera: { ...cameraRef.current },
    };
    const updated = upsertSaveSlot(saveSlots, newSlot);
    setSaveSlots(updated);
    setActiveSlot(newSlot);
    playSynthSfx('save', settings);
    setAutoSaveNotice(`Saved "${slotName}"`);
  };

  const handleOverwriteSlot = (slotId: string) => {
    const target = saveSlots.find((s) => s.id === slotId);
    if (!target) return;
    const cloned = cloneSaveGraph(nodesRef.current, connectionsRef.current);
    const overwritten: SaveSlot = {
      ...target,
      updatedAt: Date.now(),
      nodes: cloned.nodes,
      connections: cloned.connections,
      camera: { ...cameraRef.current },
    };
    const updated = upsertSaveSlot(saveSlots, overwritten);
    setSaveSlots(updated);
    setActiveSlot(overwritten);
    playSynthSfx('save', settings);
    setAutoSaveNotice(`Updated "${overwritten.slotName}"`);
  };

  const handleDeleteSlot = (slotId: string) => {
    const updated = deleteSaveSlotById(saveSlots, slotId);
    setSaveSlots(updated);
    if (slotId === activeSlot.id && updated[0]) {
      setActiveSlot(updated[0]);
    }
    playSynthSfx('disconnect', settings);
  };

  const handleFactoryReset = () => {
    localStorage.clear();
    const freshSettings = { ...DEFAULT_SETTINGS };
    const seedSlot = createInitialSeedSaveSlot('Rocky Desert Sector 01', true);
    saveSettings(freshSettings);
    persistSaveSlots([seedSlot]);
    setSettings(freshSettings);
    setSaveSlots([seedSlot]);
    hydrateSlotIntoEngine(seedSlot);
    setShowSettingsModal(false);
    setGameState('title');
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B0F17] select-none">
      {/* Full-Viewport 60 FPS Node & Conveyor Canvas */}
      <NodeCanvas
        mode={gameState === 'playing' ? 'interactive' : 'background'}
        nodesRef={nodesRef}
        connectionsRef={connectionsRef}
        cameraRef={cameraRef}
        settings={settings}
        activeBeltTier={activeBeltTier}
        pendingBuildId={pendingBuildId}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearPendingBuild={() => setPendingBuildId(null)}
        onGraphMutated={() => triggerSessionAutoSave(false)}
      />

      {/* STATE 1: SATISFACTORY-STYLE MAIN MENU */}
      {gameState === 'title' && (
        <MainMenu
          latestSlot={saveSlots[0] ?? null}
          saveSlotsCount={saveSlots.length}
          settings={settings}
          onContinueLatest={handleContinueLatest}
          onStartNewGame={handleStartNewGame}
          onOpenLoadGame={() => {
            playSynthSfx('click', settings);
            setSaveLoadModalMode('load');
          }}
          onOpenSettings={() => {
            playSynthSfx('click', settings);
            setShowSettingsModal(true);
          }}
        />
      )}

      {/* STATE 2: PLAYING WORKSPACE CORNER TRIGGERS */}
      {gameState === 'playing' && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          {/* Top-Center Satisfactory Control Toolbar (Edit, Move, Waypoint, Undo, Redo) */}
          <SatisfactoryToolbar
            activeTool={activeTool}
            onSelectTool={(t) => {
              playSynthSfx('click', settings);
              setActiveTool(t);
            }}
            canUndo={factoryHistory.canUndo()}
            canRedo={factoryHistory.canRedo()}
            onUndo={handleUndo}
            onRedo={handleRedo}
            undoDescription={factoryHistory.getUndoDescription()}
            redoDescription={factoryHistory.getRedoDescription()}
            uiScale={settings.uiScale}
          />

          {/* Top-Left Session Name & Pause Menu Button */}
          <div
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top left' }}
            className="fixed top-2.5 left-3 pointer-events-auto flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => {
                triggerSessionAutoSave(false);
                playSynthSfx('click', settings);
                setGameState('paused');
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] border border-[#26334D] text-xs font-display font-bold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Menu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerSessionAutoSave(false);
                playSynthSfx('click', settings);
                setShowSettingsModal(true);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] border border-[#26334D] text-xs font-display font-semibold text-slate-200 shadow-lg whitespace-nowrap"
            >
              Settings
            </button>

            {autoSaveNotice && (
              <span className="px-2.5 py-1 rounded-lg bg-[#131B2E] border border-emerald-500/40 text-[11px] font-mono text-emerald-300 whitespace-nowrap">
                {autoSaveNotice}
              </span>
            )}
          </div>

          {/* Transparent click-catcher to automatically close belt tab on any screen tap */}
          {showBeltTab && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowBeltTab(false)}
              onPointerDown={() => setShowBeltTab(false)}
              aria-hidden="true"
            />
          )}

          {/* Bottom-Left Compact Belt Button & Flyout Tab */}
          <div
            ref={beltContainerRef}
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom left' }}
            className="fixed bottom-3 left-3 pointer-events-auto z-30 flex flex-col items-start"
          >
            {/* Flyout Tab of Conveyor Belts Mk.1 - Mk.6 */}
            {showBeltTab && (
              <div
                role="menu"
                aria-label="Conveyor Belt Tiers"
                className="mb-2 w-48 rounded-xl bg-[#0E1524]/95 backdrop-blur-md border border-[#26334D] p-1.5 shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-[#26334D]/70 flex items-center justify-between">
                  <span>Conveyor Belts</span>
                  <span className="text-amber-400 font-bold">Mk.{activeBeltTier}</span>
                </div>
                {CONVEYOR_BELT_TIER_LIST.map((bt) => {
                  const isSelected = activeBeltTier === bt.tier;
                  const iconUrl = getBuildingIconUrl(bt.id);
                  return (
                    <button
                      key={bt.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        playSynthSfx('click', settings);
                        setActiveBeltTier(bt.tier);
                        setAutoSaveNotice(`Belt: ${bt.name} (${formatRatePerMin(bt.capacityPerMin, settings)})`);
                        setShowBeltTab(false);
                      }}
                      className={`w-full min-h-[34px] px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center justify-between gap-1.5 transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-[#131B2E]/90 text-slate-200 hover:bg-[#1C2742] hover:text-white border border-[#26334D]/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {iconUrl && (
                          <img
                            src={iconUrl}
                            alt={bt.shortLabel}
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        )}
                        <span className="truncate">{bt.shortLabel}</span>
                      </div>
                      <span
                        className={`text-[11px] shrink-0 ${
                          isSelected ? 'text-slate-950 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {formatRatePerMin(bt.capacityPerMin, settings)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom-Left Controls Row: Belt Selector + Satisfactory Snap Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Select Conveyor Belt (Currently Mk.${activeBeltTier})`}
                aria-expanded={showBeltTab}
                onClick={() => {
                  playSynthSfx('click', settings);
                  setShowBeltTab((prev) => !prev);
                }}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl transition-all active:scale-95 border ${
                  showBeltTab
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'bg-[#131B2E] hover:bg-[#1C2742] text-slate-200 hover:text-white border-[#26334D]'
                }`}
              >
                {(() => {
                  const currentBeltDef = CONVEYOR_BELT_TIERS[activeBeltTier];
                  const iconUrl = currentBeltDef ? getBuildingIconUrl(currentBeltDef.id) : null;
                  return (
                    <>
                      {iconUrl && (
                        <img
                          src={iconUrl}
                          alt={`Mk.${activeBeltTier}`}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      <span>Mk.{activeBeltTier}</span>
                    </>
                  );
                })()}
              </button>

              <button
                type="button"
                aria-label={`Toggle Snap Mode (Currently ${settings.snapMode !== false ? 'ON' : 'OFF'})`}
                aria-pressed={settings.snapMode !== false}
                onClick={() => {
                  const nextSnap = settings.snapMode === false;
                  handleUpdateSettings({
                    ...settings,
                    snapMode: nextSnap,
                  });
                  setAutoSaveNotice(
                    nextSnap
                      ? 'Snap Mode: ON (Port & Center Alignment)'
                      : 'Snap Mode: OFF'
                  );
                }}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl transition-all active:scale-95 border whitespace-nowrap ${
                  settings.snapMode !== false
                    ? 'bg-[#131B2E] hover:bg-[#1C2742] text-cyan-300 border-cyan-500/70 shadow-cyan-500/15'
                    : 'bg-[#131B2E]/90 hover:bg-[#1C2742] text-slate-400 border-[#26334D]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    settings.snapMode !== false ? 'bg-cyan-400' : 'bg-slate-500'
                  }`}
                />
                <span>Snap: {settings.snapMode !== false ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Bottom-Right Small Build Button (Icon on top, small "build" text below) */}
          <div
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
            className="fixed bottom-3 right-3 pointer-events-auto z-20"
          >
            <button
              type="button"
              aria-label="Build Menu"
              title="Build Menu"
              onClick={() => {
                playSynthSfx('click', settings);
                setShowBuildMenu(true);
              }}
              className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 shadow-xl shadow-amber-500/20 border border-amber-400/80 flex flex-col items-center justify-center p-1 transition-transform select-none"
            >
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5">
                build
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 3: IN-GAME PAUSE / SYSTEM MENU (Widescreen 2x2 Landscape Layout) */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-label="Pause Menu"
          className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-3"
        >
          <div
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
            className="w-full max-w-md rounded-2xl bg-[#131B2E] border border-[#26334D] p-4 shadow-2xl"
          >
            <div className="pb-2.5 mb-3 border-b border-[#26334D] flex items-center justify-between gap-2">
              <h2 className="text-sm font-display font-bold text-white">
                Factory Paused
              </h2>
              <p className="text-xs font-mono text-slate-400 truncate">
                {activeSlot.sessionName} · {nodesRef.current.length} Nodes
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  playSynthSfx('click', settings);
                  setGameState('playing');
                }}
                className="col-span-2 min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap"
              >
                Resume Factory
              </button>

              <button
                type="button"
                onClick={() => {
                  playSynthSfx('click', settings);
                  setSaveLoadModalMode('save_and_load');
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0F17] hover:bg-[#1C2742] border border-[#26334D] text-white font-display font-semibold text-xs whitespace-nowrap"
              >
                Save / Load Game
              </button>

              <button
                type="button"
                onClick={() => {
                  playSynthSfx('click', settings);
                  setShowSettingsModal(true);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0F17] hover:bg-[#1C2742] border border-[#26334D] text-white font-display font-semibold text-xs whitespace-nowrap"
              >
                Settings
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerSessionAutoSave(false);
                  playSynthSfx('click', settings);
                  setGameState('title');
                }}
                className="col-span-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-[#26334D] text-slate-300 hover:text-white font-display font-semibold text-xs whitespace-nowrap"
              >
                Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUILD MENU MODAL (Satisfactory x Upload Labs) */}
      {showBuildMenu && (
        <BuildMenuModal
          settings={settings}
          activeBeltTier={activeBeltTier}
          onSelectBeltTier={(tier) => {
            playSynthSfx('click', settings);
            setActiveBeltTier(tier);
            setAutoSaveNotice(`Equipped Conveyor Belt Mk.${tier}`);
          }}
          onSelectBuildingToPlace={(buildingId) => {
            playSynthSfx('click', settings);
            setPendingBuildId(buildingId);
            setShowBuildMenu(false);
          }}
          onClose={() => setShowBuildMenu(false)}
        />
      )}

      {/* SAVE & LOAD SLOTS MODAL */}
      {saveLoadModalMode && (
        <SaveLoadModal
          mode={saveLoadModalMode}
          slots={saveSlots}
          activeSlotId={activeSlot.id}
          activeSessionName={activeSlot.sessionName}
          settings={settings}
          onLoadSlot={(slot) => {
            hydrateSlotIntoEngine(slot);
            playSynthSfx('place', settings);
            setSaveLoadModalMode(null);
            setGameState('playing');
          }}
          onCreateManualSave={handleCreateManualSave}
          onOverwriteSlot={handleOverwriteSlot}
          onDeleteSlot={handleDeleteSlot}
          onClose={() => setSaveLoadModalMode(null)}
        />
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          currentSlot={{
            ...activeSlot,
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            camera: cameraRef.current,
          }}
          onUpdateSettings={handleUpdateSettings}
          onImportSaveSlot={(slot) => {
            const updated = upsertSaveSlot(saveSlots, slot);
            setSaveSlots(updated);
            hydrateSlotIntoEngine(slot);
            playSynthSfx('save', settings);
          }}
          onFactoryReset={handleFactoryReset}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </main>
  );
}
