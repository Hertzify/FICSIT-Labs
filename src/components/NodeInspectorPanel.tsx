/**
 * ============================================================================
 * MODULE INDEX: Satisfactory Machine Inspector GUI (`src/components/NodeInspectorPanel.tsx`)
 * ============================================================================
 * [Lines 028-054] NodeInspectorPanelProps
 * [Lines 056-135] NodeInspectorPanel State & Telemetry Calculations
 * [Lines 137-196] World Resource Deposit Standalone Inspector Popup
 * [Lines 198-266] Top Satisfactory Window Title Bar & Recipe/Production Tabs
 * [Lines 268-338] Recipe Selection Tab Grid
 * [Lines 340-454] Miner Mk.1 Upper Bay (Ribbed Extraction Drum + Telemetry + White OUTPUT Card)
 * [Lines 456-674] Smelter / Constructor / Assembler 3-Column Production Bay
 * [Lines 676-718] Delegation to `MachineOverclockSection` & `PioneerInventoryPanel`
 * ============================================================================
 */

import React, { useState } from 'react';
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
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { MachineOverclockSection } from './MachineOverclockSection';
import { PioneerInventoryPanel, ScrewHead } from './PioneerInventoryPanel';

interface NodeInspectorPanelProps {
  node: MachineNode;
  connections: ConveyorConnection[];
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
  onUpgradeConnectedBelts: (
    tier: ConveyorBeltTier,
    shortLabel: string,
    capacityPerMin: number
  ) => void;
  onUnwireBelts: () => void;
  onDismantleNode: () => void;
}

export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = React.memo(
  ({
    node,
    connections,
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
    onUpgradeConnectedBelts,
    onUnwireBelts,
    onDismantleNode,
  }) => {
    const buildingDef = BUILDINGS[node.buildingId];
    const [activeTab, setActiveTab] = useState<'production' | 'recipe'>('production');

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

    const attachedConns = connections.filter(
      (c) => c.fromNodeId === node.id || c.toNodeId === node.id
    );

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

    return (
      <div
        role="dialog"
        aria-label={`${node.title} Machine Window`}
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
        className="fixed inset-x-2 bottom-2 top-12 z-30 m-auto max-w-[875px] max-h-[calc(100vh-56px)] flex flex-col rounded-lg bg-[#202226] border-2 border-[#45484F] shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden text-white pointer-events-auto"
      >
        {/* =================================================================== */}
        {/* TOP SATISFACTORY WINDOW TITLE BAR & TABS                            */}
        {/* =================================================================== */}
        <div className="flex items-center justify-between bg-[#37393E] border-b-2 border-[#1B1C1F] h-9 shrink-0 select-none">
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
                  <span className="text-sm leading-none">⊞</span>
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
                  <span className="text-sm leading-none">🔨</span>
                  <span>Production</span>
                </button>
              </>
            ) : (
              <div className="px-3.5 h-full flex items-center gap-2 text-xs font-bold text-white">
                <span className="inline-block w-3.5 h-3 border border-white/80 rounded-[2px] bg-white/10" />
                <span>{isMiner ? 'Miner' : node.title}</span>
                {isMiner && underlyingDeposit && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-amber-300 border border-amber-500/40">
                    {depositPurityCfg.label} · {depositPurityCfg.ratePerMin}/m base
                  </span>
                )}
                {isMiner && !underlyingDeposit && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-950/80 text-[10px] font-mono text-rose-300 border border-rose-500/50">
                    UNMOUNTED (NO DEPOSIT)
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Close Node Inspector"
            onClick={onClose}
            className="w-11 h-full flex items-center justify-center bg-[#484B52] hover:bg-rose-600 text-white text-sm font-bold border-l border-[#222428] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* =================================================================== */}
        {/* TWO-COLUMN BODY: LEFT MACHINE GUI + RIGHT PIONEER INVENTORY         */}
        {/* =================================================================== */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1.18fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#141518] bg-[#23252A]">
          {/* LEFT COLUMN: AUTHENTIC SATISFACTORY MACHINE INTERFACE */}
          <div className="p-2.5 flex flex-col gap-2 bg-[#23252A]">
            {isRecipeMachine && activeTab === 'recipe' ? (
              /* RECIPE SELECTION TAB VIEW */
              <div className="flex-1 rounded-md bg-[#686B70] border-2 border-[#2A2C30] p-3 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center justify-between bg-[#18191C] px-3 py-2 rounded border border-[#3E4147]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E59329]">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto">
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
                        className={`p-2.5 rounded-md border-2 text-left flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? 'bg-[#18191C] border-[#E59329] shadow-md'
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
                            <div className="text-[10px] text-slate-300 truncate">
                              {r.inputs.map((i) => `${i.ratePerMin}/m ${i.itemName}`).join(' + ')}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#E59329]/20 border border-[#E59329] text-[#E59329] font-mono text-[11px] font-bold shrink-0">
                          {outSpec?.ratePerMin ?? 30}/m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isMiner ? (
              /* MINER MK.1 EXACT UPPER BAY (RIBBED DRUM + TELEMETRY + OUTPUT) */
              <div className="relative rounded-md bg-[#686B70] border-2 border-[#2C2E33] p-3 shadow-inner">
                <ScrewHead className="absolute top-1.5 left-1.5" />
                <ScrewHead className="absolute top-1.5 right-1.5" />
                <ScrewHead className="absolute bottom-1.5 left-1.5" />
                <ScrewHead className="absolute bottom-1.5 right-1.5" />

                <div className="relative flex items-center justify-center py-1">
                  <div className="w-full max-w-[360px] h-52 rounded-md bg-[#121316] border-2 border-[#25272C] flex items-stretch overflow-hidden shadow-2xl">
                    <div className="w-5 h-full bg-gradient-to-r from-[#52565E] via-[#D8DCE3] to-[#484B52] border-r border-[#1F2126]" />
                    <div className="flex-1 flex flex-col justify-between py-1 px-0.5 bg-[#101114]">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="h-4 w-full rounded-[1px] bg-gradient-to-b from-[#9CA1AA] via-[#5E626B] to-[#26282E] border-y border-black/60"
                        />
                      ))}
                    </div>
                    <div className="w-5 h-full bg-gradient-to-r from-[#484B52] via-[#D8DCE3] to-[#52565E] border-l border-[#1F2126]" />
                  </div>

                  {/* Overlapping Dark Telemetry Box + Crisp White OUTPUT Card */}
                  <div className="relative -ml-36 z-10 w-52 rounded-md bg-[#1C1E22] border-2 border-[#101114] p-2 shadow-[0_10px_28px_rgba(0,0,0,0.85)] flex flex-col">
                    <div className="relative bg-[#0E0F12] rounded border border-[#2C2F36] p-2.5 pb-4 text-center space-y-1.5">
                      <div className="w-full h-3.5 rounded-[2px] bg-[#585A60] overflow-hidden p-[1px]">
                        <div
                          className="h-full bg-[#E59329] transition-all duration-150"
                          style={{ width: `${isStandby ? 0 : progressPct}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-medium text-slate-200">
                        {isStandby ? 'Standby' : 'Mining'} -{' '}
                        <span className="text-[#E59329] font-bold">
                          {isStandby ? 0 : progressPct}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] font-mono font-bold">
                        <div className="flex flex-col items-center">
                          <span className="text-white text-xs leading-none mb-0.5">⚡</span>
                          <span className="text-[#E59329]">{powerMw} MW</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-white text-xs leading-none mb-0.5">⏱</span>
                          <span className="text-[#E59329]">{scaledCycleSec} sec</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-white text-xs leading-none mb-0.5">📶</span>
                          <span className="text-[#E59329]">{effPct}%</span>
                        </div>
                      </div>

                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#2A2C32] border-2 border-[#101114] flex items-center justify-center shadow">
                        <span className="text-[10px] text-white leading-none">▼</span>
                      </div>
                    </div>

                    {(() => {
                      const oreName =
                        node.outputs[0]?.itemName ??
                        activeRecipe?.outputs[0]?.itemName ??
                        'Iron Ore';
                      const oreIcon = getItemIconUrl(oreName);
                      return (
                        <div className="mt-1.5 bg-white rounded text-slate-900 pt-3.5 pb-2.5 px-3 flex flex-col items-center shadow">
                          <div
                            onClick={onFillOutputBuffer}
                            title="Tap to fill output buffer"
                            className="relative w-14 h-14 rounded-md bg-[#D9D9D9] border border-slate-300 flex items-center justify-center p-1.5 cursor-pointer hover:ring-2 hover:ring-[#E59329]"
                          >
                            {oreIcon && (
                              <img
                                src={oreIcon}
                                alt={oreName}
                                className="w-11 h-11 object-contain"
                              />
                            )}
                            <span className="absolute bottom-0 right-0 px-1.5 py-0.2 rounded-tl rounded-br bg-[#E59329] text-white font-mono text-[11px] font-bold leading-tight shadow">
                              {curOutStored}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs font-bold text-slate-800">
                            1 {oreName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            <span className="text-[#E59329] font-bold">{targetOutputRate}</span>{' '}
                            per minute
                          </div>
                        </div>
                      );
                    })()}

                    <div className="relative mt-1.5 flex items-center justify-center">
                      <ScrewHead className="absolute left-1" />
                      <span className="px-4 py-0.5 rounded bg-[#E5E7EB] border border-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                        OUTPUT
                      </span>
                      <ScrewHead className="absolute right-1" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* SMELTER / CONSTRUCTOR / ASSEMBLER 3-COLUMN PRODUCTION BAY */
              <div className="relative rounded-md bg-[#686B70] border-2 border-[#2C2E33] p-2.5 space-y-2 shadow-inner">
                <ScrewHead className="absolute top-1.5 left-1.5" />
                <ScrewHead className="absolute top-1.5 right-1.5" />
                <ScrewHead className="absolute bottom-1.5 left-1.5" />
                <ScrewHead className="absolute bottom-1.5 right-1.5" />

                <div
                  onClick={() => isRecipeMachine && setActiveTab('recipe')}
                  className={`w-full rounded bg-[#18191C] border border-[#3E4147] py-1.5 px-3 text-center ${
                    isRecipeMachine ? 'cursor-pointer hover:border-[#E59329]' : ''
                  }`}
                >
                  <div className="text-[10px] font-semibold text-[#E59329] leading-tight">
                    Recipe:
                  </div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {activeRecipe?.name ?? node.title}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_118px_1fr] gap-1.5 items-stretch">
                  {/* LEFT COLUMN: Crisp White INPUT Card */}
                  <div className="flex flex-col">
                    <div className="flex-1 rounded-md bg-white border-2 border-[#2C2E33] p-2.5 flex flex-col justify-center gap-2.5 text-slate-900 min-h-[168px]">
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
                              <div className="relative w-12 h-12 rounded bg-[#D9D9D9] border border-slate-300 p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#E59329]">
                                {itemIcon && (
                                  <img
                                    src={itemIcon}
                                    alt={itemName}
                                    className="w-9 h-9 object-contain"
                                  />
                                )}
                                <span className="absolute -bottom-1 left-0 right-0 mx-auto w-full text-center py-0.2 rounded-b bg-[#E59329] text-white font-mono text-[10px] font-bold leading-tight">
                                  {curBuf}/{reqPerCycle}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {reqPerCycle} {itemName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  <span className="text-[#E59329] font-bold">
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
                    <div className="mt-1 flex justify-center">
                      <span className="px-4 py-0.5 rounded bg-[#E5E7EB] border border-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                        INPUT
                      </span>
                    </div>
                  </div>

                  {/* CENTER COLUMN: Dark Screwed Telemetry Module */}
                  <div className="relative rounded-md bg-[#2A2C32] border-2 border-[#141518] p-1.5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between px-0.5">
                      <ScrewHead />
                      <span className="w-8 h-1 rounded-full bg-[#141518]" />
                      <ScrewHead />
                    </div>

                    <div className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-[#383B42] border border-[#141518] flex items-center justify-center z-10">
                      <span className="text-[9px] text-white leading-none">▶</span>
                    </div>
                    <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5 rounded-full bg-[#383B42] border border-[#141518] flex items-center justify-center z-10">
                      <span className="text-[9px] text-white leading-none">▶</span>
                    </div>

                    <div className="my-1 flex-1 rounded bg-[#141518] p-2 flex flex-col items-center justify-center text-center gap-1">
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
                              className="w-10 h-10 object-contain mb-0.5"
                            />
                          )
                        );
                      })()}

                      <div className="w-full h-2.5 rounded-[2px] bg-[#585A60] overflow-hidden">
                        <div
                          className="h-full bg-[#E59329] transition-all duration-150"
                          style={{ width: `${isStandby ? 0 : progressPct}%` }}
                        />
                      </div>

                      <div className="text-[10px] text-slate-200 font-medium leading-tight">
                        {isStandby ? 'Standby' : 'Constructing'} -{' '}
                        <span className="text-[#E59329] font-bold">
                          {isStandby ? 0 : progressPct}%
                        </span>
                      </div>

                      <div className="pt-1 flex flex-col items-center text-[10px] font-mono font-bold leading-tight">
                        <span className="text-white">⚡</span>
                        <span className="text-[#E59329]">{powerMw} MW</span>
                      </div>

                      <div className="flex flex-col items-center text-[10px] font-mono font-bold leading-tight">
                        <span className="text-white">⏱</span>
                        <span className="text-[#E59329]">{scaledCycleSec} sec</span>
                      </div>

                      <div className="flex flex-col items-center text-[10px] font-mono font-bold leading-tight">
                        <span className="text-white">📶</span>
                        <span className="text-[#E59329]">{effPct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-0.5">
                      <ScrewHead />
                      <ScrewHead />
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Crisp White OUTPUT Card */}
                  <div className="flex flex-col">
                    <div className="flex-1 rounded-md bg-white border-2 border-[#2C2E33] p-2.5 flex flex-col justify-center text-slate-900 min-h-[168px]">
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
                            <div className="relative w-12 h-12 rounded bg-[#D9D9D9] border border-slate-300 p-1 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-[#E59329]">
                              {outIcon && (
                                <img
                                  src={outIcon}
                                  alt={outName}
                                  className="w-9 h-9 object-contain"
                                />
                              )}
                              <span className="absolute bottom-0 right-0 px-1.5 py-0.2 rounded-tl rounded-br bg-[#E59329] text-white font-mono text-[10px] font-bold leading-tight">
                                {curOutStored}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {outPerCycle} {outName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                <span className="text-[#E59329] font-bold">
                                  {targetOutputRate}
                                </span>{' '}
                                per minute
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-1 flex justify-center">
                      <span className="px-4 py-0.5 rounded bg-[#E5E7EB] border border-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                        OUTPUT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overclocking (0%-250%, 3 Power Shards) + Multiplier + Copy/Paste/Standby Footer */}
            <MachineOverclockSection
              node={node}
              attachedConns={attachedConns}
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
              onFillInputBuffer={onFillInputBuffer}
              onFillOutputBuffer={onFillOutputBuffer}
              onUpgradeConnectedBelts={onUpgradeConnectedBelts}
              onUnwireBelts={onUnwireBelts}
              onDismantleNode={onDismantleNode}
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
    );
  }
);
