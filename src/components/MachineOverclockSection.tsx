/**
 * ============================================================================
 * MODULE INDEX: Machine Overclocking (0%-250%) & Footer (`src/components/MachineOverclockSection.tsx`)
 * ============================================================================
 * Uses the authentic Satisfactory lower bay plate (`/icons/buildings/machine_lower_bay_clean.png`)
 * extracted directly from the game UI, overlaying live interactive Clock Speed, Target Rate,
 * 3 Power Shard slots, 0%-250% slider, Somersloop slot, Copy/Paste Settings, and Standby switch.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { clampClockSpeedPct, getMaxClockSpeedPct } from '../game/catalog';
import { RateDisplayFormat } from '../game/types';
import {
  MultiplierSlotSilhouetteIcon,
  PowerShardCrystalIcon,
} from './PioneerInventoryPanel';

interface MachineOverclockSectionProps {
  powerShards: number;
  clockSpeedPct: number;
  maxUnlockedClockPct: number;
  baseOutputRate?: number;
  targetOutputRate: number;
  isStandby: boolean;
  hasCopiedSettings: boolean;
  rateDisplayFormat?: RateDisplayFormat;
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
    baseOutputRate = 60,
    targetOutputRate,
    isStandby,
    hasCopiedSettings,
    rateDisplayFormat = 'per_minute',
    onUpdateOverclock,
    onToggleStandby,
    onCopySettings,
    onPasteSettings,
  }) => {
    const isCompactRate = rateDisplayFormat === 'compact';

    const [clockInputText, setClockInputText] = useState<string>(() => `${clockSpeedPct}%`);
    const [isEditingClock, setIsEditingClock] = useState(false);

    const [rateInputText, setRateInputText] = useState<string>(() => `${targetOutputRate}`);
    const [isEditingRate, setIsEditingRate] = useState(false);

    useEffect(() => {
      if (!isEditingClock) {
        setClockInputText(`${clockSpeedPct}%`);
      }
    }, [clockSpeedPct, isEditingClock]);

    useEffect(() => {
      if (!isEditingRate) {
        setRateInputText(`${targetOutputRate}`);
      }
    }, [targetOutputRate, isEditingRate]);

    const handleSliderChange = (rawVal: number) => {
      if (!onUpdateOverclock) return;
      const clampedVal = clampClockSpeedPct(Math.round(rawVal), powerShards);
      onUpdateOverclock(clampedVal, powerShards);
    };

    const commitClockInput = (rawText: string) => {
      setIsEditingClock(false);
      if (!onUpdateOverclock) return;
      const cleaned = rawText.replace(/%/g, '').replace(/,/g, '.').trim();
      const parsed = Number.parseFloat(cleaned);
      if (!Number.isFinite(parsed)) {
        setClockInputText(`${clockSpeedPct}%`);
        return;
      }
      const nextClock = clampClockSpeedPct(parsed, powerShards);
      setClockInputText(`${nextClock}%`);
      onUpdateOverclock(nextClock, powerShards);
    };

    const commitRateInput = (rawText: string) => {
      setIsEditingRate(false);
      if (!onUpdateOverclock || baseOutputRate <= 0) {
        setRateInputText(`${targetOutputRate}`);
        return;
      }
      const cleaned = rawText.replace(/,/g, '.').trim();
      const parsedRate = Number.parseFloat(cleaned);
      if (!Number.isFinite(parsedRate)) {
        setRateInputText(`${targetOutputRate}`);
        return;
      }
      const desiredClockPct = (parsedRate / baseOutputRate) * 100;
      const nextClock = clampClockSpeedPct(desiredClockPct, powerShards);
      onUpdateOverclock(nextClock, powerShards);
    };

    const handleToggleShardSlot = (slotIndex: number) => {
      if (!onUpdateOverclock) return;
      const targetShards = slotIndex + 1 === powerShards ? slotIndex : slotIndex + 1;
      const maxClockForTarget = getMaxClockSpeedPct(targetShards);
      const nextClock = Math.min(clockSpeedPct, maxClockForTarget);
      onUpdateOverclock(nextClock, targetShards);
    };

    return (
      <div className="relative w-[563px] h-[315px] shrink-0 select-none overflow-hidden">
        {/* Authentic Satisfactory Lower Bay Artwork (Overclock + Multiplier + Copy/Paste + Standby) */}
        <img
          src="./icons/buildings/machine_lower_bay_clean.png"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        />

        {/* =============================================================== */}
        {/* LIVE OVERCLOCK WHITE CARD INTERIOR (x=9.1%..69.2%, y=6.2%..44.5%) */}
        {/* =============================================================== */}
        <div
          style={{
            left: '9.1%',
            top: '6.2%',
            width: '60.1%',
            height: '38.3%',
          }}
          className="absolute flex flex-col justify-between text-[#333538] overflow-hidden px-2.5 pt-1.5 pb-1"
        >
          {/* Full-Height Vertical Column Divider Lines at 40% (100%), 60% (150%), 80% (200%) */}
          <span className="pointer-events-none absolute top-0 bottom-3.5 left-[40%] w-[1.5px] bg-[#DF8A2E] z-10" />
          <span className="pointer-events-none absolute top-0 bottom-3.5 left-[60%] w-[1px] bg-[#D4D6DA] z-10" />
          <span className="pointer-events-none absolute top-0 bottom-3.5 left-[80%] w-[1px] bg-[#D4D6DA] z-10" />

          {/* Upper Row: Left 40% Clock Speed Readouts + Right 3x20% Power Shard Slots */}
          <div className="flex items-center flex-1 min-h-0">
            <div className="w-[40%] pr-2 flex flex-col justify-center">
              <div className="text-[10px] font-bold text-[#44464B] leading-tight">
                Clock Speed:
              </div>
              <input
                type="text"
                inputMode="decimal"
                aria-label="Clock Speed Percentage Input"
                title="Enter exact clock speed percentage (1% up to unlocked max)"
                value={clockInputText}
                onFocus={(e) => {
                  setIsEditingClock(true);
                  setClockInputText(`${clockSpeedPct}`);
                  e.currentTarget.select();
                }}
                onChange={(e) => setClockInputText(e.target.value)}
                onBlur={(e) => commitClockInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setIsEditingClock(false);
                    setClockInputText(`${clockSpeedPct}%`);
                    e.currentTarget.blur();
                  }
                }}
                className="w-[78px] px-1.5 py-[0.5px] rounded-[2px] bg-[#F2F3F5] border border-[#E0E2E6] focus:border-[#DF8A2E] focus:bg-white focus:outline-none text-[14px] font-sans font-bold text-[#DF8A2E] leading-tight select-text"
              />
              <div className="text-[9.5px] font-bold text-[#44464B] leading-tight mt-0.5">
                Target production rate:
              </div>
              <div className="text-[11px] text-[#55575C] flex items-center gap-1 leading-tight mt-0.5">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Target Production Rate Per Minute Input"
                  title="Enter exact items per minute to automatically set clock speed"
                  value={rateInputText}
                  onFocus={(e) => {
                    setIsEditingRate(true);
                    setRateInputText(`${targetOutputRate}`);
                    e.currentTarget.select();
                  }}
                  onChange={(e) => setRateInputText(e.target.value)}
                  onBlur={(e) => commitRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setIsEditingRate(false);
                      setRateInputText(`${targetOutputRate}`);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-[46px] text-center px-1 py-[0.5px] rounded-[2px] bg-[#F2F3F5] border border-[#E0E2E6] focus:border-[#DF8A2E] focus:bg-white focus:outline-none font-sans font-bold text-[#DF8A2E] select-text"
                />
                <span className="font-medium text-[10.5px]">
                  {isCompactRate ? '/m' : 'per minute'}
                </span>
              </div>
            </div>

            {/* 3 Interactive Power Shard Slots (each 20% width) */}
            {[0, 1, 2].map((slotIdx) => {
              const isInstalled = slotIdx < powerShards;
              const unlockedCap = 150 + slotIdx * 50;
              return (
                <div
                  key={slotIdx}
                  className="w-[20%] flex items-center justify-center"
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
                    className={`relative w-11 h-11 rounded-[3px] bg-[#D8D9DC] border flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                      isInstalled
                        ? 'border-[#DF8A2E] ring-1 ring-[#DF8A2E]/60 pb-2'
                        : 'border-[#C5C7CB] hover:border-[#DF8A2E]'
                    }`}
                  >
                    <PowerShardCrystalIcon active={isInstalled} />
                    {isInstalled ? (
                      <span className="absolute bottom-0 inset-x-0 text-center py-[0.5px] bg-[#DF8A2E] font-sans text-[8.5px] font-bold leading-tight text-white">
                        1/1
                      </span>
                    ) : (
                      <span className="absolute bottom-0 right-0 px-1 rounded-tl-[2px] bg-[#686B70] font-sans text-[9px] font-bold leading-tight text-white">
                        1
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Segmented 0% — 100% | 150% | 200% | 250% Slider Bar */}
          <div>
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
                className="absolute left-0 text-[#DF8A2E] hover:underline cursor-pointer"
              >
                0%
              </button>
              <button
                type="button"
                onClick={() => handleSliderChange(100)}
                className="absolute left-[40%] -translate-x-1/2 text-[#DF8A2E] hover:underline cursor-pointer"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => handleSliderChange(150)}
                className={`absolute left-[60%] -translate-x-1/2 ${
                  maxUnlockedClockPct >= 150
                    ? 'text-[#DF8A2E] hover:underline cursor-pointer'
                    : 'text-[#A0A3A9] cursor-not-allowed'
                }`}
              >
                150%
              </button>
              <button
                type="button"
                onClick={() => handleSliderChange(200)}
                className={`absolute left-[80%] -translate-x-1/2 ${
                  maxUnlockedClockPct >= 200
                    ? 'text-[#DF8A2E] hover:underline cursor-pointer'
                    : 'text-[#A0A3A9] cursor-not-allowed'
                }`}
              >
                200%
              </button>
              <button
                type="button"
                onClick={() => handleSliderChange(250)}
                className={`absolute right-0 ${
                  maxUnlockedClockPct >= 250
                    ? 'text-[#DF8A2E] hover:underline cursor-pointer'
                    : 'text-[#A0A3A9] cursor-not-allowed'
                }`}
              >
                250%
              </button>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* SOMERSLOOP MULTIPLIER SLOT OVERLAY (x=79.6%..87.1%, y=9.8%..27.5%) */}
        {/* =============================================================== */}
        <div
          style={{
            left: '79.6%',
            top: '9.8%',
            width: '7.55%',
            height: '17.65%',
          }}
          className="absolute flex items-center justify-center pointer-events-none"
        >
          <MultiplierSlotSilhouetteIcon />
          <span className="absolute bottom-0 right-0 px-1 rounded-tl-[2px] bg-[#686B70] text-white font-sans text-[9px] font-bold leading-tight">
            1
          </span>
        </div>

        {/* =============================================================== */}
        {/* INTERACTIVE COPY & PASTE SETTINGS BUTTONS ON LEFT FOOTER        */}
        {/* =============================================================== */}
        <button
          type="button"
          onClick={onCopySettings}
          style={{
            left: '2.2%',
            top: '64.3%',
            width: '31.2%',
            height: '10.8%',
          }}
          className="absolute rounded-[3px] hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
          aria-label="Copy Settings"
          title="Copy machine recipe, clock speed, and power shard settings"
        >
          <span className="sr-only">Copy Settings</span>
        </button>

        <button
          type="button"
          onClick={onPasteSettings}
          disabled={!hasCopiedSettings}
          style={{
            left: '2.2%',
            top: '76.2%',
            width: '31.2%',
            height: '10.8%',
          }}
          className={`absolute rounded-[3px] transition-colors ${
            hasCopiedSettings
              ? 'hover:bg-white/10 active:bg-white/15 cursor-pointer'
              : 'bg-black/35 cursor-not-allowed'
          }`}
          aria-label="Paste Settings"
          title={
            hasCopiedSettings
              ? 'Paste copied settings onto this machine'
              : 'Copy settings from a machine first'
          }
        >
          <span className="sr-only">Paste Settings</span>
        </button>

        {/* =============================================================== */}
        {/* SYMMETRICAL ILLUMINATED I / O STANDBY ROCKER SWITCH ON RIGHT    */}
        {/* =============================================================== */}
        <button
          type="button"
          aria-label="Toggle Standby Mode"
          aria-pressed={isStandby}
          onClick={onToggleStandby}
          style={{
            left: '86.6%',
            top: '64.8%',
            width: '8.7%',
            height: '19.3%',
          }}
          className="absolute flex items-center justify-center cursor-pointer group"
          title={isStandby ? 'Machine in Standby (O) — Tap to resume (I)' : 'Machine Running (I) — Tap for Standby (O)'}
        >
          <span className="w-[22px] h-[38px] rounded-[2px] overflow-hidden border border-[#141518] bg-[#141518] p-[1.5px] flex flex-col shadow-md group-hover:ring-1 group-hover:ring-[#DF8A2E]">
            {/* Top Half: I (ON / RUNNING) */}
            <span
              className={`w-full h-1/2 flex items-center justify-center transition-all ${
                !isStandby
                  ? 'bg-gradient-to-b from-[#FF981A] to-[#D96B16] shadow-[0_0_8px_rgba(255,152,26,0.75)]'
                  : 'bg-gradient-to-b from-[#454950] to-[#282B30]'
              }`}
            >
              <span
                className={`w-[2px] h-2.5 rounded-full ${
                  !isStandby ? 'bg-white' : 'bg-white/45'
                }`}
              />
            </span>
            {/* Bottom Half: O (STANDBY / OFF) */}
            <span
              className={`w-full h-1/2 flex items-center justify-center border-t border-black/50 transition-all ${
                isStandby
                  ? 'bg-gradient-to-b from-[#EF4444] to-[#B91C1C] shadow-[0_0_8px_rgba(239,68,68,0.75)]'
                  : 'bg-gradient-to-b from-[#454950] to-[#282B30]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full border-[1.6px] ${
                  isStandby ? 'border-white' : 'border-white/50'
                }`}
              />
            </span>
          </span>
        </button>
      </div>
    );
  }
);
