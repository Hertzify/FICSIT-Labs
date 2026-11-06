/**
 * ============================================================================
 * MODULE INDEX: Machine Overclocking (0%-250%) & Footer (`src/components/MachineOverclockSection.tsx`)
 * ============================================================================
 * [Lines 018-045] MachineOverclockSectionProps
 * [Lines 047-225] Overclock Card (1%-250% Slider, 3 Power Shard Slots, Multiplier & Belt Tiers)
 * [Lines 227-325] Bottom Footer (Copy/Paste Settings, Fill/Unwire/Dismantle, Standby Rocker Switch)
 * ============================================================================
 */

import React from 'react';
import {
  CONVEYOR_BELT_TIER_LIST,
  getMaxClockSpeedPct,
  getRequiredPowerShards,
} from '../game/catalog';
import {
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
} from '../game/types';
import { PowerShardCrystalIcon, ScrewHead } from './PioneerInventoryPanel';

interface MachineOverclockSectionProps {
  node: MachineNode;
  attachedConns: ConveyorConnection[];
  powerShards: number;
  clockSpeedPct: number;
  maxUnlockedClockPct: number;
  targetOutputRate: number;
  isStandby: boolean;
  hasCopiedSettings: boolean;
  onUpdateOverclock?: (clockSpeedPct: number, powerShards: number) => void;
  onToggleStandby?: () => void;
  onCopySettings?: () => void;
  onPasteSettings?: () => void;
  onFillInputBuffer?: () => void;
  onFillOutputBuffer?: () => void;
  onUpgradeConnectedBelts: (
    tier: ConveyorBeltTier,
    shortLabel: string,
    capacityPerMin: number
  ) => void;
  onUnwireBelts: () => void;
  onDismantleNode: () => void;
}

export const MachineOverclockSection: React.FC<MachineOverclockSectionProps> = React.memo(
  ({
    node,
    attachedConns,
    powerShards,
    clockSpeedPct,
    maxUnlockedClockPct,
    targetOutputRate,
    isStandby,
    hasCopiedSettings,
    onUpdateOverclock,
    onToggleStandby,
    onCopySettings,
    onPasteSettings,
    onFillInputBuffer,
    onFillOutputBuffer,
    onUpgradeConnectedBelts,
    onUnwireBelts,
    onDismantleNode,
  }) => {
    const handleSliderChange = (rawVal: number) => {
      if (!onUpdateOverclock) return;
      const clampedVal = Math.min(250, Math.max(1, Math.round(rawVal * 2) / 2));
      const reqShards = getRequiredPowerShards(clampedVal);
      const nextShards = Math.max(powerShards, reqShards);
      onUpdateOverclock(clampedVal, nextShards);
    };

    const handleToggleShardSlot = (slotIndex: number) => {
      if (!onUpdateOverclock) return;
      const targetShards = slotIndex + 1 === powerShards ? slotIndex : slotIndex + 1;
      const maxClockForTarget = getMaxClockSpeedPct(targetShards);
      const nextClock = Math.min(clockSpeedPct, maxClockForTarget);
      onUpdateOverclock(nextClock, targetShards);
    };

    return (
      <>
        {/* =============================================================== */}
        {/* LOWER OVERCLOCK (0% – 250% WITH 3 POWER SHARDS) & MULTIPLIER    */}
        {/* =============================================================== */}
        <div className="flex items-stretch gap-1.5">
          {/* Left Glowing Orange Vertical Heat Vents */}
          <div className="w-5 rounded bg-[#1E2024] border border-[#34373E] py-1.5 flex flex-col items-center justify-between shrink-0">
            <ScrewHead />
            <div className="flex gap-[2px] h-8">
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
            </div>
            <div className="flex gap-[2px] h-8">
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
            </div>
            <ScrewHead />
          </div>

          {/* Center White OVERCLOCK Card (1% to 250% with 3 Power Shard Slots) */}
          <div className="flex-1 rounded-md bg-[#2E3036] border-2 border-[#18191C] p-2 flex flex-col justify-between">
            <div className="rounded bg-white text-slate-900 p-2 space-y-2 shadow">
              <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] divide-x divide-slate-200 items-center">
                {/* Clock Speed & Target Rate Readouts */}
                <div className="pr-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-700 leading-tight">
                    Clock Speed:
                  </div>
                  <div className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-sm font-mono font-bold text-[#E59329]">
                    {clockSpeedPct}%
                  </div>
                  <div className="text-[10px] font-bold text-slate-700 leading-tight">
                    Target production rate:
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="px-1 py-0.2 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-[#E59329]">
                      {targetOutputRate}
                    </span>{' '}
                    per min
                  </div>
                </div>

                {/* 3 Power Shard Slots (+50% each: 150%, 200%, 250%) */}
                {[0, 1, 2].map((slotIdx) => {
                  const isInstalled = slotIdx < powerShards;
                  const unlockedCap = 150 + slotIdx * 50;
                  return (
                    <div
                      key={slotIdx}
                      className="flex flex-col items-center justify-center px-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleShardSlot(slotIdx)}
                        title={
                          isInstalled
                            ? `Power Shard #${slotIdx + 1} Installed (Unlocks ${unlockedCap}% · Tap to remove)`
                            : `Install Power Shard #${slotIdx + 1} (Unlocks up to ${unlockedCap}% Clock Speed)`
                        }
                        aria-label={`Power Shard Slot ${slotIdx + 1}`}
                        className={`relative w-11 h-11 rounded bg-[#D9D9D9] border flex items-center justify-center transition-all ${
                          isInstalled
                            ? 'border-[#E59329] ring-1 ring-[#E59329]/50 shadow-sm'
                            : 'border-slate-300 hover:border-[#E59329]'
                        }`}
                      >
                        <PowerShardCrystalIcon active={isInstalled} />
                        {isInstalled ? (
                          <span className="absolute -bottom-1.5 inset-x-0.5 py-0.2 rounded bg-[#E59329] text-white font-mono text-[9px] font-bold leading-tight text-center shadow">
                            1/1
                          </span>
                        ) : (
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-[#52555C] text-white font-mono text-[9px] font-bold leading-tight">
                            1
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Segmented 0% — 100% | 150% | 200% | 250% Slider Bar */}
              <div className="pt-1 space-y-1">
                <div className="relative h-4 w-full flex items-center select-none">
                  <div className="w-full h-3.5 flex gap-[2px] rounded-sm overflow-hidden">
                    {[
                      { start: 0, end: 100, widthClass: 'w-[40%]' },
                      { start: 100, end: 150, widthClass: 'w-[20%]' },
                      { start: 150, end: 200, widthClass: 'w-[20%]' },
                      { start: 200, end: 250, widthClass: 'w-[20%]' },
                    ].map((seg) => {
                      const isUnlocked = seg.end <= maxUnlockedClockPct;
                      const segSpan = seg.end - seg.start;
                      const filledInSeg = Math.max(
                        0,
                        Math.min(segSpan, clockSpeedPct - seg.start)
                      );
                      const fillRatio = (filledInSeg / segSpan) * 100;
                      return (
                        <div
                          key={seg.start}
                          className={`${seg.widthClass} h-full relative ${
                            isUnlocked ? 'bg-[#585A60]' : 'bg-[#D1D5DB]'
                          }`}
                        >
                          {fillRatio > 0 && (
                            <div
                              className="h-full bg-[#E59329]"
                              style={{ width: `${fillRatio}%` }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <input
                    type="range"
                    aria-label="Clock Speed Percentage (1% to 250%)"
                    min={1}
                    max={250}
                    step={1}
                    value={clockSpeedPct}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {/* Tick Labels: 0%, 100%, 150%, 200%, 250% */}
                <div className="relative h-3.5 text-[9px] font-mono font-bold text-slate-600 select-none">
                  <button
                    type="button"
                    onClick={() => handleSliderChange(25)}
                    className="absolute left-0 hover:text-[#E59329]"
                  >
                    0%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(100)}
                    className="absolute left-[40%] -translate-x-1/2 text-[#E59329] hover:underline"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(150)}
                    className="absolute left-[60%] -translate-x-1/2 hover:text-[#E59329]"
                  >
                    150%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(200)}
                    className="absolute left-[80%] -translate-x-1/2 hover:text-[#E59329]"
                  >
                    200%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(250)}
                    className="absolute right-0 hover:text-[#E59329]"
                  >
                    250%
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex justify-center">
              <span className="px-4 py-0.5 rounded bg-[#E5E7EB] border border-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                OVERCLOCK
              </span>
            </div>
          </div>

          {/* Right MULTIPLIER & Belt Tier Module */}
          <div className="w-28 rounded-md bg-[#2E3036] border-2 border-[#18191C] p-2 flex flex-col justify-between shrink-0">
            <div className="rounded bg-[#1E2024] border border-[#3B3E45] p-1.5 flex flex-col items-center text-center gap-1">
              <div className="relative w-10 h-10 rounded bg-[#D9D9D9] flex items-center justify-center">
                <span className="text-slate-400 font-bold text-sm">∞</span>
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-[#52555C] text-white font-mono text-[8px] font-bold">
                  1
                </span>
              </div>
              <div className="text-[9px] text-slate-300 leading-tight">
                Output Multiplier:
                <div className="font-mono font-bold text-slate-400">x1</div>
              </div>
              {/* Connected Belt Quick-Upgrade Pills */}
              <div className="w-full grid grid-cols-3 gap-0.5 pt-0.5">
                {CONVEYOR_BELT_TIER_LIST.map((bt) => {
                  const isCur =
                    attachedConns.length > 0 &&
                    attachedConns.every((c) => (c.beltTier ?? 1) === bt.tier);
                  return (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() =>
                        onUpgradeConnectedBelts(
                          bt.tier,
                          bt.shortLabel,
                          bt.capacityPerMin
                        )
                      }
                      title={`Upgrade connected belts to ${bt.name} (${bt.capacityPerMin}/m)`}
                      className={`py-0.5 rounded text-[8px] font-mono font-bold border ${
                        isCur
                          ? 'bg-[#E59329] text-slate-950 border-[#E59329]'
                          : 'bg-[#141518] text-slate-300 border-[#34373E] hover:border-slate-400'
                      }`}
                    >
                      {bt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 flex justify-center">
              <span className="px-2.5 py-0.5 rounded bg-[#E5E7EB] border border-slate-400 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-700">
                MULTIPLIER
              </span>
            </div>
          </div>

          {/* Right Glowing Orange Vertical Heat Vents */}
          <div className="w-5 rounded bg-[#1E2024] border border-[#34373E] py-1.5 flex flex-col items-center justify-between shrink-0">
            <ScrewHead />
            <div className="flex gap-[2px] h-8">
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
            </div>
            <div className="flex gap-[2px] h-8">
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
              <span className="w-[2px] h-full rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
            </div>
            <ScrewHead />
          </div>
        </div>

        {/* =============================================================== */}
        {/* BOTTOM FOOTER: COPY/PASTE SETTINGS + STANDBY ROCKER SWITCH      */}
        {/* =============================================================== */}
        <div className="rounded-md bg-[#18191C] border border-[#2E3036] p-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5 w-44">
            <button
              type="button"
              onClick={onCopySettings}
              className="w-full py-1 px-2.5 rounded bg-[#2A2C32] hover:bg-[#373A42] border border-[#3E4149] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 shadow"
            >
              <span>📋</span>
              <span>Copy Settings</span>
            </button>
            <button
              type="button"
              onClick={onPasteSettings}
              disabled={!hasCopiedSettings}
              className={`w-full py-1 px-2.5 rounded border text-xs font-medium flex items-center justify-center gap-1.5 shadow ${
                hasCopiedSettings
                  ? 'bg-[#2A2C32] hover:bg-[#373A42] border-[#3E4149] text-slate-200'
                  : 'bg-[#202226] border-[#2C2E33] text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>📋</span>
              <span>Paste Settings</span>
            </button>
          </div>

          {/* Compact Utility Controls (Fill, Unwire, Dismantle) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {onFillInputBuffer && node.inputs.length > 0 && (
              <button
                type="button"
                onClick={onFillInputBuffer}
                className="px-2 py-1 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#3B3E46] text-[10px] font-mono text-cyan-300"
              >
                Fill In
              </button>
            )}
            {onFillOutputBuffer && (
              <button
                type="button"
                onClick={onFillOutputBuffer}
                className="px-2 py-1 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#3B3E46] text-[10px] font-mono text-amber-300"
              >
                Fill Out
              </button>
            )}
            <button
              type="button"
              onClick={onUnwireBelts}
              className="px-2 py-1 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#3B3E46] text-[10px] font-mono text-slate-300"
            >
              Unwire
            </button>
            <button
              type="button"
              onClick={onDismantleNode}
              className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-[10px] font-mono text-rose-200"
            >
              Dismantle
            </button>
          </div>

          {/* Right Glowing Orange/Red [ STANDBY ] Rocker Switch */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Toggle Standby Mode"
              aria-pressed={isStandby}
              onClick={onToggleStandby}
              className="w-12 h-11 rounded border border-white/70 bg-[#141518] flex items-center justify-center p-1.5 shadow-inner hover:border-[#E59329]"
            >
              <span
                className={`w-4 h-7 rounded-[2px] flex flex-col items-center justify-between p-0.5 transition-all ${
                  isStandby
                    ? 'bg-gradient-to-b from-rose-500 to-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.85)]'
                    : 'bg-gradient-to-b from-[#F59E0B] to-[#D97706] shadow-[0_0_10px_rgba(245,158,11,0.75)]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full border border-white/80" />
                <span className="w-2 h-[2px] bg-white/90" />
              </span>
            </button>
            <span
              className={`mt-1 px-3 py-0.2 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${
                isStandby
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-[#E5E7EB] text-slate-800 border-slate-400'
              }`}
            >
              {isStandby ? 'PAUSED' : 'STANDBY'}
            </span>
          </div>
        </div>
      </>
    );
  }
);
