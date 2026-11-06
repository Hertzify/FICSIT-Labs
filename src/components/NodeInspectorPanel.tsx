/**
 * ============================================================================
 * MODULE INDEX: Satisfactory Machine Inspector GUI (`src/components/NodeInspectorPanel.tsx`)
 * ============================================================================
 * [Lines 028-065] NodeInspectorPanelProps & Monochrome Telemetry SVG Icons
 * [Lines 067-155] NodeInspectorPanel State, Viewport Fit Scaling & Telemetry Calculations
 * [Lines 157-215] World Resource Deposit Standalone Inspector Popup
 * [Lines 217-315] Top Satisfactory Window Title Bar, Recipe/Production Tabs & Utility Strip
 * [Lines 317-385] Recipe Selection Tab Grid
 * [Lines 387-535] Miner Mk.1 Upper Bay (3D Cylindrical Drum + Collars + Dark Telemetry + White OUTPUT Card)
 * [Lines 537-720] Smelter / Constructor / Assembler 3-Column Production Bay
 * [Lines 722-765] Delegation to `MachineOverclockSection` & `PioneerInventoryPanel`
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  BUILDINGS,
  clampClockSpeedPct,
  getBuildingMaxStorage,
  getBuildingPowerMw,
  getMaxClockSpeedPct,
  getScaledCycleTimeSec,
  getScaledRatePerMin,
  PURITY_CONFIG,
  RECIPES,
} from '../game/catalog';
import { isMinerDirectlyOnDeposit } from '../game/geometry';
import { getItemIconUrl } from '../game/icons';
import {
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { MachineOverclockSection } from './MachineOverclockSection';
import {
  PioneerInventoryPanel,
  ScrewHead,
  StemBadge,
} from './PioneerInventoryPanel';

const PowerBoltSvg: React.FC = () => (
  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
  </svg>
);

const StopwatchSvg: React.FC = () => (
  <svg
    className="w-3.5 h-3.5 text-white"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <path strokeLinecap="round" d="M10 2h4M12 2v3M19 6l-1.5 1.5" />
    <circle cx="12" cy="14" r="7" />
    <path strokeLinecap="round" d="M12 14V10" />
  </svg>
);

const EfficiencyBarsSvg: React.FC = () => (
  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="14" width="3.5" height="7" rx="0.5" />
    <rect x="8.5" y="10" width="3.5" height="11" rx="0.5" />
    <rect x="14" y="6" width="3.5" height="15" rx="0.5" />
    <rect x="19.5" y="3" width="2.5" height="18" rx="0.5" />
  </svg>
);

interface NodeInspectorPanelProps {
  node: MachineNode;
  nodes?: MachineNode[];
  settings: SettingsConfig;
  onClose: () => void;
  onSelectRecipe: (recipeId: string) => void;
  onUpdateOverclock?: (clockSpeedPct: number, powerShards: number) => void;
  onToggleStandby?: () => void;
  onCopySettings?: () => void;
  onPasteSettings?: () => void;
  hasCopiedSettings?: boolean;
  onFlushBuffer: () => void;
  onFillInputBuffer?: () => void;
  onFillOutputBuffer?: () => void;
  onUnwireBelts: () => void;
  onDismantleNode: () => void;
}

const DESIGN_WIDTH = 860;
const DESIGN_HEIGHT = 605;

export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = React.memo(
  ({
    node,
    nodes = [],
    settings,
    onClose,
    onSelectRecipe,
    onUpdateOverclock,
    onToggleStandby,
    onCopySettings,
    onPasteSettings,
    hasCopiedSettings = false,
    onFlushBuffer,
    onFillInputBuffer,
    onFillOutputBuffer,
    onUnwireBelts,
    onDismantleNode,
  }) => {
    const buildingDef = BUILDINGS[node.buildingId];
    const [activeTab, setActiveTab] = useState<'production' | 'recipe'>('production');
    const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
      w: typeof window !== 'undefined' ? window.innerWidth : 1280,
      h: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));

    useEffect(() => {
      const onResize = () => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    if (!buildingDef) return null;

    const isWorldDeposit =
      node.buildingId === 'resource_deposit' || Boolean(node.isWorldDeposit);
    const isMiner = node.buildingId === 'miner_mk1';
    const isRecipeMachine =
      buildingDef.availableRecipeIds.length > 0 && !isMiner && !isWorldDeposit;

    const underlyingDeposit = isMiner
      ? nodes.find(
          (n) =>
            n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(node, n, 4)
        )
      : undefined;

    const powerShards = Math.min(3, Math.max(0, Math.floor(node.powerShards ?? 0)));
    const clockSpeedPct = clampClockSpeedPct(node.clockSpeedPct ?? 100, powerShards);
    const maxUnlockedClockPct = getMaxClockSpeedPct(powerShards);
    const isStandby = Boolean(node.isStandby);

    const activeRecipe = node.recipeId ? RECIPES[node.recipeId] : null;
    const depositPurityCfg = underlyingDeposit
      ? PURITY_CONFIG[underlyingDeposit.purity ?? 'normal'] ?? PURITY_CONFIG.normal
      : PURITY_CONFIG.normal;

    const baseCycleSec = isMiner
      ? underlyingDeposit
        ? Number((60 / depositPurityCfg.ratePerMin).toFixed(2))
        : 1.0
      : activeRecipe?.cycleTimeSec ?? 2.0;

    const scaledCycleSec = getScaledCycleTimeSec(baseCycleSec, clockSpeedPct);
    const powerMw = getBuildingPowerMw(node.buildingId, clockSpeedPct, isStandby);
    const effPct = Math.max(0, Math.min(100, Math.round(node.efficiency ?? 0)));
    const progressPct = Math.max(0, Math.min(100, Math.round((node.progress ?? 0) * 100)));

    const baseOutputRate = isMiner
      ? underlyingDeposit
        ? depositPurityCfg.ratePerMin
        : 0
      : activeRecipe?.outputs[0]?.ratePerMin ?? 30;
    const targetOutputRate = getScaledRatePerMin(baseOutputRate, clockSpeedPct);

    const maxOutCap =
      node.maxStoredCount ??
      getBuildingMaxStorage(
        node.buildingId,
        node.recipeId,
        node.outputs[0]?.itemName ?? node.inputs[0]?.itemName ?? null
      );
    const curOutStored = Math.min(maxOutCap, Math.floor(node.storedCount ?? 0));

    // World Deposit standalone inspector
    if (isWorldDeposit) {
      const purityKey = node.purity ?? 'normal';
      const pCfg = PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal;
      const depRecipe = node.recipeId ? RECIPES[node.recipeId] : RECIPES.deposit_iron;
      const oreName = depRecipe?.outputs[0]?.itemName ?? 'Iron Ore';
      const oreIcon = getItemIconUrl(oreName);

      return (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
          className="fixed bottom-3 right-3 z-30 w-80 rounded-xl bg-[#202226] border-2 border-[#3E4147] shadow-2xl overflow-hidden text-white"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-[#34373D] border-b border-[#18191C]">
            <div className="flex items-center gap-2">
              {oreIcon && <img src={oreIcon} alt={oreName} className="w-5 h-5 object-contain" />}
              <span className="text-xs font-bold tracking-wide">{node.title}</span>
            </div>
            <button
              type="button"
              aria-label="Close Node Inspector"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#474B53] hover:bg-rose-600 text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <div className="p-3 space-y-2.5 bg-[#2A2C30]">
            <div className="p-2.5 rounded-lg bg-[#18191C] border border-[#3E4147] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {oreIcon && (
                  <div className="w-10 h-10 rounded bg-[#D9D9D9] p-1 flex items-center justify-center">
                    <img src={oreIcon} alt={oreName} className="w-8 h-8 object-contain" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-white">{oreName} Vein</div>
                  <div className="text-[11px] text-slate-400">
                    Purity Modifier: {pCfg.multiplier}×
                  </div>
                </div>
              </div>
              <span
                className="px-2 py-1 rounded text-[11px] font-mono font-bold"
                style={{
                  backgroundColor: `${pCfg.badgeColor}22`,
                  color: pCfg.badgeColor,
                  border: `1px solid ${pCfg.badgeColor}77`,
                }}
              >
                {pCfg.label} · {pCfg.ratePerMin}/m
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Natural planetary mineral deposit. Place a{' '}
              <strong className="text-amber-400">Miner Mk.1</strong> directly on top of this
              vein to extract ore.
            </p>
          </div>
        </div>
      );
    }

    // Automatically scale the 860x605 Satisfactory two-column window so 100% of it fits inside any screen (including mobile landscape) without clipping or vertical scrolling
    const fitScale =
      Math.min(
        1,
        (viewport.w - 16) / DESIGN_WIDTH,
        (viewport.h - 16) / DESIGN_HEIGHT
      ) * settings.uiScale;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
        <div
          role="dialog"
          aria-label={`${node.title} Machine Window`}
          style={{
            width: `${DESIGN_WIDTH}px`,
            transform: `scale(${fitScale})`,
            transformOrigin: 'center center',
          }}
          className="flex flex-col rounded-[6px] bg-[#202226] border-2 border-[#45484F] shadow-[0_24px_70px_rgba(0,0,0,0.88)] overflow-hidden text-white pointer-events-auto"
        >
          {/* =================================================================== */}
          {/* TOP SATISFACTORY WINDOW TITLE BAR, TABS & COMPACT UTILITY CONTROLS  */}
          {/* =================================================================== */}
          <div className="flex items-center justify-between bg-[#37393E] border-b-2 border-[#1B1C1F] h-8 shrink-0 select-none">
            <div className="flex items-center h-full">
              {isRecipeMachine ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recipe')}
                    className={`h-full px-4 flex items-center gap-2 text-xs font-semibold border-r border-[#222428] transition-colors ${
                      activeTab === 'recipe'
                        ? 'bg-[#575A62] text-white shadow-inner'
                        : 'bg-[#37393E] text-slate-300 hover:bg-[#45484F]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" />
                      <rect x="9" y="1" width="6" height="6" />
                      <rect x="1" y="9" width="6" height="6" />
                      <rect x="9" y="9" width="6" height="6" />
                    </svg>
                    <span>Select Recipe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('production')}
                    className={`h-full px-4 flex items-center gap-2 text-xs font-semibold border-r border-[#222428] transition-colors ${
                      activeTab === 'production'
                        ? 'bg-[#575A62] text-white shadow-inner'
                        : 'bg-[#37393E] text-slate-300 hover:bg-[#45484F]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 010 1.06L6.56 12.5l4.94 4.94a.75.75 0 11-1.06 1.06l-5.47-5.47a.75.75 0 010-1.06l7.75-7.75a.75.75 0 011.06 0z" />
                      <path d="M14.7 3.3l6 6-2.8 2.8-6-6 2.8-2.8zM4 20l6.5-6.5 2 2L6 22l-2-2z" />
                    </svg>
                    <span>Production</span>
                  </button>
                </>
              ) : (
                <div className="px-3.5 h-full flex items-center gap-2 text-xs font-semibold text-white">
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
                    <path d="M1.5 5.5h5l1.5-2" />
                  </svg>
                  <span>{isMiner ? 'Miner' : node.title}</span>
                  {isMiner && underlyingDeposit && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-black/35 text-[10px] font-mono text-amber-300 border border-amber-500/40">
                      {depositPurityCfg.label} · {depositPurityCfg.ratePerMin}/m
                    </span>
                  )}
                  {isMiner && !underlyingDeposit && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-rose-950/80 text-[10px] font-mono text-rose-300 border border-rose-500/50">
                      UNMOUNTED
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Compact Simulator Actions in Header Bar (keeps main Machine UI 100% authentic) */}
            <div className="flex items-center h-full">
              <div className="flex items-center gap-1 px-2">
                {onFillInputBuffer && node.inputs.length > 0 && (
                  <button
                    type="button"
                    onClick={onFillInputBuffer}
                    className="px-1.5 py-0.5 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#454850] text-[9px] font-mono text-cyan-300"
                  >
                    Fill In
                  </button>
                )}
                {onFillOutputBuffer && (
                  <button
                    type="button"
                    onClick={onFillOutputBuffer}
                    className="px-1.5 py-0.5 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#454850] text-[9px] font-mono text-amber-300"
                  >
                    Fill Out
                  </button>
                )}
                <button
                  type="button"
                  onClick={onUnwireBelts}
                  className="px-1.5 py-0.5 rounded bg-[#26282E] hover:bg-[#32353D] border border-[#454850] text-[9px] font-mono text-slate-300"
                >
                  Unwire
                </button>
                <button
                  type="button"
                  onClick={onDismantleNode}
                  className="px-1.5 py-0.5 rounded bg-rose-950/75 hover:bg-rose-800 border border-rose-700/60 text-[9px] font-mono text-rose-200"
                >
                  Dismantle
                </button>
              </div>

              <button
                type="button"
                aria-label="Close Node Inspector"
                onClick={onClose}
                className="w-11 h-full flex items-center justify-center bg-[#575A62] hover:bg-rose-600 text-white text-sm font-bold border-l border-[#222428] transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* =================================================================== */}
          {/* FIXED TWO-COLUMN BODY: LEFT MACHINE GUI + RIGHT PIONEER INVENTORY   */}
          {/* =================================================================== */}
          <div className="grid grid-cols-[500px_360px] divide-x-2 divide-[#141518] bg-[#23252A]">
            {/* LEFT COLUMN: AUTHENTIC SATISFACTORY MACHINE INTERFACE */}
            <div className="p-2 flex flex-col gap-1.5 bg-[#23252A]">
              {isRecipeMachine && activeTab === 'recipe' ? (
                /* RECIPE SELECTION TAB VIEW */
                <div className="h-[250px] rounded-md bg-[#686B70] border-2 border-[#2A2C30] p-2.5 flex flex-col gap-2 shadow-inner">
                  <div className="flex items-center justify-between bg-[#18191C] px-3 py-1.5 rounded border border-[#3E4147]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#DF8A2E]">
                      Available {buildingDef.name} Recipes
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('production')}
                      className="px-2 py-0.5 rounded bg-[#37393E] hover:bg-[#4A4D55] text-[11px] font-semibold text-white"
                    >
                      Back to Production
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 overflow-y-auto">
                    {buildingDef.availableRecipeIds.map((rId) => {
                      const r = RECIPES[rId];
                      if (!r) return null;
                      const isSelected = node.recipeId === rId;
                      const outSpec = r.outputs[0];
                      const outIcon = getItemIconUrl(outSpec?.itemId ?? outSpec?.itemName);
                      return (
                        <button
                          key={rId}
                          type="button"
                          onClick={() => {
                            onSelectRecipe(rId);
                            setActiveTab('production');
                          }}
                          className={`p-2 rounded-md border-2 text-left flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-[#18191C] border-[#DF8A2E] shadow-md'
                              : 'bg-[#26282E] border-[#3B3E45] hover:border-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded bg-[#D9D9D9] p-1 flex items-center justify-center shrink-0">
                              {outIcon && (
                                <img
                                  src={outIcon}
                                  alt={r.name}
                                  className="w-7 h-7 object-contain"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {r.name}
                              </div>
                              <div className="text-[10px] text-slate-300 truncate">
                                {r.inputs.map((i) => `${i.ratePerMin}/m ${i.itemName}`).join(' + ')}
                              </div>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-[#DF8A2E]/20 border border-[#DF8A2E] text-[#DF8A2E] font-mono text-[10px] font-bold shrink-0">
                            {outSpec?.ratePerMin ?? 30}/m
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : isMiner ? (
                /* MINER MK.1 EXACT UPPER BAY (3D CYLINDRICAL DRUM + TELEMETRY + OUTPUT) */
                <div className="relative h-[250px] rounded-md bg-gradient-to-b from-[#7E8186] via-[#6D7075] to-[#5F6267] border-2 border-[#222428] p-1.5 shadow-inner">
                  {/* Inner recessed steel perimeter groove */}
                  <div className="relative w-full h-full rounded-[4px] border-2 border-[#3A3D42] flex items-center">
                    <ScrewHead className="absolute top-1.5 left-1.5" />
                    <ScrewHead className="absolute top-1.5 right-1.5" />
                    <ScrewHead className="absolute bottom-1.5 left-1.5" />
                    <ScrewHead className="absolute bottom-1.5 right-1.5" />
                    {/* Intermediate side screws flanking the drum assembly */}
                    <ScrewHead className="absolute top-[28%] left-[22px]" />
                    <ScrewHead className="absolute bottom-[28%] left-[22px]" />
                    <ScrewHead className="absolute top-[28%] right-[36px]" />
                    <ScrewHead className="absolute bottom-[28%] right-[36px]" />

                    {/* 3D Cylindrical Rotating Drum Assembly (Left Cap + Left Chrome Ring + Curved Ribs + Right Chrome Ring + Right Cap) */}
                    <div className="ml-9 flex items-center">
                      {/* Left Curved Dark End-Cap */}
                      <div className="w-4 h-[178px] rounded-l-lg bg-gradient-to-b from-[#181A1D] via-[#5C6067] via-35% to-[#141518] border-y border-l border-[#1E2024] shadow-lg" />
                      {/* Left Bright Specular Chrome Collar */}
                      <div className="w-5 h-[206px] rounded-[2px] bg-gradient-to-b from-[#2A2D32] via-[#ECEFF3] via-35% to-[#1C1E22] border-x border-[#181A1D] shadow-md" />
                      {/* Center Recessed Ribbed Drum Cavity */}
                      <div className="relative w-[132px] h-[214px] bg-[#0B0C0E] border-y-4 border-x-2 border-[#25272C] px-1 py-1.5 flex flex-col justify-between shadow-inner overflow-hidden">
                        {[
                          'from-[#484B50] via-[#656970] to-[#1A1C1F]',
                          'from-[#787C83] via-[#B4B8BF] to-[#282B30]',
                          'from-[#9EA2A9] via-[#E2E5EA] to-[#3A3E44]',
                          'from-[#8C9097] via-[#C8CCD2] to-[#303338]',
                          'from-[#686C73] via-[#989CA3] to-[#23262A]',
                          'from-[#4A4E54] via-[#6E7279] to-[#1A1C20]',
                          'from-[#32353A] via-[#4A4E54] to-[#121417]',
                        ].map((grad, idx) => (
                          <div
                            key={idx}
                            className={`h-[21px] w-full rounded-[1px] bg-gradient-to-b ${grad} border-y border-black/70 shadow`}
                          />
                        ))}
                        {/* Right-edge drop shadow cast onto the drum by the overlapping telemetry module */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-black/75 to-transparent" />
                      </div>

                      {/* Overlapping Dark Gunmetal Telemetry & Crisp White OUTPUT Module */}
                      <div className="relative -ml-4 z-10 w-[198px] rounded-[5px] bg-[#222428] border-2 border-[#101114] px-2 pt-2 pb-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.9)] flex flex-col">
                        <ScrewHead className="absolute top-1.5 left-1.5" />
                        <ScrewHead className="absolute top-1.5 right-1.5" />

                        {/* Upper Dark Screen */}
                        <div className="relative bg-[#07080A] rounded-[3px] border border-[#1E2025] px-3 pt-2 pb-3.5 text-center">
                          {/* Solid Satisfactory Progress Bar */}
                          <div className="w-full h-4 bg-[#73757A] flex overflow-hidden">
                            <div
                              className="h-full bg-[#DF8A2E] transition-all duration-150"
                              style={{ width: `${isStandby ? 0 : progressPct}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] font-sans text-[#D4D5D8]">
                            {isStandby ? 'Standby' : 'Mining'} -{' '}
                            <span className="text-[#DF8A2E] font-bold">
                              {isStandby ? 0 : progressPct} %
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 pt-1.5 text-[10.5px] font-sans font-bold">
                            <div className="flex flex-col items-center gap-0.5">
                              <PowerBoltSvg />
                              <span className="text-[#DF8A2E]">{powerMw} MW</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <StopwatchSvg />
                              <span className="text-[#DF8A2E]">{scaledCycleSec} s</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <EfficiencyBarsSvg />
                              <span className="text-[#DF8A2E]">{effPct} %</span>
                            </div>
                          </div>

                          {/* Overlapping 3D Beveled Circular Down-Arrow Badge */}
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-[#52555C] to-[#1E2024] border-2 border-[#0E0F12] flex items-center justify-center shadow-md z-10">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="currentColor">
                              <polygon points="3,5 13,5 8,12" />
                            </svg>
                          </div>
                        </div>

                        {/* Crisp White Output Card */}
                        {(() => {
                          const oreName =
                            node.outputs[0]?.itemName ??
                            activeRecipe?.outputs[0]?.itemName ??
                            'Iron Ore';
                          const oreIcon = getItemIconUrl(oreName);
                          return (
                            <div className="mt-1 bg-[#F5F5F7] rounded-[3px] text-[#333538] pt-3 pb-1.5 px-2.5 flex flex-col items-center shadow">
                              <div
                                onClick={onFillOutputBuffer}
                                title="Tap to fill output buffer"
                                className="relative w-12 h-12 rounded-[3px] bg-[#D5D6D9] border border-[#B8BAC0] flex items-center justify-center p-1 cursor-pointer hover:ring-2 hover:ring-[#DF8A2E]"
                              >
                                {oreIcon && (
                                  <img
                                    src={oreIcon}
                                    alt={oreName}
                                    className="w-9 h-9 object-contain"
                                  />
                                )}
                                <span className="absolute bottom-0 right-0 px-1.5 py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[10px] font-bold leading-tight">
                                  {curOutStored}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-[#333538] leading-tight">
                                {oreName} : 1
                              </div>
                              <div className="text-[10px] text-[#55575C] leading-tight">
                                <span className="text-[#DF8A2E] font-bold">
                                  {targetOutputRate}
                                </span>{' '}
                                per minute
                              </div>
                            </div>
                          );
                        })()}

                        {/* Bottom OUTPUT Badge with Vertical White Stem & Flanking Screws */}
                        <div className="relative flex items-center justify-center">
                          <ScrewHead className="absolute left-0.5 bottom-0.5" />
                          <StemBadge label="OUTPUT" />
                          <ScrewHead className="absolute right-0.5 bottom-0.5" />
                        </div>
                      </div>

                      {/* Right Bright Specular Chrome Collar + Curved End-Cap sticking out to the right of the telemetry box */}
                      <div className="-ml-1 w-6 h-[206px] rounded-[2px] bg-gradient-to-b from-[#2A2D32] via-[#ECEFF3] via-35% to-[#1C1E22] border-x border-[#181A1D] shadow-md" />
                      <div className="w-3.5 h-[174px] rounded-r-lg bg-gradient-to-b from-[#181A1D] via-[#4C5057] via-35% to-[#141518] border-y border-r border-[#1E2024] shadow-lg" />
                    </div>
                  </div>
                </div>
              ) : (
                /* SMELTER / CONSTRUCTOR / ASSEMBLER 3-COLUMN PRODUCTION BAY */
                <div className="relative h-[250px] rounded-md bg-gradient-to-b from-[#787B80] to-[#5F6267] border-2 border-[#222428] p-2 flex flex-col justify-between shadow-inner">
                  <div
                    onClick={() => isRecipeMachine && setActiveTab('recipe')}
                    className={`w-full rounded-[3px] bg-[#141518] border border-[#2C2E33] py-1 px-3 text-center shrink-0 ${
                      isRecipeMachine ? 'cursor-pointer hover:border-[#DF8A2E]' : ''
                    }`}
                  >
                    <div className="text-[9.5px] font-semibold text-[#DF8A2E] leading-tight">
                      Recipe:
                    </div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {activeRecipe?.name ?? node.title}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 mt-1.5 grid grid-cols-[1fr_112px_1fr] gap-1.5 items-stretch">
                    {/* LEFT COLUMN: Crisp White INPUT Card */}
                    <div className="flex flex-col">
                      <div className="flex-1 rounded-[4px] bg-[#F5F5F7] border-2 border-[#2C2E33] p-2 flex flex-col justify-center gap-2 text-[#333538]">
                        {node.inputs.length === 0 ? (
                          <div className="text-center text-xs text-slate-400">No Inputs</div>
                        ) : (
                          node.inputs.map((inPort, idx) => {
                            const rIn = activeRecipe?.inputs[idx];
                            const itemName =
                              rIn?.itemName ?? inPort.itemName ?? inPort.label ?? 'Input';
                            const itemIcon = getItemIconUrl(rIn?.itemId ?? itemName);
                            const reqPerCycle = rIn
                              ? Math.max(
                                  1,
                                  Math.round((rIn.ratePerMin * baseCycleSec) / 60)
                                )
                              : 1;
                            const scaledInRate = getScaledRatePerMin(
                              rIn?.ratePerMin ?? inPort.targetRatePerMin ?? 30,
                              clockSpeedPct
                            );
                            const curBuf = Math.floor(inPort.bufferedCount ?? 0);

                            return (
                              <div
                                key={inPort.id}
                                onClick={onFillInputBuffer}
                                title="Tap to fill input buffer"
                                className="flex items-center gap-2 cursor-pointer group"
                              >
                                <div className="relative w-11 h-11 rounded-[3px] bg-[#D5D6D9] border border-[#B8BAC0] p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#DF8A2E]">
                                  {itemIcon && (
                                    <img
                                      src={itemIcon}
                                      alt={itemName}
                                      className="w-8 h-8 object-contain"
                                    />
                                  )}
                                  <span className="absolute bottom-0 inset-x-0 text-center py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[9.5px] font-bold leading-tight">
                                    {curBuf}/{reqPerCycle}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-[#333538] truncate">
                                    {reqPerCycle} {itemName}
                                  </div>
                                  <div className="text-[10px] text-[#55575C]">
                                    <span className="text-[#DF8A2E] font-bold">
                                      {scaledInRate}
                                    </span>{' '}
                                    per minute
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <StemBadge label="INPUT" />
                    </div>

                    {/* CENTER COLUMN: Dark Screwed Telemetry Module */}
                    <div className="relative rounded-[4px] bg-[#2A2C32] border-2 border-[#141518] p-1.5 flex flex-col justify-between shadow-lg">
                      <div className="flex items-center justify-between px-0.5">
                        <ScrewHead />
                        <span className="w-9 h-1 rounded-full bg-[#141518]" />
                        <ScrewHead />
                      </div>

                      <div className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-b from-[#4E5158] to-[#222428] border border-[#141518] flex items-center justify-center z-10 shadow">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <polygon points="5,3 12,8 5,13" />
                        </svg>
                      </div>
                      <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-b from-[#4E5158] to-[#222428] border border-[#141518] flex items-center justify-center z-10 shadow">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <polygon points="5,3 12,8 5,13" />
                        </svg>
                      </div>

                      <div className="my-1 flex-1 rounded-[3px] bg-[#141518] px-2 py-1.5 flex flex-col items-center justify-between text-center">
                        {(() => {
                          const outName =
                            activeRecipe?.outputs[0]?.itemName ??
                            node.outputs[0]?.itemName ??
                            'Iron Ingot';
                          const outIcon = getItemIconUrl(outName);
                          return (
                            outIcon && (
                              <img
                                src={outIcon}
                                alt={outName}
                                className="w-9 h-9 object-contain"
                              />
                            )
                          );
                        })()}

                        <div className="w-full space-y-0.5">
                          <div className="w-full h-2.5 bg-[#73757A] flex overflow-hidden">
                            <div
                              className="h-full bg-[#DF8A2E] transition-all duration-150"
                              style={{ width: `${isStandby ? 0 : progressPct}%` }}
                            />
                          </div>
                          <div className="text-[9.5px] text-[#D4D5D8] leading-tight">
                            {isStandby ? 'Standby' : 'Constructing'} -{' '}
                            <span className="text-[#DF8A2E] font-bold">
                              {isStandby ? 0 : progressPct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center text-[10px] font-sans font-bold leading-tight">
                          <PowerBoltSvg />
                          <span className="text-[#DF8A2E]">{powerMw} MW</span>
                        </div>

                        <div className="flex flex-col items-center text-[10px] font-sans font-bold leading-tight">
                          <StopwatchSvg />
                          <span className="text-[#DF8A2E]">{scaledCycleSec} sec</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-0.5">
                        <ScrewHead />
                        <ScrewHead />
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Crisp White OUTPUT Card */}
                    <div className="flex flex-col">
                      <div className="flex-1 rounded-[4px] bg-[#F5F5F7] border-2 border-[#2C2E33] p-2 flex flex-col justify-center text-[#333538]">
                        {(() => {
                          const rOut = activeRecipe?.outputs[0];
                          const outName =
                            rOut?.itemName ??
                            node.outputs[0]?.itemName ??
                            'Output Part';
                          const outIcon = getItemIconUrl(rOut?.itemId ?? outName);
                          const outPerCycle = rOut
                            ? Math.max(
                                1,
                                Math.round((rOut.ratePerMin * baseCycleSec) / 60)
                              )
                            : 1;
                          return (
                            <div
                              onClick={onFillOutputBuffer}
                              title="Tap to fill output buffer"
                              className="flex items-center gap-2 cursor-pointer group"
                            >
                              <div className="relative w-11 h-11 rounded-[3px] bg-[#D5D6D9] border border-[#B8BAC0] p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#DF8A2E]">
                                {outIcon && (
                                  <img
                                    src={outIcon}
                                    alt={outName}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                                <span className="absolute bottom-0 right-0 px-1.5 py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[9.5px] font-bold leading-tight">
                                  {curOutStored}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-[#333538] truncate">
                                  {outPerCycle} {outName}
                                </div>
                                <div className="text-[10px] text-[#55575C]">
                                  <span className="text-[#DF8A2E] font-bold">
                                    {targetOutputRate}
                                  </span>{' '}
                                  per minute
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <StemBadge label="OUTPUT" />
                    </div>
                  </div>
                </div>
              )}

              {/* Overclocking (0%-250%, 3 Power Shards) + Multiplier + Copy/Paste/Standby Footer */}
              <MachineOverclockSection
                powerShards={powerShards}
                clockSpeedPct={clockSpeedPct}
                maxUnlockedClockPct={maxUnlockedClockPct}
                targetOutputRate={targetOutputRate}
                isStandby={isStandby}
                hasCopiedSettings={hasCopiedSettings}
                onUpdateOverclock={onUpdateOverclock}
                onToggleStandby={onToggleStandby}
                onCopySettings={onCopySettings}
                onPasteSettings={onPasteSettings}
              />
            </div>

            {/* RIGHT COLUMN: PIONEER PLAYER INVENTORY SIDEBAR */}
            <PioneerInventoryPanel
              node={node}
              nodes={nodes}
              activeRecipe={activeRecipe}
              powerShards={powerShards}
              clockSpeedPct={clockSpeedPct}
              onUpdateOverclock={onUpdateOverclock}
              onFillInputBuffer={onFillInputBuffer}
              onFlushBuffer={onFlushBuffer}
            />
          </div>
        </div>
      </div>
    );
  }
);
