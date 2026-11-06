/**
 * ============================================================================
 * MODULE INDEX: Pioneer Player Inventory Sidebar (`src/components/PioneerInventoryPanel.tsx`)
 * ============================================================================
 * [Lines 018-060] ScrewHead & PowerShardCrystalIcon Shared Subcomponents
 * [Lines 062-090] InventorySlotItem & PioneerInventoryPanelProps
 * [Lines 092-315] PioneerInventoryPanel (Relevant Items + 9x5 All Items Grid + Sort + Trash)
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { getMaxClockSpeedPct } from '../game/catalog';
import { getItemIconUrl, ITEM_ICON_PATHS } from '../game/icons';
import { MachineNode, RecipeDef } from '../game/types';

export const ScrewHead: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-[#4A4D52] border border-[#222428] shadow-inner select-none pointer-events-none ${className}`}
  >
    <span className="w-1.5 h-[1px] bg-[#222428] rotate-45 block" />
  </span>
);

export const PowerShardCrystalIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    viewBox="0 0 36 36"
    className={`w-7 h-7 transition-transform ${
      active ? 'drop-shadow-[0_2px_4px_rgba(56,189,248,0.45)]' : 'opacity-30 grayscale'
    }`}
  >
    <rect x="11" y="3" width="14" height="4" rx="1.5" fill={active ? '#1E293B' : '#64748B'} />
    <rect x="10" y="6" width="16" height="3" rx="1" fill={active ? '#F59E0B' : '#94A3B8'} />
    <polygon
      points="12,9 24,9 26,18 23,27 13,27 10,18"
      fill={active ? '#38BDF8' : '#94A3B8'}
      stroke={active ? '#E0F2FE' : '#64748B'}
      strokeWidth="1.2"
    />
    <polygon
      points="18,9 24,9 22,27 18,27"
      fill={active ? '#0284C7' : '#64748B'}
      opacity="0.65"
    />
    <rect x="10" y="27" width="16" height="3" rx="1" fill={active ? '#F59E0B' : '#94A3B8'} />
    <rect x="11" y="30" width="14" height="3.5" rx="1.5" fill={active ? '#1E293B' : '#64748B'} />
  </svg>
);

export interface InventorySlotItem {
  id: string;
  name: string;
  count: number;
  iconUrl: string | null;
  isPowerShard?: boolean;
  isRelevant?: boolean;
}

interface PioneerInventoryPanelProps {
  node: MachineNode;
  nodes: MachineNode[];
  activeRecipe: RecipeDef | null;
  powerShards: number;
  clockSpeedPct: number;
  onUpdateOverclock?: (clockSpeedPct: number, powerShards: number) => void;
  onFillInputBuffer?: () => void;
  onFlushBuffer: () => void;
}

export const PioneerInventoryPanel: React.FC<PioneerInventoryPanelProps> = React.memo(
  ({
    node,
    nodes,
    activeRecipe,
    powerShards,
    clockSpeedPct,
    onUpdateOverclock,
    onFillInputBuffer,
    onFlushBuffer,
  }) => {
    const [sortMode, setSortMode] = useState<'default' | 'count' | 'name'>('default');

    const { relevantItems, allGridSlots } = useMemo(() => {
      const countsByItemId: Record<string, number> = {
        iron_rod: 148,
        iron_plate: 200,
        wire: 500,
        cable: 180,
        concrete: 200,
        screw: 393,
        reinforced_plate: 35,
        iron_ore: 100,
        copper_ore: 63,
        limestone: 100,
        iron_ingot: 200,
        copper_ingot: 118,
        rotor: 22,
      };

      for (const n of nodes) {
        const outItem = n.outputs[0]?.itemName?.toLowerCase();
        const stored = Math.floor(n.storedCount ?? 0);
        if (outItem && stored > 0) {
          if (outItem.includes('iron ore')) countsByItemId.iron_ore += stored;
          else if (outItem.includes('copper ore')) countsByItemId.copper_ore += stored;
          else if (outItem.includes('limestone')) countsByItemId.limestone += stored;
          else if (outItem.includes('iron ingot')) countsByItemId.iron_ingot += stored;
          else if (outItem.includes('copper ingot')) countsByItemId.copper_ingot += stored;
          else if (outItem.includes('reinforced')) countsByItemId.reinforced_plate += stored;
          else if (outItem.includes('plate')) countsByItemId.iron_plate += stored;
          else if (outItem.includes('rod')) countsByItemId.iron_rod += stored;
          else if (outItem.includes('screw')) countsByItemId.screw += stored;
          else if (outItem.includes('wire')) countsByItemId.wire += stored;
          else if (outItem.includes('cable')) countsByItemId.cable += stored;
          else if (outItem.includes('concrete')) countsByItemId.concrete += stored;
          else if (outItem.includes('rotor')) countsByItemId.rotor += stored;
        }
      }

      const catalogEntries: { id: string; name: string; stackSize: number }[] = [
        { id: 'iron_rod', name: 'Iron Rod', stackSize: 200 },
        { id: 'screw', name: 'Screws', stackSize: 500 },
        { id: 'reinforced_plate', name: 'Reinforced Iron Plate', stackSize: 100 },
        { id: 'iron_ore', name: 'Iron Ore', stackSize: 100 },
        { id: 'copper_ore', name: 'Copper Ore', stackSize: 100 },
        { id: 'limestone', name: 'Limestone', stackSize: 100 },
        { id: 'power_shard', name: 'Power Shard', stackSize: 100 },
        { id: 'rotor', name: 'Rotor', stackSize: 100 },
        { id: 'cable', name: 'Cable', stackSize: 200 },
        { id: 'iron_plate', name: 'Iron Plate', stackSize: 200 },
        { id: 'iron_ingot', name: 'Iron Ingot', stackSize: 100 },
        { id: 'copper_ingot', name: 'Copper Ingot', stackSize: 100 },
        { id: 'wire', name: 'Wire', stackSize: 500 },
        { id: 'concrete', name: 'Concrete', stackSize: 500 },
      ];

      const machineRelevantNames = new Set<string>();
      for (const inp of node.inputs) {
        if (inp.itemName) machineRelevantNames.add(inp.itemName.toLowerCase());
        if (inp.label) machineRelevantNames.add(inp.label.toLowerCase());
      }
      for (const outp of node.outputs) {
        if (outp.itemName) machineRelevantNames.add(outp.itemName.toLowerCase());
        if (outp.label) machineRelevantNames.add(outp.label.toLowerCase());
      }
      if (activeRecipe) {
        for (const rIn of activeRecipe.inputs) {
          machineRelevantNames.add(rIn.itemName.toLowerCase());
        }
        for (const rOut of activeRecipe.outputs) {
          machineRelevantNames.add(rOut.itemName.toLowerCase());
        }
      }

      const expandedSlots: InventorySlotItem[] = [];
      for (const entry of catalogEntries) {
        if (entry.id === 'power_shard') {
          expandedSlots.push({
            id: 'slot_power_shard',
            name: 'Power Shard',
            count: Math.max(1, 10 - powerShards),
            iconUrl: null,
            isPowerShard: true,
            isRelevant: true,
          });
          continue;
        }
        const total = countsByItemId[entry.id] ?? 50;
        const iconUrl = ITEM_ICON_PATHS[entry.id] ?? getItemIconUrl(entry.name);
        const isRel = machineRelevantNames.has(entry.name.toLowerCase());

        let rem = total;
        let stackIdx = 0;
        while (rem > 0 && stackIdx < 3) {
          const stackCount = Math.min(entry.stackSize, rem);
          expandedSlots.push({
            id: `${entry.id}_${stackIdx}`,
            name: entry.name,
            count: stackCount,
            iconUrl,
            isRelevant: isRel,
          });
          rem -= stackCount;
          stackIdx++;
        }
      }

      if (sortMode === 'count') {
        expandedSlots.sort((a, b) => b.count - a.count);
      } else if (sortMode === 'name') {
        expandedSlots.sort((a, b) => a.name.localeCompare(b.name));
      }

      const relList = expandedSlots.filter((s) => s.isRelevant).slice(0, 6);
      const grid45: (InventorySlotItem | null)[] = [];
      for (let i = 0; i < 45; i++) {
        grid45.push(expandedSlots[i] ?? null);
      }

      return { relevantItems: relList, allGridSlots: grid45 };
    }, [nodes, node.inputs, node.outputs, activeRecipe, powerShards, sortMode]);

    return (
      <div className="flex flex-col justify-between bg-[#1F2125] p-3 select-none">
        <div className="space-y-3">
          {/* Relevant Items Row */}
          <div>
            <div className="text-xs font-medium text-slate-200 mb-1.5">
              Relevant Items:
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[46px]">
              {relevantItems.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    if (slot.isPowerShard && onUpdateOverclock) {
                      const nextShards = Math.min(3, powerShards + 1);
                      onUpdateOverclock(
                        Math.max(clockSpeedPct, getMaxClockSpeedPct(nextShards)),
                        nextShards
                      );
                    } else if (onFillInputBuffer && node.inputs.length > 0) {
                      onFillInputBuffer();
                    }
                  }}
                  title={
                    slot.isPowerShard
                      ? 'Tap to install Power Shard (+50% Overclock capacity)'
                      : `${slot.name} (${slot.count}) · Tap to load into machine`
                  }
                  className={`relative w-11 h-11 rounded-[3px] bg-[#D9D9D9] flex items-center justify-center p-1 hover:ring-2 hover:ring-[#E59329] ${
                    slot.isPowerShard ? 'border-2 border-[#E59329]' : 'border border-[#474A52]'
                  }`}
                >
                  {slot.isPowerShard ? (
                    <PowerShardCrystalIcon active />
                  ) : (
                    slot.iconUrl && (
                      <img
                        src={slot.iconUrl}
                        alt={slot.name}
                        className="w-8 h-8 object-contain"
                      />
                    )
                  )}
                  <span className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl-[2px] bg-[#E59329] text-white font-mono text-[10px] font-bold leading-tight">
                    {slot.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* All Items 9x5 Grid (45 Square Slots) */}
          <div>
            <div className="text-xs font-medium text-slate-200 mb-1.5">
              All Items:
            </div>
            <div className="grid grid-cols-9 gap-1">
              {allGridSlots.map((slot, idx) =>
                slot ? (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      if (slot.isPowerShard && onUpdateOverclock) {
                        const nextShards = Math.min(3, powerShards + 1);
                        onUpdateOverclock(
                          Math.max(clockSpeedPct, getMaxClockSpeedPct(nextShards)),
                          nextShards
                        );
                      } else if (onFillInputBuffer && node.inputs.length > 0) {
                        onFillInputBuffer();
                      }
                    }}
                    title={`${slot.name} (${slot.count})`}
                    className={`relative aspect-square w-full rounded-[2px] bg-[#D9D9D9] flex items-center justify-center p-0.5 hover:ring-2 hover:ring-[#E59329] ${
                      slot.isPowerShard
                        ? 'border-2 border-[#E59329]'
                        : 'border border-[#454850]'
                    }`}
                  >
                    {slot.isPowerShard ? (
                      <PowerShardCrystalIcon active />
                    ) : (
                      slot.iconUrl && (
                        <img
                          src={slot.iconUrl}
                          alt={slot.name}
                          className="w-4/5 h-4/5 object-contain"
                        />
                      )
                    )}
                    <span className="absolute bottom-0 right-0 px-1 rounded-tl-[2px] bg-[#E59329] text-white font-mono text-[9px] font-bold leading-tight">
                      {slot.count}
                    </span>
                  </button>
                ) : (
                  <div
                    key={`empty_${idx}`}
                    className="aspect-square w-full rounded-[2px] bg-[#32353B]/90 border border-[#26282D]"
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Bottom Inventory Bar: [ ↓≡ Sort ] on Left + [ 🗑️ ] Trash Slot on Right */}
        <div className="mt-4 pt-2 border-t border-[#2E3138] flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setSortMode((prev) =>
                prev === 'default' ? 'count' : prev === 'count' ? 'name' : 'default'
              )
            }
            className="h-10 px-5 rounded bg-[#4A4D55] hover:bg-[#5A5E68] text-xs font-semibold text-white flex items-center gap-2 border border-[#2C2E33] shadow"
          >
            <span className="font-mono text-sm leading-none">↓≡</span>
            <span>
              Sort{sortMode !== 'default' ? ` (${sortMode.toUpperCase()})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={onFlushBuffer}
            title="Trash / Flush Machine Internal Buffers"
            aria-label="Flush Machine Buffers"
            className="w-10 h-10 rounded bg-[#4A4D55] hover:bg-rose-700 text-white flex items-center justify-center border border-[#2C2E33] shadow transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);
