import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BuildMenuModal } from './components/BuildMenuModal';
import { MainMenu } from './components/MainMenu';
import { NodeCanvas } from './components/NodeCanvas';
import { SaveLoadModal } from './components/SaveLoadModal';
import { SettingsModal } from './components/SettingsModal';
import { playSynthSfx } from './game/audio';
import { CONVEYOR_BELT_TIER_LIST, CONVEYOR_BELT_TIERS } from './game/catalog';
import { getBuildingIconUrl } from './game/icons';
import {
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
  const [activeSlot, setActiveSlot] = useState<SaveSlot>(() => {
    const initialSlots = loadSaveSlots();
    return initialSlots[0];
  });

  const [gameState, setGameState] = useState<GameState>(() => {
    const initialSettings = loadSettings();
    const initialSlots = loadSaveSlots();
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('autostart') === '1' ||
      (initialSettings.skipMainMenu && initialSlots.length > 0)
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

  // Mutable refs for 60fps canvas engine and DOM interaction
  const beltContainerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<MachineNode[]>(activeSlot.nodes);
  const connectionsRef = useRef<ConveyorConnection[]>(activeSlot.connections);
  const cameraRef = useRef<CameraState>({ ...activeSlot.camera });

  // Mirror state to document.body.dataset.state & CSS variable --ui-scale
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  }, [settings.uiScale]);

  const hydrateSlotIntoEngine = useCallback((slot: SaveSlot) => {
    nodesRef.current = slot.nodes.map((n) => ({
      ...n,
      inputs: n.inputs.map((p) => ({ ...p })),
      outputs: n.outputs.map((p) => ({ ...p })),
    }));
    connectionsRef.current = slot.connections.map((c) => ({ ...c }));
    cameraRef.current = { ...slot.camera };
    setActiveSlot(slot);
  }, []);

  const handleUpdateSettings = (next: SettingsConfig) => {
    setSettings(next);
    saveSettings(next);
    playSynthSfx('click', next);
  };

  // Trigger Auto-Save helper
  const triggerSessionAutoSave = useCallback(
    (showBadge = true) => {
      if (!settings.autoSaveEnabled) return;
      const { slots: updatedSlots } = upsertAutoSaveForSession(
        saveSlots,
        activeSlot.sessionName,
        nodesRef.current,
        connectionsRef.current,
        cameraRef.current
      );
      setSaveSlots(updatedSlots);
      if (showBadge) {
        setAutoSaveNotice('Auto-Saved');
      }
    },
    [settings.autoSaveEnabled, saveSlots, activeSlot.sessionName]
  );

  useEffect(() => {
    if (!autoSaveNotice) return;
    const t = window.setTimeout(() => setAutoSaveNotice(null), 2200);
    return () => window.clearTimeout(t);
  }, [autoSaveNotice]);

  // Periodic Auto-Save Interval while playing
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (gameState === 'title') {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !showSettingsModal &&
          !saveLoadModalMode
        ) {
          e.preventDefault();
          const latest = saveSlots[0];
          if (latest) {
            hydrateSlotIntoEngine(latest);
            setGameState('playing');
          }
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (showBeltTab) {
          setShowBeltTab(false);
          return;
        }
        if (pendingBuildId) {
          setPendingBuildId(null);
          return;
        }
        if (showBuildMenu) {
          setShowBuildMenu(false);
          return;
        }
        if (showSettingsModal) {
          setShowSettingsModal(false);
          return;
        }
        if (saveLoadModalMode) {
          setSaveLoadModalMode(null);
          return;
        }
        setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (gameState === 'playing' && (e.key === 'q' || e.key === 'Q' || e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setShowBuildMenu((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    showBeltTab,
    showBuildMenu,
    showSettingsModal,
    saveLoadModalMode,
    pendingBuildId,
    saveSlots,
    hydrateSlotIntoEngine,
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
    window.addEventListener('mousedown', handleGlobalDismiss);
    window.addEventListener('touchstart', handleGlobalDismiss);
    window.addEventListener('click', handleGlobalDismiss);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalDismiss);
      window.removeEventListener('mousedown', handleGlobalDismiss);
      window.removeEventListener('touchstart', handleGlobalDismiss);
      window.removeEventListener('click', handleGlobalDismiss);
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
    const newSlot: SaveSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionName: activeSlot.sessionName,
      slotName,
      kind: 'manual',
      updatedAt: Date.now(),
      nodes: nodesRef.current,
      connections: connectionsRef.current,
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
    const overwritten: SaveSlot = {
      ...target,
      updatedAt: Date.now(),
      nodes: nodesRef.current,
      connections: connectionsRef.current,
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
          {/* Top-Left Session Name & Pause Menu Button */}
          <div
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top left' }}
            className="fixed top-2.5 left-3 pointer-events-auto flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => {
                playSynthSfx('click', settings);
                setGameState('paused');
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] border border-[#26334D] text-xs font-display font-bold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Menu</span>
              <span className="text-[10px] font-mono text-slate-400">[Esc]</span>
            </button>

            <button
              type="button"
              onClick={() => {
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
                        setAutoSaveNotice(`Belt: ${bt.name} (${bt.capacityPerMin}/m)`);
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
                        {bt.capacityPerMin}/m
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Small Belt Selector Trigger Button (Always visible, changes color when tab is shown) */}
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
          </div>

          {/* Bottom-Right Small Build Button (Icon on top, small "build" text below) */}
          <div
            style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
            className="fixed bottom-3 right-3 pointer-events-auto z-20"
          >
            <button
              type="button"
              aria-label="Build Menu [Q]"
              title="Build Menu [Q]"
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
