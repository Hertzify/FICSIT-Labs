import React from 'react';
import { ActiveCanvasTool } from '../game/types';

interface SatisfactoryToolbarProps {
  activeTool: ActiveCanvasTool;
  onSelectTool: (tool: ActiveCanvasTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoDescription?: string | null;
  redoDescription?: string | null;
  uiScale: number;
}

export const SatisfactoryToolbar: React.FC<SatisfactoryToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoDescription,
  redoDescription,
  uiScale,
}) => {
  return (
    <nav
      aria-label="Factory Controls Toolbar"
      style={{
        transform: `scale(${uiScale})`,
        transformOrigin: 'top center',
      }}
      className="fixed top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none"
    >
      <div className="bg-[#0E1524]/95 backdrop-blur-md border border-[#26334D] rounded-2xl p-1 shadow-2xl shadow-black/80 flex items-center gap-1.5 ring-1 ring-white/5">
        {/* Tool 1: Edit Tool (Pointer Arrow) */}
        <button
          type="button"
          aria-label="Edit Tool"
          aria-pressed={activeTool === 'edit'}
          title="Edit Tool · Select & move buildings, drag corner dots, wire ports"
          onClick={() => onSelectTool('edit')}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border active:scale-95 touch-manipulation ${
            activeTool === 'edit'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-[#131B2E] text-slate-300 hover:text-white hover:bg-[#1C2742] border-[#26334D]'
          }`}
        >
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 3.5V19.5L9.5 14.5L14 21.5L17 19.5L12.5 12.5H19.5L4 3.5Z" />
          </svg>
        </button>

        {/* Tool 2: Move Tool (4-Way Navigation Cross) */}
        <button
          type="button"
          aria-label="Move Tool"
          aria-pressed={activeTool === 'move'}
          title="Move Tool · Safe camera pan without accidental edits"
          onClick={() => onSelectTool('move')}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border active:scale-95 touch-manipulation ${
            activeTool === 'move'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-[#131B2E] text-slate-300 hover:text-white hover:bg-[#1C2742] border-[#26334D]'
          }`}
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
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
        </button>

        {/* Tool 3: Multi-Select Tool (Dashed Marquee Box) */}
        <button
          type="button"
          aria-label="Multi-Select Tool"
          aria-pressed={activeTool === 'select'}
          title="Multi-Select Tool · Drag box to select multiple buildings"
          onClick={() => onSelectTool('select')}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border active:scale-95 touch-manipulation ${
            activeTool === 'select'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-[#131B2E] text-slate-300 hover:text-white hover:bg-[#1C2742] border-[#26334D]'
          }`}
        >
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="3 3"
          >
            <rect x="4" y="4" width="16" height="16" rx="3.5" />
          </svg>
        </button>

        {/* Tool 4: Corner Dot Tool (Concentric Circle Target) */}
        <button
          type="button"
          aria-label="Conveyor Corner Dot Tool"
          aria-pressed={activeTool === 'waypoint'}
          title="Corner Dot Tool · Tap conveyor belt to add 90° corner points"
          onClick={() => onSelectTool('waypoint')}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border active:scale-95 touch-manipulation ${
            activeTool === 'waypoint'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
              : 'bg-[#131B2E] text-slate-300 hover:text-white hover:bg-[#1C2742] border-[#26334D]'
          }`}
        >
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          </svg>
        </button>

        {/* Industrial Section Separator */}
        <div className="w-[1px] h-6 bg-[#26334D]/80 mx-0.5" />

        {/* Action 5: Undo Button */}
        <button
          type="button"
          aria-label={canUndo ? `Undo: ${undoDescription ?? 'Last Action'}` : 'Undo disabled'}
          title={canUndo ? `Undo · ${undoDescription ?? 'Last Action'}` : 'Undo'}
          disabled={!canUndo}
          onClick={onUndo}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border touch-manipulation ${
            canUndo
              ? 'bg-[#131B2E] text-slate-200 hover:text-white hover:bg-[#1C2742] active:scale-95 border-[#26334D] cursor-pointer'
              : 'bg-[#131B2E]/40 text-slate-600 border-transparent cursor-not-allowed opacity-50'
          }`}
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
            <path d="M3 9l4-4m-4 4l4 4m-4-4h11a6 6 0 0 1 0 12h-4" />
          </svg>
        </button>

        {/* Action 6: Redo Button */}
        <button
          type="button"
          aria-label={canRedo ? `Redo: ${redoDescription ?? 'Action'}` : 'Redo disabled'}
          title={canRedo ? `Redo · ${redoDescription ?? 'Action'}` : 'Redo'}
          disabled={!canRedo}
          onClick={onRedo}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 border touch-manipulation ${
            canRedo
              ? 'bg-[#131B2E] text-slate-200 hover:text-white hover:bg-[#1C2742] active:scale-95 border-[#26334D] cursor-pointer'
              : 'bg-[#131B2E]/40 text-slate-600 border-transparent cursor-not-allowed opacity-50'
          }`}
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
            <path d="M21 9l-4-4m4 4l-4 4m4-4H10a6 6 0 0 0 0 12h4" />
          </svg>
        </button>
      </div>
    </nav>
  );
};
