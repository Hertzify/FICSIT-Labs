import React from 'react';
import {
  CONVEYOR_BELT_TIER_LIST,
  formatDualRatePerMin,
  formatRatePerMin,
  PIXELS_PER_METER,
} from '../game/catalog';
import { getBuildingIconUrl, getItemIconUrl } from '../game/icons';
import { getBeltTierDef } from '../game/rules';
import {
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';

interface BeltInspectorPanelProps {
  connection: ConveyorConnection;
  nodes: MachineNode[];
  settings: SettingsConfig;
  onClose: () => void;
  onUpgradeBeltTier: (
    tier: ConveyorBeltTier,
    shortLabel: string,
    capacityPerMin: number
  ) => void;
  onClearBeltItems: () => void;
  onDismantleBelt: () => void;
  onResetWaypoints?: () => void;
}

export const BeltInspectorPanel: React.FC<BeltInspectorPanelProps> = React.memo(
  ({
    connection,
    nodes,
    settings,
    onClose,
    onUpgradeBeltTier,
    onClearBeltItems,
    onDismantleBelt,
    onResetWaypoints,
  }) => {
    const tierDef = getBeltTierDef(
      connection.beltTier,
      connection.maxCapacityPerMin
    );
    const beltIconUrl = getBuildingIconUrl(tierDef.id);
    const itemIconUrl = getItemIconUrl(connection.itemName);

    const fromNode = nodes.find((n) => n.id === connection.fromNodeId);
    const toNode = nodes.find((n) => n.id === connection.toNodeId);

    const packets = connection.inFlightItems ?? [];
    const stalledCount = packets.filter((p) => p.stalled).length;
    const lengthMeters = ((connection.lengthPx ?? 90) / PIXELS_PER_METER).toFixed(
      1
    );

    const isBackedUp = Boolean(connection.isBackedUp);
    const isFlowing = connection.ratePerMin > 0;

    return (
      <div
        data-testid="belt-inspector-panel"
        style={{
          transform: `scale(${settings.uiScale})`,
          transformOrigin: 'bottom right',
        }}
        className="fixed bottom-3 right-3 z-20 w-76 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl p-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#26334D]">
          <div className="flex items-center gap-2.5 min-w-0">
            {beltIconUrl && (
              <img
                src={beltIconUrl}
                alt={tierDef.name}
                className="w-8 h-8 rounded-lg bg-[#0B0F17] p-1 border border-[#26334D] object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-xs font-bold font-display text-white truncate">
                {tierDef.name}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {tierDef.speedMetersPerSec} m/s · {formatRatePerMin(tierDef.capacityPerMin, settings)} Max
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Belt Inspector"
            onClick={onClose}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Route & Length Telemetry */}
        <div className="mt-2.5 p-2 rounded-xl bg-[#0B0F17] border border-[#26334D] space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>CONVEYOR ROUTE</span>
            <span className="text-slate-300 font-semibold">{lengthMeters}m span</span>
          </div>
          <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-slate-200">
            <span className="truncate">{fromNode?.title ?? 'Source'}</span>
            <span className="text-amber-400 font-mono shrink-0">→</span>
            <span className="truncate text-right">{toNode?.title ?? 'Target'}</span>
          </div>
        </div>

        {/* Custom Route Corner Dots */}
        {connection.waypoints && connection.waypoints.length > 0 && (
          <div className="mt-2 p-2 rounded-xl bg-[#0B0F17] border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[11px] font-mono font-semibold text-amber-200 truncate">
                  {connection.waypoints.length} Corner Dot{connection.waypoints.length === 1 ? '' : 's'}
                </span>
              </div>
              {onResetWaypoints && (
                <button
                  type="button"
                  onClick={onResetWaypoints}
                  className="px-2 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-[10px] font-mono font-bold text-rose-300 hover:text-white shrink-0"
                >
                  Dismantle All Dots
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Throughput & Discrete Item Queue */}
        <div className="mt-2 p-2.5 rounded-xl bg-[#0B0F17] border border-[#26334D] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {itemIconUrl ? (
                <img
                  src={itemIconUrl}
                  alt={connection.itemName ?? 'Item'}
                  className="w-6 h-6 object-contain shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {connection.itemName ?? 'No Item Assigned'}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {packets.length} item{packets.length === 1 ? '' : 's'} on belt
                  {stalledCount > 0 ? ` (${stalledCount} queued)` : ''}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-mono font-bold text-amber-300">
                {formatDualRatePerMin(connection.ratePerMin, tierDef.capacityPerMin, settings)}
              </div>
              <div
                className={`text-[10px] font-mono font-semibold ${
                  isBackedUp && connection.ratePerMin === 0
                    ? 'text-amber-400'
                    : isFlowing
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {isBackedUp && connection.ratePerMin === 0
                  ? 'BACKED UP'
                  : isFlowing
                  ? 'OPTIMAL FLOW'
                  : 'IDLE'}
              </div>
            </div>
          </div>

          {/* Capacity Utilization Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                isBackedUp && connection.ratePerMin === 0
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((isBackedUp && connection.ratePerMin === 0
                      ? tierDef.capacityPerMin
                      : connection.ratePerMin) /
                      Math.max(1, tierDef.capacityPerMin)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {/* In-Place Belt Tier Upgrade Selector (Mk.1 - Mk.6) */}
        <div className="mt-2.5 pt-2 border-t border-[#26334D]">
          <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
            Upgrade / Replace Belt Tier in Place
          </label>
          <div className="grid grid-cols-3 gap-1">
            {CONVEYOR_BELT_TIER_LIST.map((bt) => {
              const isCurrent = tierDef.tier === bt.tier;
              const btIcon = getBuildingIconUrl(bt.id);
              return (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() =>
                    onUpgradeBeltTier(bt.tier, bt.shortLabel, bt.capacityPerMin)
                  }
                  className={`px-1.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between gap-1 transition-colors ${
                    isCurrent
                      ? 'bg-amber-500/20 border border-amber-400 text-amber-200'
                      : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    {btIcon && (
                      <img
                        src={btIcon}
                        alt={bt.shortLabel}
                        className="w-3.5 h-3.5 object-contain shrink-0"
                      />
                    )}
                    <span>{bt.shortLabel}</span>
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {bt.capacityPerMin}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Belt Actions */}
        <div className="mt-2.5 pt-2 border-t border-[#26334D] flex items-center justify-between gap-2">
          {packets.length > 0 && (
            <button
              type="button"
              onClick={onClearBeltItems}
              className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-[#26334D] text-xs font-medium text-slate-300 whitespace-nowrap"
            >
              Clear Items ({packets.length})
            </button>
          )}
          <button
            type="button"
            onClick={onDismantleBelt}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-xs font-medium text-red-200 whitespace-nowrap"
          >
            Dismantle Belt
          </button>
        </div>
      </div>
    );
  }
);
