import React, { useState } from 'react';
import { parseSaveImport, serializeSaveExport } from '../game/rules';
import { SaveSlot, SettingsConfig } from '../game/types';
import { APP_BUILD_TAG } from '../game/version';

interface SettingsModalProps {
  settings: SettingsConfig;
  currentSlot: SaveSlot;
  onUpdateSettings: (next: SettingsConfig) => void;
  onImportSaveSlot: (slot: SaveSlot) => void;
  onFactoryReset: () => void;
  onClose: () => void;
}

type SettingsTab = 'visuals' | 'controls' | 'audio' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  currentSlot,
  onUpdateSettings,
  onImportSaveSlot,
  onFactoryReset,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('visuals');
  const [saveCodeBuffer, setSaveCodeBuffer] = useState('');
  const [dataFeedback, setDataFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const updateField = <K extends keyof SettingsConfig>(
    key: K,
    value: SettingsConfig[K]
  ) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleExportCurrentSave = () => {
    const encoded = serializeSaveExport(currentSlot);
    setSaveCodeBuffer(encoded);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(encoded).catch(() => {});
    }
    setDataFeedback('Current factory save JSON exported to box below (and clipboard).');
  };

  const handleImportSave = () => {
    if (!saveCodeBuffer.trim()) {
      setDataFeedback('Paste a valid Save JSON string into the box first.');
      return;
    }
    const res = parseSaveImport(saveCodeBuffer);
    if (res.error || !res.slot) {
      setDataFeedback(res.error ?? 'Invalid save data.');
      return;
    }
    onImportSaveSlot(res.slot);
    setDataFeedback(`Imported session "${res.slot.sessionName}"!`);
  };

  return (
    <div
      role="dialog"
      aria-label="Settings Menu"
      className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-2.5 sm:p-4"
    >
      {/* Widescreen Landscape Sidebar + 2-Column Content Split */}
      <div
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
        className="w-[96vw] max-w-4xl h-[92vh] max-h-[460px] rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl flex flex-row overflow-hidden"
      >
        {/* Left Navigation Sidebar (Saves vertical space on landscape phones) */}
        <div className="w-48 shrink-0 bg-[#0B0F17] border-r border-[#26334D] p-3 flex flex-col justify-between">
          <div>
            <div className="pb-2.5 mb-2.5 border-b border-[#26334D]">
              <h2 className="text-sm font-display font-bold text-white">System Settings</h2>
              <span className="text-[10px] font-mono tabular-nums text-amber-400">
                {APP_BUILD_TAG}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {(
                [
                  { id: 'visuals', label: 'Visuals & Node Cards' },
                  { id: 'controls', label: 'Touch & Startup' },
                  { id: 'audio', label: 'Audio & Haptics' },
                  { id: 'data', label: 'Save & Factory Reset' },
                ] as { id: SettingsTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-display font-semibold text-left whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#131B2E] text-slate-300 hover:text-white border border-[#26334D]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Settings"
            onClick={onClose}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-semibold text-slate-200 hover:text-white whitespace-nowrap"
          >
            Done
          </button>
        </div>

        {/* Right Widescreen Content Pane */}
        <div className="flex-1 p-3.5 overflow-y-auto">
          {activeTab === 'visuals' && (
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Conveyor Line Style: Curved vs 90-Degree */}
              <div className="col-span-2 p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Conveyor Line Routing Style
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Smooth Upload Labs Bezier curves or 90-degree circuit lines
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateField('conveyorStyle', 'bezier')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      settings.conveyorStyle === 'bezier'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#131B2E] text-slate-300 border border-[#26334D]'
                    }`}
                  >
                    Curved Bezier
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('conveyorStyle', 'orthogonal')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      settings.conveyorStyle === 'orthogonal'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#131B2E] text-slate-300 border border-[#26334D]'
                    }`}
                  >
                    90-Degree Circuit
                  </button>
                </div>
              </div>

              {/* 2. Show Port Item Rate Numbers Toggle */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Show Item Rate Numbers on Ports
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Live items/min throughput next to port dots
                  </div>
                </div>
                <input
                  aria-label="Show Item Rate Numbers on Ports"
                  type="checkbox"
                  checked={settings.showPortRates}
                  onChange={(e) => updateField('showPortRates', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* 3. Grid Snapping Toggle */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Blueprint Grid Snapping
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Align machine nodes to 24px blueprint grid
                  </div>
                </div>
                <input
                  aria-label="Blueprint Grid Snapping"
                  type="checkbox"
                  checked={settings.gridSnap}
                  onChange={(e) => updateField('gridSnap', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* 4. UI Scale Slider */}
              <div className="col-span-2 p-3 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="text-xs font-semibold text-white">Interface UI Scale</div>
                    <div className="text-[11px] text-slate-400">
                      Adjust menu and popover sizing for your Android screen
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-bold text-amber-400">
                    {Math.round(settings.uiScale * 100)}%
                  </span>
                </div>
                <input
                  aria-label="Interface UI Scale"
                  type="range"
                  min="0.85"
                  max="1.15"
                  step="0.05"
                  value={settings.uiScale}
                  onChange={(e) => updateField('uiScale', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Touch Wiring Mode: Drag vs Tap-to-Tap */}
              <div className="col-span-2 p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Port Connection Wiring Mode
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Connect output ports to input ports by dragging, tapping, or both
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(
                    [
                      { id: 'both', label: 'Both (Hybrid)' },
                      { id: 'tap', label: 'Tap-to-Tap' },
                      { id: 'drag', label: 'Drag Line' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField('wiringMode', opt.id)}
                      className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        settings.wiringMode === opt.id
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#131B2E] text-slate-300 border border-[#26334D]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Skip Main Menu directly to Latest Save */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Skip Main Menu to Latest Save
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Boot straight into your most recent factory save
                  </div>
                </div>
                <input
                  aria-label="Skip Main Menu Directly to Latest Save"
                  type="checkbox"
                  checked={settings.skipMainMenu}
                  onChange={(e) => updateField('skipMainMenu', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* 3. Auto-Save Toggle */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Automatic Background Auto-Save
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Periodically saves your active factory session
                  </div>
                </div>
                <input
                  aria-label="Automatic Background Auto-Save"
                  type="checkbox"
                  checked={settings.autoSaveEnabled}
                  onChange={(e) => updateField('autoSaveEnabled', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Mute Toggle */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">Mute All Audio</div>
                  <div className="text-[11px] text-slate-400">
                    Silence all synthesized SFX
                  </div>
                </div>
                <input
                  aria-label="Mute All Audio"
                  type="checkbox"
                  checked={settings.muted}
                  onChange={(e) => updateField('muted', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* Android Haptic Vibration Toggle */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Android Haptic Vibration Feedback
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tactile pulses when snapping &amp; wiring
                  </div>
                </div>
                <input
                  aria-label="Android Haptic Vibration Feedback"
                  type="checkbox"
                  checked={settings.hapticsEnabled}
                  onChange={(e) => updateField('hapticsEnabled', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {/* Master Volume Slider */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">Master Volume</span>
                  <span className="font-mono tabular-nums text-xs text-amber-400">
                    {settings.masterVolume}%
                  </span>
                </div>
                <input
                  aria-label="Master Volume"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.masterVolume}
                  onChange={(e) => updateField('masterVolume', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* SFX Volume Slider */}
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">
                    Interface &amp; Conveyor SFX Volume
                  </span>
                  <span className="font-mono tabular-nums text-xs text-amber-400">
                    {settings.sfxVolume}%
                  </span>
                </div>
                <input
                  aria-label="Interface & Conveyor SFX Volume"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.sfxVolume}
                  onChange={(e) => updateField('sfxVolume', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Save Export &amp; Import
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Backup active session as JSON or paste a saved string to import
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportCurrentSave}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-semibold text-amber-300 whitespace-nowrap"
                    >
                      Export Current Save
                    </button>
                    <button
                      type="button"
                      onClick={handleImportSave}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 whitespace-nowrap"
                    >
                      Import Save JSON
                    </button>
                  </div>
                </div>

                <textarea
                  aria-label="Save Data JSON"
                  rows={3}
                  value={saveCodeBuffer}
                  onChange={(e) => setSaveCodeBuffer(e.target.value)}
                  placeholder="Click 'Export Current Save' or paste a save JSON string here..."
                  className="w-full p-2 rounded-lg bg-[#131B2E] border border-[#26334D] font-mono text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                />

                {dataFeedback && (
                  <p className="mt-1.5 text-[11px] text-amber-300">{dataFeedback}</p>
                )}
              </div>

              {/* Factory Reset */}
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-red-200">
                    Factory Reset All Saves &amp; Settings
                  </div>
                  <div className="text-[11px] text-red-300/70">
                    Clears all save slots and restores default settings
                  </div>
                </div>
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-xs font-bold text-white whitespace-nowrap shrink-0"
                  >
                    Factory Reset
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onFactoryReset();
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white whitespace-nowrap"
                    >
                      Confirm Wipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#131B2E] text-xs text-slate-300 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
