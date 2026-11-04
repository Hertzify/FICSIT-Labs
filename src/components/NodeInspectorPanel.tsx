import React from 'react';
import {
  BUILDINGS,
  CONVEYOR_BELT_TIER_LIST,
  getBuildingMaxStorage,
  getItemStackSize,
  PURITY_CONFIG,
  RECIPES,
  STORAGE_CONTAINER_SLOTS,
} from '../game/catalog';
import { getBuildingIconUrl, getItemIconUrl } from '../game/icons';
import {
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { doNodesOverlap, isMinerDirectlyOnDeposit } from '../game/geometry';

interface NodeInspectorPanelProps {
  node: MachineNode;
  connections: ConveyorConnection[];
  nodes?: MachineNode[];
  settings: SettingsConfig;
  onClose: () => void;
  onSelectRecipe: (recipeId: string) => void;
  onFlushBuffer: () => void;
  onFillInputBuffer?: () => void;
  onFillOutputBuffer?: () => void;
  onUpgradeConnectedBelts: (tier: ConveyorBeltTier, shortLabel: string, capacityPerMin: number) => void;
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
    onFlushBuffer,
    onFillInputBuffer,
    onFillOutputBuffer,
    onUpgradeConnectedBelts,
    onUnwireBelts,
    onDismantleNode,
  }) => {
    const buildingDef = BUILDINGS[node.buildingId];
    if (!buildingDef) return null;

    const isWorldDeposit =
      node.buildingId === 'resource_deposit' || Boolean(node.isWorldDeposit);
    const underlyingDeposit =
      node.buildingId === 'miner_mk1'
        ? nodes.find((n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(node, n, 4))
        : undefined;
    const iconUrl = getBuildingIconUrl(node.buildingId, node.recipeId);
    const attachedConns = connections.filter(
      (c) => c.fromNodeId === node.id || c.toNodeId === node.id
    );

    return (
      <div
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
        className="fixed bottom-3 right-3 z-20 w-76 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl p-3"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#26334D]">
          <div className="flex items-center gap-2.5 min-w-0">
            {iconUrl && (
              <img
                src={iconUrl}
                alt={node.title}
                className="w-8 h-8 rounded-lg bg-[#0B0F17] p-1 border border-[#26334D] object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-xs font-bold font-display text-white truncate">
                {node.title}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {buildingDef.subcategory}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Node Inspector"
            onClick={onClose}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 shrink-0"
          >
            ✕
          </button>
        </div>

        {node.buildingId === 'miner_mk1' && (
          <div className="mt-2.5">
            {underlyingDeposit ? (
              (() => {
                const purityKey = underlyingDeposit.purity ?? 'normal';
                const pCfg = PURITY_CONFIG[purityKey];
                return (
                  <div className="p-2 rounded-xl bg-teal-950/40 border border-teal-500/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5 truncate">
                        <span>●</span>
                        <span className="truncate">Clamped to {underlyingDeposit.title}</span>
                      </div>
                      <div className="text-[10px] text-teal-400/80">
                        Deposit Purity: {pCfg.label} ({pCfg.multiplier}×)
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: `${pCfg.badgeColor}22`,
                        color: pCfg.badgeColor,
                        border: `1px solid ${pCfg.badgeColor}66`,
                      }}
                    >
                      {pCfg.ratePerMin}/m
                    </span>
                  </div>
                );
              })()
            ) : (
              <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-500/50 flex items-center gap-2 text-rose-300">
                <span className="text-base shrink-0">⚠️</span>
                <div className="min-w-0 text-[11px] leading-snug">
                  <div className="font-bold text-rose-200">Unmounted: No Deposit</div>
                  <div className="text-rose-400 text-[10px]">Must sit on a Resource Deposit to extract ore!</div>
                </div>
              </div>
            )}
          </div>
        )}

        {isWorldDeposit ? (
          <div className="mt-2.5 space-y-2">
            {(() => {
              const purityKey = node.purity ?? 'normal';
              const pCfg = PURITY_CONFIG[purityKey];
              const depRecipe = node.recipeId
                ? RECIPES[node.recipeId]
                : RECIPES.deposit_iron;
              const oreName = depRecipe?.outputs[0]?.itemName ?? 'Iron Ore';
              const oreIcon = getItemIconUrl(oreName);
              return (
                <div className="p-2.5 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {oreIcon && (
                      <img
                        src={oreIcon}
                        alt={oreName}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {oreName} Vein
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Purity Modifier: {pCfg.multiplier}×
                      </div>
                    </div>
                  </div>
                  <span
                    className="px-2 py-1 rounded-md text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: `${pCfg.badgeColor}22`,
                      color: pCfg.badgeColor,
                      border: `1px solid ${pCfg.badgeColor}66`,
                    }}
                  >
                    {pCfg.label} · {pCfg.ratePerMin}/m
                  </span>
                </div>
              );
            })()}
            <p className="text-[11px] text-slate-400 leading-snug">
              Natural planetary resource deposit. Build a{' '}
              <strong className="text-slate-200">Miner Mk.1</strong> directly on top of this deposit to extract ore according to node purity.
            </p>
          </div>
        ) : (
          buildingDef.availableRecipeIds.length > 0 &&
          node.buildingId !== 'miner_mk1' && (
            <div className="mt-2">
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Active Machine Recipe
              </label>
              <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1">
                {buildingDef.availableRecipeIds.map((rId) => {
                  const r = RECIPES[rId];
                  if (!r) return null;
                  const active = node.recipeId === rId;
                  const outItem = r.outputs[0];
                  const itemIcon = getItemIconUrl(outItem?.itemId ?? outItem?.itemName);
                  return (
                    <button
                      key={rId}
                      type="button"
                      onClick={() => onSelectRecipe(rId)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                        active
                          ? 'bg-amber-500/20 border border-amber-500 text-amber-200'
                          : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {itemIcon && (
                          <img
                            src={itemIcon}
                            alt={r.name}
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        )}
                        <span className="truncate">{r.name}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0 ml-2">
                        {outItem?.ratePerMin ?? 0}/m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* Satisfactory Internal Input & Output Storages */}
        {!isWorldDeposit && (
          <div className="mt-2 pt-2 border-t border-[#26334D] space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-300">
                {node.inputs.length === 0 ? 'Storage Buffer' : 'Input & Output Storage'}
              </span>
              <div className="flex items-center gap-1">
                {onFillInputBuffer && node.inputs.length > 0 && (
                  <button
                    type="button"
                    onClick={onFillInputBuffer}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-cyan-500/30"
                    title="Fill input storage to 100%"
                  >
                    Fill In
                  </button>
                )}
                {onFillOutputBuffer && (
                  <button
                    type="button"
                    onClick={onFillOutputBuffer}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-teal-300 border border-teal-500/30"
                    title="Fill storage to 100%"
                  >
                    {node.inputs.length === 0 ? 'Fill Storage' : 'Fill Out'}
                  </button>
                )}
                {(node.storedCount > 0.5 ||
                  node.inputs.some((p) => (p.bufferedCount ?? 0) > 0.5)) && (
                  <button
                    type="button"
                    onClick={onFlushBuffer}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-300 border border-amber-500/30"
                  >
                    Flush
                  </button>
                )}
              </div>
            </div>

            {/* Input Storage Slots (Shown for all nodes with inputs) */}
            {node.inputs.map((inPort) => {
              const isLogistics =
                node.buildingId === 'splitter' || node.buildingId === 'merger';
              const maxBuf =
                inPort.maxBuffer ??
                (isLogistics
                  ? getBuildingMaxStorage(node.buildingId, null, null)
                  : getItemStackSize(inPort.itemName ?? inPort.label));
              const curBuf = Math.min(maxBuf, Math.floor(inPort.bufferedCount ?? 0));
              const pct =
                maxBuf > 0 ? Math.min(100, Math.round((curBuf / maxBuf) * 100)) : 0;
              const isInputFull = curBuf >= maxBuf && maxBuf > 0;
              const itemIcon = getItemIconUrl(inPort.itemName ?? inPort.label);
              const capLabel = isInputFull
                ? 'FULL · BELT WAITS'
                : isLogistics
                ? 'Buffer'
                : '1 Stack';
              return (
                <div
                  key={inPort.id}
                  className="p-2 rounded-lg bg-[#0B0F17] border border-[#26334D] space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono gap-1">
                    <span className="flex items-center gap-1.5 text-cyan-300 truncate">
                      {itemIcon && (
                        <img
                          src={itemIcon}
                          alt={inPort.label}
                          className="w-3.5 h-3.5 object-contain shrink-0"
                        />
                      )}
                      <span className="truncate">
                        In Storage: {inPort.itemName ?? inPort.label}
                      </span>
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        isInputFull ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      {curBuf} / {maxBuf} ({capLabel})
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        isInputFull ? 'bg-amber-500' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Output Storage Slot / 24-Slot Container Storage */}
            {(() => {
              const isContainer =
                node.buildingId === 'storage_container' ||
                node.buildingId === 'the_hub';
              const isLogistics =
                node.buildingId === 'splitter' || node.buildingId === 'merger';
              const activeItemName =
                node.outputs[0]?.itemName ??
                node.inputs.find((p) => p.itemName)?.itemName ??
                (node.recipeId
                  ? RECIPES[node.recipeId]?.outputs[0]?.itemName
                  : null) ??
                'Parts';
              const maxCap =
                node.maxStoredCount ??
                getBuildingMaxStorage(
                  node.buildingId,
                  node.recipeId,
                  activeItemName
                );
              const curStored = Math.min(maxCap, Math.floor(node.storedCount ?? 0));
              const pct =
                maxCap > 0 ? Math.min(100, Math.round((curStored / maxCap) * 100)) : 0;
              const isFull = curStored >= maxCap && maxCap > 0;
              const itemIcon = getItemIconUrl(activeItemName);
              const slotLabel = isFull
                ? 'FULL'
                : isContainer
                ? `${STORAGE_CONTAINER_SLOTS} Slots`
                : isLogistics
                ? 'Buffer'
                : '1 Stack';

              return (
                <div className="p-2 rounded-lg bg-[#0B0F17] border border-[#26334D] space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono gap-1">
                    <span className="flex items-center gap-1.5 text-amber-300 truncate">
                      {itemIcon && (
                        <img
                          src={itemIcon}
                          alt={activeItemName}
                          className="w-3.5 h-3.5 object-contain shrink-0"
                        />
                      )}
                      <span className="truncate">
                        {node.inputs.length === 0 ? 'Storage' : 'Out Storage'}: {activeItemName}
                      </span>
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        isFull ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      {curStored} / {maxCap} ({slotLabel})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        isFull ? 'bg-amber-500' : 'bg-teal-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Connected Conveyor Belt Tier Upgrade Controls */}
        <div className="mt-2 pt-2 border-t border-[#26334D]">
          <label className="block text-[11px] font-medium text-slate-300 mb-1">
            Connected Belt Tier (Capacity & Speed)
          </label>
          <div className="grid grid-cols-3 gap-1">
            {CONVEYOR_BELT_TIER_LIST.map((bt) => {
              const isCurrentTier =
                attachedConns.length > 0 &&
                attachedConns.every((c) => (c.beltTier ?? 1) === bt.tier);
              return (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() =>
                    onUpgradeConnectedBelts(bt.tier, bt.shortLabel, bt.capacityPerMin)
                  }
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between ${
                    isCurrentTier
                      ? 'bg-amber-500/20 border border-amber-500 text-amber-200'
                      : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>{bt.shortLabel}</span>
                  <span className="text-[9px] text-slate-400">{bt.capacityPerMin}/m</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-[#26334D] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onUnwireBelts}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-[#26334D] text-xs font-medium text-slate-300 whitespace-nowrap"
          >
            Unwire Belt
          </button>
          {!isWorldDeposit && (
            <button
              type="button"
              onClick={onDismantleNode}
              className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-xs font-medium text-red-200 whitespace-nowrap"
            >
              Dismantle
            </button>
          )}
        </div>
      </div>
    );
  }
);
