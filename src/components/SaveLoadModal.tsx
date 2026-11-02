import React, { useState } from 'react';
import { SaveSlot, SettingsConfig } from '../game/types';

interface SaveLoadModalProps {
  mode: 'load' | 'save_and_load';
  slots: SaveSlot[];
  activeSlotId: string;
  activeSessionName: string;
  settings: SettingsConfig;
  onLoadSlot: (slot: SaveSlot) => void;
  onCreateManualSave: (slotName: string) => void;
  onOverwriteSlot: (slotId: string) => void;
  onDeleteSlot: (slotId: string) => void;
  onClose: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  mode,
  slots,
  activeSlotId,
  activeSessionName,
  settings,
  onLoadSlot,
  onCreateManualSave,
  onOverwriteSlot,
  onDeleteSlot,
  onClose,
}) => {
  const [newSlotName, setNewSlotName] = useState(
    `${activeSessionName} — Manual Save`
  );
  const [filterKind, setFilterKind] = useState<'all' | 'manual' | 'autosave'>('all');

  const filteredSlots = slots.filter((s) =>
    filterKind === 'all' ? true : s.kind === filterKind
  );

  const handleCreateSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSlotName.trim();
    if (!trimmed) return;
    onCreateManualSave(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-label="Save and Load Manager"
      className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
        className="w-[96vw] max-w-4xl h-[92vh] max-h-[460px] rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Compact Header with Inline Filter Pills */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#0B0F17] border-b border-[#26334D] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-display font-bold text-white whitespace-nowrap">
              {mode === 'save_and_load' ? 'Save & Load Slots' : 'Load Pioneer Save'}
            </h2>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `All (${slots.length})` },
                  { id: 'manual', label: 'Manual' },
                  { id: 'autosave', label: 'Auto-Save' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterKind(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap ${
                    filterKind === f.id
                      ? 'bg-[#1C2742] text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Save Manager"
            onClick={onClose}
            className="min-h-[34px] px-3 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        {/* Optional Create New Manual Save Bar (when opened in-game) */}
        {mode === 'save_and_load' && (
          <form
            onSubmit={handleCreateSave}
            className="px-4 py-2 bg-[#0E1525] border-b border-[#26334D] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              required
              aria-label="New Save Slot Name"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder="Enter manual save slot name..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-[#0B0F17] border border-[#26334D] text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap shrink-0"
            >
              Save New Slot
            </button>
          </form>
        )}

        {/* Save Slots 2-Column Landscape Grid */}
        <div className="flex-1 p-3.5 overflow-y-auto">
          {filteredSlots.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No save slots found in this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredSlots.map((slot) => {
                const isCurrent = slot.id === activeSlotId;
                const dateStr = new Date(slot.updatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                return (
                  <div
                    key={slot.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                      isCurrent
                        ? 'bg-[#17223B] border-amber-500/60'
                        : 'bg-[#0B0F17] border-[#26334D]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-display font-bold text-white truncate">
                          {slot.slotName}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 shrink-0">
                          {slot.kind === 'autosave' ? 'AUTO' : 'MANUAL'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {slot.sessionName}
                      </div>
                      <div className="mt-1 text-[10px] font-mono tabular-nums text-slate-400">
                        {slot.nodes.length} Nodes · {slot.connections.length} Belts · {dateStr}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onLoadSlot(slot)}
                        className="flex-1 min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap"
                      >
                        Load
                      </button>
                      {mode === 'save_and_load' && slot.kind === 'manual' && (
                        <button
                          type="button"
                          onClick={() => onOverwriteSlot(slot.id)}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-medium text-slate-200 whitespace-nowrap"
                        >
                          Overwrite
                        </button>
                      )}
                      {slots.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Delete ${slot.slotName}`}
                          onClick={() => onDeleteSlot(slot.id)}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-900/50 text-xs font-medium text-red-200 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
