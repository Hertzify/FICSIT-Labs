/**
 * ============================================================================
 * MODULE INDEX: Satisfactory Machine Inspector GUI (`src/components/NodeInspectorPanel.tsx`)
 * ============================================================================
 * Uses the authentic Satisfactory UI plates (`/icons/buildings/miner_top_bay_clean.png`,
 * `/icons/buildings/processor_top_bay_clean.png`, `/icons/buildings/machine_lower_bay_clean.png`)
 * extracted from the user's reference screenshots, overlaying live changeable values
 * while keeping the right-hand Pioneer Inventory translucent and never clipped on any screen.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  BUILDINGS,
  clampClockSpeedPct,
  formatRatePerMin,
  getBuildingMaxStorage,
  getBuildingPowerMw,
  getMaxClockSpeedPct,
  getScaledCycleTimeSec,
  getScaledRatePerMin,
  isCompactRateFormat,
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
import { PioneerInventoryPanel } from './PioneerInventoryPanel';

/**
 * Exact Satisfactory Power Consumption Icon:
 * Flat horizontal top edge, vertical upper-left edge, middle step, and sharp lower tip.
 */
const PowerBoltSvg: React.FC = () => (
  <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="8.5,2 15.5,2 12.2,10.5 17.5,10.5 8.5,22 10.8,13 6.8,13" />
  </svg>
);

/**
 * Exact Satisfactory Cooldown / Cycle Duration Stopwatch Icon:
 * Top flat T-cap plunger, angled upper-right ear button, circular outer bezel ring,
 * and 270-degree solid filled inner pie sector (3 o'clock clockwise around to 12 o'clock).
 */
const StopwatchSvg: React.FC = () => (
  <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24">
    <path
      d="M9.2 2h5.6M12 2v3.1M17.4 6.6l2-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
    <circle
      cx="12"
      cy="13.5"
      r="7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    />
    <path
      d="M12 13.5 L16.9 13.5 A4.9 4.9 0 1 1 12 8.6 Z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Exact Satisfactory Production Effectiveness 4-Bar Chart Icon:
 * Non-monotonic bar heights: Bar 1 = short (38%), Bar 2 = tall (100%), Bar 3 = medium (62%), Bar 4 = tall (100%).
 */
const EfficiencyBarsSvg: React.FC = () => (
  <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="14" width="3.2" height="7" />
    <rect x="8" y="3" width="3.2" height="18" />
    <rect x="13" y="9.5" width="3.2" height="11.5" />
    <rect x="18" y="3" width="3.2" height="18" />
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
}

// 563px Left Machine Column + 2px Divider + 401px Right Pioneer Inventory + 4px Outer Border = 970px
const DESIGN_WIDTH = 970;
const DESIGN_HEIGHT = 746;

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
  }) => {
    const buildingDef = BUILDINGS[node.buildingId];
    const [activeTab, setActiveTab] = useState<'production' | 'recipe'>('production');
    const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
      w:
        typeof window !== 'undefined'
          ? Math.min(
              window.innerWidth,
              document.documentElement?.clientWidth || window.innerWidth
            )
          : 1280,
      h:
        typeof window !== 'undefined'
          ? Math.min(
              window.innerHeight,
              document.documentElement?.clientHeight || window.innerHeight
            )
          : 800,
    }));

    useEffect(() => {
      const onResize = () => {
        setViewport({
          w: Math.min(
            window.innerWidth,
            document.documentElement?.clientWidth || window.innerWidth
          ),
          h: Math.min(
            window.innerHeight,
            document.documentElement?.clientHeight || window.innerHeight
          ),
        });
      };
      window.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('resize', onResize);
      };
    }, []);

    if (!buildingDef) return null;

    const isCompactRate = isCompactRateFormat(settings);
    const rateUnitSuffix = isCompactRate ? '/m' : ' per minute';

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
                {pCfg.label} · {formatRatePerMin(pCfg.ratePerMin, settings)}
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

    // Uniformly scale the 970x746 window so it always fits inside any screen without ever shrinking or clipping its columns
    const fitScale =
      Math.min(
        1,
        (viewport.w - 20) / DESIGN_WIDTH,
        (viewport.h - 20) / DESIGN_HEIGHT
      ) * settings.uiScale;

    return (
      <div
        role="dialog"
        aria-label={`${node.title} Machine Window`}
        style={{
          width: `${DESIGN_WIDTH}px`,
          height: `${DESIGN_HEIGHT}px`,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${fitScale})`,
        }}
        className="fixed z-30 shrink-0 flex flex-col rounded-[4px] bg-transparent border-2 border-[#45484F] shadow-[0_24px_70px_rgba(0,0,0,0.88)] overflow-hidden text-white pointer-events-auto"
      >
        {/* =================================================================== */}
        {/* TOP SATISFACTORY WINDOW TITLE BAR (100% AUTHENTIC: TITLE + [ ✕ ])    */}
        {/* =================================================================== */}
        <div className="flex items-center justify-between bg-[#3B3D42] border-b-2 border-[#1B1C1F] h-9 shrink-0 select-none">
          <div className="flex items-center h-full">
            {isRecipeMachine ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('recipe')}
                  className={`h-full px-4 flex items-center gap-2 text-xs font-semibold border-r border-[#222428] transition-colors cursor-pointer ${
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
                  className={`h-full px-4 flex items-center gap-2 text-xs font-semibold border-r border-[#222428] transition-colors cursor-pointer ${
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
              <div className="px-3.5 h-full flex items-center gap-2.5 text-[14px] font-medium text-white">
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
                  <path d="M1.5 5.5h5l1.5-2" />
                </svg>
                <span>{isMiner ? 'Miner' : node.title}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Close Node Inspector"
            onClick={onClose}
            className="w-20 h-full flex items-center justify-center bg-[#5E6066] hover:bg-rose-600 text-white text-sm font-bold border-l border-[#222428] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* =================================================================== */}
        {/* TWO-COLUMN BODY: 563px LEFT MACHINE UI + 401px TRANSLUCENT INVENTORY */}
        {/* =================================================================== */}
        <div className="flex flex-row items-stretch h-[706px] divide-x-2 divide-[#141518]">
          {/* LEFT COLUMN: AUTHENTIC SATISFACTORY MACHINE UI (563px WIDE) */}
          <div className="w-[563px] h-[706px] shrink-0 flex flex-col bg-[#202226]">
            {isRecipeMachine && activeTab === 'recipe' ? (
              /* RECIPE SELECTION TAB VIEW */
              <div className="w-[563px] h-[391px] shrink-0 bg-[#686B70] border-b-2 border-[#18191C] p-3 flex flex-col gap-2.5 shadow-inner">
                <div className="flex items-center justify-between bg-[#18191C] px-3 py-1.5 rounded border border-[#3E4147]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DF8A2E]">
                    Available {buildingDef.name} Recipes
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('production')}
                    className="px-2.5 py-0.5 rounded bg-[#37393E] hover:bg-[#4A4D55] text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Back to Production
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 overflow-y-auto">
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
                        className={`p-2.5 rounded-md border-2 text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#18191C] border-[#DF8A2E] shadow-md'
                            : 'bg-[#26282E] border-[#3B3E45] hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded bg-[#D9D9D9] p-1 flex items-center justify-center shrink-0">
                            {outIcon && (
                              <img
                                src={outIcon}
                                alt={r.name}
                                className="w-8 h-8 object-contain"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {r.name}
                            </div>
                            <div className="text-[10.5px] text-slate-300 truncate">
                              {r.inputs
                                .map(
                                  (i) =>
                                    `${formatRatePerMin(i.ratePerMin, settings)} ${i.itemName}`
                                )
                                .join(' + ')}
                            </div>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-[#DF8A2E]/20 border border-[#DF8A2E] text-[#DF8A2E] font-mono text-[10px] font-bold shrink-0">
                          {formatRatePerMin(outSpec?.ratePerMin ?? 30, settings)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isMiner ? (
              /* =============================================================== */
              /* MINER MK.1 EXACT SATISFACTORY TOP BAY (563x391)                 */
              /* =============================================================== */
              <div className="relative w-[563px] h-[391px] shrink-0 select-none overflow-hidden">
                <img
                  src="./icons/buildings/miner_top_bay_clean.png"
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                />

                {/* LIVE BLACK MONITOR SCREEN OVERLAY (left=42.6%, top=4.0%, width=34.4%, height=35.6%) */}
                <div
                  style={{
                    left: '42.6%',
                    top: '4.0%',
                    width: '34.4%',
                    height: '35.6%',
                  }}
                  className="absolute flex flex-col items-center justify-between px-3.5 pt-3.5 pb-2.5 text-center"
                >
                  {/* Solid Satisfactory Progress Bar */}
                  <div className="w-full h-[26px] bg-[#73757A] flex overflow-hidden shrink-0">
                    <div
                      className="h-full bg-[#DF8A2E] transition-all duration-150"
                      style={{ width: `${isStandby ? 0 : progressPct}%` }}
                    />
                  </div>

                  {/* Mining - X% */}
                  <div className="text-[12px] font-sans text-[#D4D5D8] leading-tight">
                    {isStandby ? 'Standby' : 'Mining'} -{' '}
                    <span className="text-[#DF8A2E] font-semibold">
                      {isStandby ? 0 : progressPct} %
                    </span>
                  </div>

                  {/* 3 Telemetry Columns: Power (MW), Cycle Time (s), Efficiency (%) */}
                  <div className="w-full grid grid-cols-3 gap-1 pt-0.5 text-[12.5px] font-sans font-semibold leading-tight">
                    <div className="flex flex-col items-center gap-1">
                      <PowerBoltSvg />
                      <span className="text-[#DF8A2E]">{powerMw} MW</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <StopwatchSvg />
                      <span className="text-[#DF8A2E]">{scaledCycleSec} s</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <EfficiencyBarsSvg />
                      <span className="text-[#DF8A2E]">{effPct} %</span>
                    </div>
                  </div>
                </div>

                {/* LIVE WHITE OUTPUT CARD OVERLAY (left=42.8%, top=50.6%, width=34.1%, height=30.6%) */}
                {(() => {
                  const oreName =
                    node.outputs[0]?.itemName ??
                    activeRecipe?.outputs[0]?.itemName ??
                    'Iron Ore';
                  const oreIcon = getItemIconUrl(oreName);
                  return (
                    <div
                      style={{
                        left: '42.8%',
                        top: '50.6%',
                        width: '34.1%',
                        height: '30.6%',
                      }}
                      className="absolute flex flex-col items-center justify-center text-[#333538] px-2"
                    >
                      <button
                        type="button"
                        onClick={onFillOutputBuffer}
                        title="Tap to fill output buffer"
                        className="relative w-[60px] h-[60px] rounded-[2px] bg-[#D5D6D9] border border-[#B8BAC0] flex items-center justify-center p-1.5 cursor-pointer hover:ring-2 hover:ring-[#DF8A2E]"
                      >
                        {oreIcon && (
                          <img
                            src={oreIcon}
                            alt={oreName}
                            className="w-12 h-12 object-contain"
                          />
                        )}
                        <span className="absolute bottom-0 right-0 px-1.5 py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[12px] font-bold leading-tight">
                          {curOutStored}
                        </span>
                      </button>
                      <div className="mt-1.5 text-[13px] font-bold text-[#333538] leading-tight">
                        {oreName} : 1
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#55575C] leading-tight">
                        <span className="text-[#DF8A2E] font-semibold">
                          {targetOutputRate}
                        </span>
                        {rateUnitSuffix}
                      </div>
                    </div>
                  );
                })()}

                {/* BOTTOM OUTPUT PILL LABEL (left=51.1%, top=83.7%, width=17.4%, height=4.8%) */}
                <div
                  style={{
                    left: '51.1%',
                    top: '83.7%',
                    width: '17.4%',
                    height: '4.8%',
                  }}
                  className="absolute flex items-center justify-center pointer-events-none"
                >
                  <span className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-[#333538] leading-none">
                    OUTPUT
                  </span>
                </div>
              </div>
            ) : (
              /* =============================================================== */
              /* SMELTER / CONSTRUCTOR / ASSEMBLER EXACT TOP BAY (563x391)       */
              /* =============================================================== */
              <div className="relative w-[563px] h-[391px] shrink-0 select-none overflow-hidden">
                <img
                  src="./icons/buildings/processor_top_bay_clean.png"
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                />

                {/* Clickable Top Recipe Header */}
                <button
                  type="button"
                  onClick={() => isRecipeMachine && setActiveTab('recipe')}
                  style={{
                    left: '1.8%',
                    top: '2.2%',
                    width: '96.4%',
                    height: '10.6%',
                  }}
                  className="absolute flex flex-col items-center justify-end pb-1.5 text-center cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="text-[14px] font-bold text-white leading-tight">
                    {activeRecipe?.name ?? node.title}
                  </span>
                </button>

                {/* Left White INPUT Card Interior (left=2.6%, top=17.5%, width=35.5%, height=71.8%) */}
                <div
                  style={{
                    left: '2.6%',
                    top: '17.5%',
                    width: '35.5%',
                    height: '71.8%',
                  }}
                  className="absolute flex flex-col justify-center gap-3 px-3 text-[#333538]"
                >
                  {node.inputs.length === 0 ? (
                    <div className="text-center text-xs text-slate-400">No Inputs</div>
                  ) : (
                    node.inputs.map((inPort, idx) => {
                      const rIn = activeRecipe?.inputs[idx];
                      const itemName =
                        rIn?.itemName ?? inPort.itemName ?? inPort.label ?? 'Input';
                      const itemIcon = getItemIconUrl(rIn?.itemId ?? itemName);
                      const reqPerCycle = rIn
                        ? Math.max(1, Math.round((rIn.ratePerMin * baseCycleSec) / 60))
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
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <div className="relative w-12 h-12 rounded-[2px] bg-[#D5D6D9] border border-[#B8BAC0] p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#DF8A2E]">
                            {itemIcon && (
                              <img
                                src={itemIcon}
                                alt={itemName}
                                className="w-9 h-9 object-contain"
                              />
                            )}
                            <span className="absolute bottom-0 inset-x-0 text-center py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[10px] font-bold leading-tight">
                              {curBuf}/{reqPerCycle}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-[#333538] truncate">
                              {reqPerCycle} {itemName}
                            </div>
                            <div className="text-[11px] text-[#55575C]">
                              <span className="text-[#DF8A2E] font-bold">
                                {scaledInRate}
                              </span>
                              {rateUnitSuffix}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Center Dark Monitor Screen Interior (left=43.0%, top=23.5%, width=14.6%, height=57.5%) */}
                <div
                  style={{
                    left: '43.0%',
                    top: '23.5%',
                    width: '14.6%',
                    height: '57.5%',
                  }}
                  className="absolute flex flex-col items-center justify-between py-2.5 px-1.5 text-center"
                >
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
                          className="w-11 h-11 object-contain"
                        />
                      )
                    );
                  })()}

                  <div className="w-full space-y-1">
                    <div className="w-full h-3 bg-[#73757A] flex overflow-hidden">
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

                  <div className="flex flex-col items-center gap-1.5 text-[10px] font-sans font-bold leading-tight">
                    <div className="flex flex-col items-center gap-0.5">
                      <PowerBoltSvg />
                      <span className="text-[#DF8A2E]">{powerMw} MW</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <StopwatchSvg />
                      <span className="text-[#DF8A2E]">{scaledCycleSec} sec</span>
                    </div>
                  </div>
                </div>

                {/* Right White OUTPUT Card Interior (left=62.4%, top=17.5%, width=35.5%, height=71.8%) */}
                <div
                  style={{
                    left: '62.4%',
                    top: '17.5%',
                    width: '35.5%',
                    height: '71.8%',
                  }}
                  className="absolute flex flex-col justify-center px-3 text-[#333538]"
                >
                  {(() => {
                    const rOut = activeRecipe?.outputs[0];
                    const outName =
                      rOut?.itemName ??
                      node.outputs[0]?.itemName ??
                      'Output Part';
                    const outIcon = getItemIconUrl(rOut?.itemId ?? outName);
                    const outPerCycle = rOut
                      ? Math.max(1, Math.round((rOut.ratePerMin * baseCycleSec) / 60))
                      : 1;
                    return (
                      <div
                        onClick={onFillOutputBuffer}
                        title="Tap to fill output buffer"
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <div className="relative w-12 h-12 rounded-[2px] bg-[#D5D6D9] border border-[#B8BAC0] p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#DF8A2E]">
                          {outIcon && (
                            <img
                              src={outIcon}
                              alt={outName}
                              className="w-9 h-9 object-contain"
                            />
                          )}
                          <span className="absolute bottom-0 right-0 px-1.5 py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[10px] font-bold leading-tight">
                            {curOutStored}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-[#333538] truncate">
                            {outPerCycle} {outName}
                          </div>
                          <div className="text-[11px] text-[#55575C]">
                            <span className="text-[#DF8A2E] font-bold">
                              {targetOutputRate}
                            </span>
                            {rateUnitSuffix}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Overclocking (0%-250%, 3 Power Shards) + Multiplier + Copy/Paste/Standby Footer */}
            <MachineOverclockSection
              powerShards={powerShards}
              clockSpeedPct={clockSpeedPct}
              maxUnlockedClockPct={maxUnlockedClockPct}
              baseOutputRate={baseOutputRate}
              targetOutputRate={targetOutputRate}
              isStandby={isStandby}
              hasCopiedSettings={hasCopiedSettings}
              rateDisplayFormat={settings.rateDisplayFormat}
              onUpdateOverclock={onUpdateOverclock}
              onToggleStandby={onToggleStandby}
              onCopySettings={onCopySettings}
              onPasteSettings={onPasteSettings}
            />
          </div>

          {/* RIGHT COLUMN: TRANSLUCENT PIONEER PLAYER INVENTORY SIDEBAR (401px WIDE) */}
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
    );
  }
);
