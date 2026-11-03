import React, { useState } from 'react';
import { SaveSlot, SettingsConfig } from '../game/types';
import { APP_BUILD_TAG } from '../game/version';
import { ChangelogModal } from './ChangelogModal';

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
  const [showChangelog, setShowChangelog] = useState(false);
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
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5"
    >
      {/* Widescreen Landscape Main Menu Dock over Negative Space */}
      <div className="pointer-events-auto w-full max-w-[430px] bg-[#0B0F17]/95 border border-[#26334D] rounded-2xl p-4 shadow-2xl my-auto">
        {/* Compact Inline SVG Emblem + Build Tag Header */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#26334D]">
          <svg
            viewBox="0 0 340 60"
            className="w-52 h-auto shrink-0"
            role="img"
            aria-label="FICSIT Node Labs Emblem"
          >
            <rect
              x="2"
              y="4"
              width="48"
              height="48"
              rx="10"
              fill="#131B2E"
              stroke="#F59E0B"
              strokeWidth="2.5"
            />
            <circle cx="17" cy="19" r="4" fill="#06B6D4" />
            <circle cx="17" cy="37" r="4" fill="#06B6D4" />
            <circle cx="36" cy="28" r="4.5" fill="#F59E0B" />
            <path
              d="M 21 19 C 28 19, 28 28, 31.5 28 M 21 37 C 28 37, 28 28, 31.5 28"
              stroke="#F59E0B"
              strokeWidth="2.2"
              fill="none"
            />
            <text
              x="62"
              y="27"
              fill="#F8FAFC"
              fontFamily="Outfit, sans-serif"
              fontWeight="800"
              fontSize="23"
              letterSpacing="0.04em"
            >
              FICSIT NODE LABS
            </text>
            <text
              x="62"
              y="45"
              fill="#94A3B8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              fontSize="10.5"
              letterSpacing="0.08em"
            >
              2D AUTOMATION &amp; LOGISTICS TYCOON
            </text>
          </svg>

          <button
            type="button"
            onClick={() => setShowChangelog(true)}
            title="View Patch Notes & Changelog"
            className="px-2 py-1 rounded-md bg-[#131B2E] hover:bg-amber-500/20 hover:border-amber-400 border border-amber-500/40 text-[10px] font-mono font-semibold text-amber-400 whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>{APP_BUILD_TAG}</span>
            <span className="text-[10px] opacity-75">📋</span>
          </button>
        </div>

        {/* Latest Session Readout Strip */}
        {latestSlot && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-[#131B2E] border border-[#26334D] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                Active Pioneer Sector
              </div>
              <div className="text-xs font-semibold text-white truncate">
                {latestSlot.sessionName}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-mono text-amber-300">{latestSlot.slotName}</div>
              <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                {latestSlot.nodes.length} Nodes · {latestSlot.connections.length} Belts
              </div>
            </div>
          </div>
        )}

        {/* Landscape 2x2 Action Grid (Fits 360px-412px phone height with zero scroll) */}
        <nav aria-label="Main Menu" className="grid grid-cols-2 gap-2">
          {latestSlot && (
            <button
              type="button"
              data-start="true"
              onClick={onContinueLatest}
              className="col-span-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs tracking-wide flex items-center justify-between active:scale-[0.99] whitespace-nowrap"
            >
              <span>Continue Session</span>
              <span className="text-[11px] font-mono opacity-85">{latestSlot.slotName}</span>
            </button>
          )}

          <button
            type="button"
            data-start={!latestSlot ? 'true' : undefined}
            onClick={() => setShowNewGameDialog(true)}
            className={`${
              !latestSlot ? 'col-span-2 bg-amber-500 text-slate-950 font-bold' : 'bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D]'
            } min-h-[44px] px-3.5 py-2 rounded-xl font-display font-semibold text-xs flex flex-col justify-center text-left whitespace-nowrap`}
          >
            <span>New Game</span>
            <span className="text-[10px] text-slate-400 font-normal">New Sector</span>
          </button>

          <button
            type="button"
            onClick={onOpenLoadGame}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D] font-display font-semibold text-xs flex flex-col justify-center text-left whitespace-nowrap"
          >
            <span>Load Game</span>
            <span className="text-[10px] font-mono tabular-nums text-slate-400">
              {saveSlotsCount} {saveSlotsCount === 1 ? 'Slot' : 'Slots'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="col-span-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#131B2E] hover:bg-[#1C2742] text-white border border-[#26334D] font-display font-semibold text-xs flex items-center justify-between whitespace-nowrap"
          >
            <span>Settings</span>
            <span className="text-[10px] text-slate-400 font-normal">
              UI Scale · Conveyor Style · Audio · Saves
            </span>
          </button>
        </nav>
      </div>

      {/* Single Flat Control-Hint Line in Bottom Margin */}
      <div className="pointer-events-none flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
        <span className="truncate">
          Drag Pan · Pinch/Double-Tap Zoom (Zoom Out for Icon Boxes) · Tap/Drag Ports Wire · [Q] Build
        </span>
        <div className="flex items-center gap-2 shrink-0 ml-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowChangelog(true)}
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Changelog
          </button>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">{APP_BUILD_TAG}</span>
        </div>
      </div>

      {/* Widescreen Landscape New Game Session Modal */}
      {showNewGameDialog && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-black/80 flex items-center justify-center p-3">
          <form
            onSubmit={handleCreateSession}
            className="w-full max-w-lg rounded-2xl bg-[#131B2E] border border-[#26334D] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#26334D]">
              <h2 className="text-sm font-bold font-display text-white">
                Initialize New Factory Session
              </h2>
              <button
                type="button"
                onClick={() => setShowNewGameDialog(false)}
                className="min-w-[32px] min-h-[32px] rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="session-name-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-[#26334D] text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0F17] border border-[#26334D]">
                <div className="pr-2">
                  <div className="text-xs font-semibold text-white">
                    Starter Iron Pipeline
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Deposit, Miner, Smelter, Constructor &amp; HUB
                  </div>
                </div>
                <input
                  id="starter-nodes-toggle"
                  type="checkbox"
                  checked={includeStarterNodes}
                  onChange={(e) => setIncludeStarterNodes(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNewGameDialog(false)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B0F17] border border-[#26334D] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap"
              >
                Launch Session
              </button>
            </div>
          </form>
        </div>
      )}

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
};
