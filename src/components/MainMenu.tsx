import React, { useState } from 'react';
import { SaveSlot, SettingsConfig } from '../game/types';
import { APP_BUILD_TAG } from '../game/version';

interface MainMenuProps {
  latestSlot: SaveSlot | null;
  saveSlotsCount: number;
  settings: SettingsConfig;
  onContinueLatest: () => void;
  onStartNewGame: (sessionName: string, includeStarterNodes: boolean) => void;
  onOpenLoadGame: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  latestSlot,
  saveSlotsCount,
  settings,
  onContinueLatest,
  onStartNewGame,
  onOpenLoadGame,
  onOpenSettings,
}) => {
  const [showNewGameDialog, setShowNewGameDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('Northern Forest Sector 02');
  const [includeStarterNodes, setIncludeStarterNodes] = useState(true);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSessionName.trim();
    if (!trimmed) return;
    setShowNewGameDialog(false);
    onStartNewGame(trimmed, includeStarterNodes);
  };

  return (
    <div
      style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'left center' }}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10"
    >
      {/* Left-Aligned Satisfactory-Style Main Menu Column over Negative Space */}
      <div className="pointer-events-auto w-full max-w-md bg-[#0B0F17]/92 border border-[#26334D] rounded-2xl p-6 md:p-7 shadow-2xl">
        {/* Bespoke Inline SVG Title Emblem */}
        <div className="mb-6">
          <svg
            viewBox="0 0 340 68"
            className="w-64 h-auto"
            role="img"
            aria-label="FICSIT Node Labs Emblem"
          >
            <rect
              x="2"
              y="6"
              width="52"
              height="52"
              rx="10"
              fill="#131B2E"
              stroke="#F59E0B"
              strokeWidth="2.5"
            />
            <circle cx="18" cy="22" r="4.5" fill="#06B6D4" />
            <circle cx="18" cy="42" r="4.5" fill="#06B6D4" />
            <circle cx="39" cy="32" r="5" fill="#F59E0B" />
            <path
              d="M 22.5 22 C 30 22, 30 32, 34 32 M 22.5 42 C 30 42, 30 32, 34 32"
              stroke="#F59E0B"
              strokeWidth="2.2"
              fill="none"
            />
            <text
              x="68"
              y="31"
              fill="#F8FAFC"
              fontFamily="Outfit, sans-serif"
              fontWeight="800"
              fontSize="24"
              letterSpacing="0.04em"
            >
              FICSIT NODE LABS
            </text>
            <text
              x="68"
              y="51"
              fill="#94A3B8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              fontSize="11"
              letterSpacing="0.08em"
            >
              2D AUTOMATION &amp; LOGISTICS TYCOON
            </text>
          </svg>
        </div>

        {/* Latest Session Readout */}
        {latestSlot && (
          <div className="mb-5 px-3.5 py-2.5 rounded-xl bg-[#131B2E] border border-[#26334D] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Latest Pioneer Save</div>
              <div className="text-sm font-semibold text-white truncate">
                {latestSlot.sessionName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                {latestSlot.slotName} · {latestSlot.nodes.length} Nodes
              </div>
            </div>
          </div>
        )}

        {/* Primary Menu Buttons (Satisfactory Layout) */}
        <nav aria-label="Main Menu" className="flex flex-col gap-2.5">
          {latestSlot && (
            <button
              type="button"
              data-start="true"
              onClick={onContinueLatest}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide flex items-center justify-between transition-transform active:scale-[0.99] whitespace-nowrap"
            >
              <span>Continue</span>
              <span className="text-xs font-mono opacity-80">{latestSlot.slotName}</span>
            </button>
          )}

          <button
            type="button"
            data-start={!latestSlot ? 'true' : undefined}
            onClick={() => setShowNewGameDialog(true)}
            className={`w-full min-h-[48px] px-5 py-3 rounded-xl font-display font-semibold text-sm flex items-center justify-between transition-colors whitespace-nowrap ${
              !latestSlot
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                : 'bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D]'
            }`}
          >
            <span>New Game</span>
            <span className="text-xs text-slate-400 font-normal">Create Sector</span>
          </button>

          <button
            type="button"
            onClick={onOpenLoadGame}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D] font-display font-semibold text-sm flex items-center justify-between transition-colors whitespace-nowrap"
          >
            <span>Load Game</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {saveSlotsCount} {saveSlotsCount === 1 ? 'Slot' : 'Slots'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D] font-display font-semibold text-sm flex items-center justify-between transition-colors whitespace-nowrap"
          >
            <span>Settings</span>
            <span className="text-xs text-slate-400 font-normal">
              UI · Wiring · Audio · Saves
            </span>
          </button>
        </nav>

        <div className="mt-5 pt-3.5 border-t border-[#26334D] flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
          <span>Android Landscape Build</span>
          <span className="text-amber-400 font-semibold">{APP_BUILD_TAG}</span>
        </div>
      </div>

      {/* Single Flat Control-Hint Line in Bottom Margin */}
      <div className="pointer-events-none flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>
          Drag Canvas Pan · Pinch/Wheel Zoom · Tap or Drag Ports Wire · Q Build Menu · Esc Menu
        </span>
        <span className="text-slate-300">{APP_BUILD_TAG}</span>
      </div>

      {/* New Game Session Modal */}
      {showNewGameDialog && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSession}
            className="w-full max-w-md rounded-2xl bg-[#131B2E] border border-[#26334D] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#26334D]">
              <h2 className="text-lg font-bold font-display text-white">
                Initialize New Factory Session
              </h2>
              <button
                type="button"
                onClick={() => setShowNewGameDialog(false)}
                className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="session-name-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Session / Sector Name
                </label>
                <input
                  id="session-name-input"
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Enter factory sector name..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-[#26334D] text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Deploy Starter Iron Pipeline
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Pre-places an Iron Deposit, Miner, Smelter, Constructor &amp; HUB
                  </div>
                </div>
                <input
                  id="starter-nodes-toggle"
                  type="checkbox"
                  checked={includeStarterNodes}
                  onChange={(e) => setIncludeStarterNodes(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewGameDialog(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B0F17] border border-[#26334D] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap"
              >
                Launch Session
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
