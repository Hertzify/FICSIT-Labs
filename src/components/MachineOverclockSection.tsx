/**
 * ============================================================================
 * MODULE INDEX: Machine Overclocking (0%-250%) & Footer (`src/components/MachineOverclockSection.tsx`)
 * ============================================================================
 * [Lines 018-045] MachineOverclockSectionProps
 * [Lines 047-250] Overclock Bay (1%-250% Full-Height Divided Card, 3 Shard Slots, Multiplier, Conduit Pipe & Heat Vents)
 * [Lines 252-360] Bottom Footer (Copy/Paste Settings Buttons + Framed I/O Standby Rocker Switch)
 * ============================================================================
 */

import React from 'react';
import { getMaxClockSpeedPct, getRequiredPowerShards } from '../game/catalog';
import {
  MultiplierSlotSilhouetteIcon,
  PowerShardCrystalIcon,
  ScrewHead,
  StemBadge,
} from './PioneerInventoryPanel';

interface MachineOverclockSectionProps {
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
}

export const MachineOverclockSection: React.FC<MachineOverclockSectionProps> = React.memo(
  ({
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
  }) => {
    const handleSliderChange = (rawVal: number) => {
      if (!onUpdateOverclock) return;
      const clampedVal = Math.min(250, Math.max(1, Math.round(rawVal)));
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
        <div className="relative flex items-stretch gap-1.5 bg-[#2A2C30] border-2 border-[#18191C] rounded-md p-1.5 shadow-inner">
          {/* Left Glowing Orange Vertical Heat Vents */}
          <div className="w-4 py-1 flex flex-col items-center justify-between shrink-0">
            <ScrewHead />
            <div className="flex gap-[2px] h-9">
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
            </div>
            <div className="flex gap-[2px] h-9">
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
            </div>
            <ScrewHead />
          </div>

          {/* Center OVERCLOCK Housing */}
          <div className="flex-1 rounded-[5px] bg-[#36383E] border-2 border-[#1B1C20] px-2 pt-2 pb-1 flex flex-col justify-between shadow-md">
            {/* Crisp White Overclock Interior with Continuous Vertical Column Dividers */}
            <div className="relative rounded-[4px] bg-[#F5F5F7] border border-[#2C2E33] text-[#333538] overflow-hidden px-2.5 pt-2 pb-1.5">
              {/* Continuous Full-Height Vertical Column Divider Lines at 40% (100%), 60% (150%), 80% (200%) */}
              <span className="pointer-events-none absolute top-0 bottom-4 left-[40%] w-[1.5px] bg-[#DF8A2E] z-10" />
              <span className="pointer-events-none absolute top-0 bottom-4 left-[60%] w-[1px] bg-[#D4D6DA] z-10" />
              <span className="pointer-events-none absolute top-0 bottom-4 left-[80%] w-[1px] bg-[#D4D6DA] z-10" />

              {/* Upper Row: Left 40% Clock Speed Readouts + Right 3x20% Power Shard Slots */}
              <div className="flex items-center">
                <div className="w-[40%] pr-2 space-y-0.5">
                  <div className="text-[10px] font-bold text-[#333538] leading-tight">
                    Clock Speed:
                  </div>
                  <div className="inline-block min-w-[54px] px-1.5 py-[1px] rounded-[2px] bg-[#EAEBED] border border-[#D4D6DA] text-sm font-sans font-bold text-[#DF8A2E] leading-tight">
                    {clockSpeedPct}%
                  </div>
                  <div className="text-[9.5px] font-bold text-[#333538] leading-tight pt-0.5">
                    Target production rate:
                  </div>
                  <div className="text-[11px] text-[#45474C] flex items-center gap-1">
                    <span className="inline-block min-w-[28px] text-center px-1 py-[0.5px] rounded-[2px] bg-[#EAEBED] border border-[#D4D6DA] font-sans font-bold text-[#DF8A2E]">
                      {targetOutputRate}
                    </span>
                    <span className="font-medium">per min</span>
                  </div>
                </div>

                {/* 3 Power Shard Slots (each 20% width to align strictly with 100%-150%, 150%-200%, 200%-250%) */}
                {[0, 1, 2].map((slotIdx) => {
                  const isInstalled = slotIdx < powerShards;
                  const unlockedCap = 150 + slotIdx * 50;
                  return (
                    <div
                      key={slotIdx}
                      className="w-[20%] flex items-center justify-center py-1"
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
                        className={`relative w-11 h-11 rounded-[3px] bg-[#D8D9DC] border flex items-center justify-center transition-all ${
                          isInstalled
                            ? 'border-[#DF8A2E] ring-1 ring-[#DF8A2E]/60'
                            : 'border-[#C5C7CB] hover:border-[#DF8A2E]'
                        }`}
                      >
                        <PowerShardCrystalIcon active={isInstalled} />
                        <span
                          className={`absolute bottom-0 right-0 px-1 rounded-tl-[2px] font-sans text-[9px] font-bold leading-tight text-white ${
                            isInstalled ? 'bg-[#DF8A2E]' : 'bg-[#686B70]'
                          }`}
                        >
                          1
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Segmented 0% — 100% | 150% | 200% | 250% Slider Bar */}
              <div className="mt-1.5">
                <div className="relative h-3.5 w-full flex items-center select-none">
                  <div className="w-full h-3.5 flex bg-[#CFCFD3]">
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
                            isUnlocked ? 'bg-[#73757A]' : 'bg-[#CFCFD3]'
                          }`}
                        >
                          {fillRatio > 0 && (
                            <div
                              className="h-full bg-[#DF8A2E]"
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                </div>

                {/* Tick Labels: 0%, 100%, 150%, 200%, 250% */}
                <div className="relative h-3 mt-0.5 text-[8.5px] font-sans font-semibold select-none">
                  <button
                    type="button"
                    onClick={() => handleSliderChange(25)}
                    className="absolute left-0 text-[#DF8A2E] hover:underline"
                  >
                    0%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(100)}
                    className="absolute left-[40%] -translate-x-1/2 text-[#DF8A2E] hover:underline"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(150)}
                    className="absolute left-[60%] -translate-x-1/2 text-[#A0A3A9] hover:text-[#DF8A2E]"
                  >
                    150%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(200)}
                    className="absolute left-[80%] -translate-x-1/2 text-[#A0A3A9] hover:text-[#DF8A2E]"
                  >
                    200%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSliderChange(250)}
                    className="absolute right-0 text-[#A0A3A9] hover:text-[#DF8A2E]"
                  >
                    250%
                  </button>
                </div>
              </div>
            </div>

            <StemBadge label="OVERCLOCK" />
          </div>

          {/* Right MULTIPLIER Housing */}
          <div className="w-[106px] rounded-[5px] bg-[#36383E] border-2 border-[#1B1C20] px-2 pt-2 pb-1 flex flex-col justify-between shrink-0 shadow-md">
            <div className="flex-1 rounded-[4px] bg-[#18191D] border border-[#2C2E33] p-2 flex flex-col items-center justify-center text-center gap-1.5">
              <div className="relative w-11 h-11 rounded-[3px] bg-[#D8D9DC] flex items-center justify-center">
                <MultiplierSlotSilhouetteIcon />
                <span className="absolute bottom-0 right-0 px-1 rounded-tl-[2px] bg-[#686B70] text-white font-sans text-[9px] font-bold leading-tight">
                  1
                </span>
              </div>
              <div className="text-[9.5px] text-[#D4D5D8] leading-tight">
                Output Multiplier:
                <div className="font-sans font-bold text-[#5A5D64] text-xs mt-0.5">
                  x1
                </div>
              </div>
            </div>

            <StemBadge label="MULTIPLIER" />
          </div>

          {/* Right Glowing Orange Vertical Heat Vents */}
          <div className="w-4 py-1 flex flex-col items-center justify-between shrink-0">
            <ScrewHead />
            <div className="flex gap-[2px] h-9">
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
            </div>
            <div className="flex gap-[2px] h-9">
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
              <span className="w-[2px] h-full rounded-full bg-[#FF981A] shadow-[0_0_6px_#FF981A]" />
            </div>
            <ScrewHead />
          </div>
        </div>

        {/* =============================================================== */}
        {/* BOTTOM FOOTER: COPY/PASTE SETTINGS + FRAMED STANDBY SWITCH      */}
        {/* =============================================================== */}
        <div className="rounded-md bg-[#222428] border-2 border-[#18191C] px-3 py-2 flex items-center justify-between shadow-inner">
          <div className="flex flex-col gap-1.5 w-48">
            <button
              type="button"
              onClick={onCopySettings}
              className="w-full py-1.5 px-3 rounded-[3px] bg-gradient-to-b from-[#34373D] to-[#26282D] hover:from-[#40444B] hover:to-[#2E3138] border border-[#141518] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-sans text-[#E4E5E7] flex items-center justify-center gap-2 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-white shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span>Copy Settings</span>
            </button>
            <button
              type="button"
              onClick={onPasteSettings}
              disabled={!hasCopiedSettings}
              className={`w-full py-1.5 px-3 rounded-[3px] border text-xs font-sans flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors ${
                hasCopiedSettings
                  ? 'bg-gradient-to-b from-[#34373D] to-[#26282D] hover:from-[#40444B] hover:to-[#2E3138] border-[#141518] text-[#E4E5E7]'
                  : 'bg-[#232529] border-[#18191C] text-[#7A7D84] cursor-not-allowed'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <span>Paste Settings</span>
            </button>
          </div>

          {/* Right Framed [ STANDBY ] I/O Rocker Switch with White Stem */}
          <div className="flex flex-col items-center mr-6">
            <button
              type="button"
              aria-label="Toggle Standby Mode"
              aria-pressed={isStandby}
              onClick={onToggleStandby}
              className={`w-14 h-12 rounded-[5px] border bg-[#1B1D20] flex items-center justify-center p-1 shadow-inner transition-colors ${
                isStandby
                  ? 'border-sky-400 hover:border-sky-300'
                  : 'border-white/85 hover:border-[#DF8A2E]'
              }`}
            >
              <span className="w-5 h-9 rounded-[2px] overflow-hidden border border-[#3E4046] bg-[#141518] p-[1.5px] flex flex-col">
                {/* Top Half: I (ON) */}
                <span
                  className={`w-full h-1/2 flex items-center justify-center transition-all ${
                    !isStandby
                      ? 'bg-gradient-to-b from-[#FF981A] to-[#D96B16] shadow-[0_0_6px_rgba(255,152,26,0.6)]'
                      : 'bg-gradient-to-b from-[#454950] to-[#282B30]'
                  }`}
                >
                  <span
                    className={`w-[1.8px] h-2.5 rounded-full ${
                      !isStandby ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                </span>
                {/* Bottom Half: O (STANDBY) */}
                <span
                  className={`w-full h-1/2 flex items-center justify-center border-t border-black/40 transition-all ${
                    isStandby
                      ? 'bg-gradient-to-b from-[#0EA5E9] to-[#0284C7] shadow-[0_0_6px_rgba(14,165,233,0.65)]'
                      : 'bg-gradient-to-b from-[#3A3E45] to-[#22252A]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full border-[1.6px] ${
                      isStandby ? 'border-white' : 'border-white/55'
                    }`}
                  />
                </span>
              </span>
            </button>
            <StemBadge
              label="STANDBY"
              active={isStandby}
              activeClassName="bg-sky-600 text-white border-sky-400"
            />
          </div>
        </div>
      </>
    );
  }
);
