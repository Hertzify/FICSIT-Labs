/**
 * ============================================================================
 * MODULE INDEX: Pioneer Player Inventory Sidebar (`src/components/PioneerInventoryPanel.tsx`)
 * ============================================================================
 * [Lines 018-065] ScrewHead & PowerShardCrystalIcon & SommersloopIcon Subcomponents
 * [Lines 067-095] InventorySlotItem & PioneerInventoryPanelProps
 * [Lines 097-335] PioneerInventoryPanel (Relevant Items + 9x5 All Items Grid + Sort + Trash)
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { getMaxClockSpeedPct } from '../game/catalog';
import { getItemIconUrl, ITEM_ICON_PATHS } from '../game/icons';
import { MachineNode, RecipeDef } from '../game/types';

export const ScrewHead: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#686B70] to-[#3A3C40] border border-[#1E2024] shadow-inner select-none pointer-events-none ${className}`}
  >
    <span className="w-1.5 h-[1px] bg-[#1E2024] rotate-45 block" />
  </span>
);

export const StemBadge: React.FC<{
  label: string;
  active?: boolean;
  activeClassName?: string;
  className?: string;
}> = ({ label, active = false, activeClassName = '', className = '' }) => (
  <div className={`flex flex-col items-center select-none ${className}`}>
    <span className="w-[1.5px] h-1.5 bg-white/80 block" />
    <span
      className={`px-4 py-[1px] rounded-[3px] border text-[10px] font-sans font-bold uppercase tracking-wider leading-tight shadow-sm ${
        active
          ? activeClassName
          : 'bg-[#DCDDE0] text-[#333538] border-[#9A9C9E]'
      }`}
    >
      {label}
    </span>
  </div>
);

export const PowerShardCrystalIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <img
    src={ITEM_ICON_PATHS.power_shard}
    alt="Power Shard"
    draggable={false}
    className={
      active
        ? 'w-8 h-8 object-contain select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]'
        : 'w-8 h-8 object-contain select-none pointer-events-none brightness-0 invert-[0.73] opacity-90'
    }
  />
);

export const MultiplierSlotSilhouetteIcon: React.FC = () => (
  <img
    src={ITEM_ICON_PATHS.somersloop}
    alt="Somersloop Multiplier Slot"
    draggable={false}
    className="w-8 h-8 object-contain select-none pointer-events-none brightness-0 invert-[0.73] opacity-90"
  />
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
            isRelevant: false,
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

      // Deduplicate relevant items by item name so it matches Satisfactory's single stack per relevant item
      const seenRel = new Set<string>();
      const relList: InventorySlotItem[] = [];
      for (const s of expandedSlots) {
        if (s.isRelevant && !seenRel.has(s.name)) {
          seenRel.add(s.name);
          relList.push(s);
        }
      }

      const grid45: (InventorySlotItem | null)[] = [];
      for (let i = 0; i < 45; i++) {
        grid45.push(expandedSlots[i] ?? null);
      }

      return { relevantItems: relList.slice(0, 6), allGridSlots: grid45 };
    }, [nodes, node.inputs, node.outputs, activeRecipe, powerShards, sortMode]);

    return (
      <div className="flex flex-col justify-between bg-[#18191C]/95 select-none h-full">
        <div className="p-2.5 space-y-2">
          {/* Relevant Items Row */}
          <div>
            <div className="text-[11px] font-sans text-[#D4D5D8] mb-1">
              Relevant Items:
            </div>
            <div className="flex flex-wrap gap-1 min-h-[38px]">
              {relevantItems.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    if (onFillInputBuffer && node.inputs.length > 0) {
                      onFillInputBuffer();
                    }
                  }}
                  title={`${slot.name} (${slot.count}) · Tap to load into machine`}
                  className="relative w-10 h-10 rounded-[2px] bg-[#CFCFD1] border border-[#454850] flex items-center justify-center p-0.5 hover:ring-2 hover:ring-[#DF8A2E]"
                >
                  {slot.iconUrl && (
                    <img
                      src={slot.iconUrl}
                      alt={slot.name}
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <span className="absolute bottom-0 right-0 px-1 py-[0.5px] bg-[#DF8A2E] text-white font-sans text-[9px] font-bold leading-tight">
                    {slot.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* All Items 9x5 Grid (45 Square Slots) */}
          <div>
            <div className="text-[11px] font-sans text-[#D4D5D8] mb-1">
              All Items:
            </div>
            <div className="grid grid-cols-9 gap-[3px]">
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
                    title={
                      slot.isPowerShard
                        ? `Power Shard (${slot.count}) · Tap to install into Overclock slot`
                        : `${slot.name} (${slot.count})`
                    }
                    className={`relative aspect-square w-full rounded-[2px] bg-[#CFCFD1] flex items-center justify-center p-0.5 hover:ring-2 hover:ring-[#DF8A2E] ${
                      slot.isPowerShard
                        ? 'border-2 border-[#DF8A2E]'
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
                    <span className="absolute bottom-0 right-0 px-1 bg-[#DF8A2E] text-white font-sans text-[8.5px] font-bold leading-tight">
                      {slot.count}
                    </span>
                  </button>
                ) : (
                  <div
                    key={`empty_${idx}`}
                    className="aspect-square w-full rounded-[2px] bg-[#3A3C41]/85 border border-[#282A2E]"
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Flush Bottom Inventory Bar: [ ↓≡ Sort ] on Left + [ 🗑️ ] Trash Slot on Right */}
        <div className="h-10 bg-[#2C2E33] border-t border-[#3E4046] flex items-stretch justify-between shrink-0">
          <button
            type="button"
            onClick={() =>
              setSortMode((prev) =>
                prev === 'default' ? 'count' : prev === 'count' ? 'name' : 'default'
              )
            }
            className="h-full px-6 bg-[#6C6F75] hover:bg-[#7D8087] text-xs font-semibold text-white flex items-center gap-2 border-r border-[#3E4046] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a1 1 0 011 1v9.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L4 13.586V4a1 1 0 011-1zm6 2h7a1 1 0 110 2h-7a1 1 0 110-2zm0 4h7a1 1 0 110 2h-7a1 1 0 110-2zm0 4h7a1 1 0 110 2h-7a1 1 0 110-2z" />
            </svg>
            <span>
              Sort{sortMode !== 'default' ? ` (${sortMode.toUpperCase()})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={onFlushBuffer}
            title="Trash / Flush Machine Internal Buffers"
            aria-label="Flush Machine Buffers"
            className="w-11 h-full bg-[#6C6F75] hover:bg-rose-600 text-white flex items-center justify-center border-l border-[#3E4046] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 3h6a1 1 0 011 1v1h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7H4a1 1 0 110-2h4V4a1 1 0 011-1zm1 2h4V4h-4v1zM7 7v12h10V7H7zm2 2a1 1 0 011 1v7a1 1 0 11-2 0v-7a1 1 0 011-1zm6 0a1 1 0 011 1v7a1 1 0 11-2 0v-7a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);
