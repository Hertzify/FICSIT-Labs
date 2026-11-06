/**
 * ============================================================================
 * MODULE INDEX: Pioneer Player Inventory Sidebar (`src/components/PioneerInventoryPanel.tsx`)
 * ============================================================================
 * Matches Satisfactory's translucent right-hand Pioneer Inventory panel:
 * - Translucent smoky glass background (`bg-[#14161A]/68 backdrop-blur-[2px]`) so the
 *   factory world remains subtly visible behind the inventory
 * - Relevant Items row (50x50px slots)
 * - 9x5 All Items grid (45 square slots with semi-transparent empty slots)
 * - Flush bottom bar with `[ ↓≡ Sort ]` on the left and `[ 🗑️ ]` Trash/Delete on the right
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { getItemIconUrl, ITEM_ICON_PATHS } from '../game/icons';
import { MachineNode, RecipeDef } from '../game/types';

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
      <div className="w-[401px] h-[706px] shrink-0 flex flex-col justify-between bg-[#121417]/68 backdrop-blur-[1.5px] select-none">
        <div className="px-3 pt-2.5 pb-2 space-y-2.5">
          {/* Relevant Items Row */}
          <div>
            <div className="text-[13px] font-sans font-normal text-[#E8E8E8] mb-1.5">
              Relevant Items:
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[60px]">
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
                  className="relative w-[60px] h-[60px] rounded-[3px] bg-[#D0D0D0] flex items-center justify-center p-1 hover:ring-2 hover:ring-[#E59334] cursor-pointer"
                >
                  {slot.iconUrl && (
                    <img
                      src={slot.iconUrl}
                      alt={slot.name}
                      className="w-[50px] h-[50px] object-contain"
                    />
                  )}
                  <span className="absolute bottom-[1px] right-[1px] px-1.5 py-[1px] rounded-[2px] bg-[#E59334] text-white font-sans text-[13px] font-bold leading-none">
                    {slot.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* All Items 9x5 Grid (45 Square Slots) */}
          <div>
            <div className="text-[13px] font-sans font-normal text-[#E8E8E8] mb-1.5">
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
                        onUpdateOverclock(clockSpeedPct, nextShards);
                      } else if (onFillInputBuffer && node.inputs.length > 0) {
                        onFillInputBuffer();
                      }
                    }}
                    title={
                      slot.isPowerShard
                        ? `Power Shard (${slot.count}) · Tap to install into Overclock slot`
                        : `${slot.name} (${slot.count})`
                    }
                    className={`relative aspect-square w-full rounded-[2px] flex items-center justify-center p-0.5 hover:ring-2 hover:ring-[#E59334] cursor-pointer ${
                      slot.isPowerShard
                        ? 'bg-[#EAEAEA] border-2 border-[#E59334]'
                        : 'bg-[#D0D0D0]'
                    }`}
                  >
                    {slot.isPowerShard ? (
                      <PowerShardCrystalIcon active />
                    ) : (
                      slot.iconUrl && (
                        <img
                          src={slot.iconUrl}
                          alt={slot.name}
                          className="w-[86%] h-[86%] object-contain"
                        />
                      )
                    )}
                    <span className="absolute bottom-[1px] right-[1px] px-1 py-[1px] rounded-[1.5px] bg-[#E59334] text-white font-sans text-[11.5px] font-bold leading-none">
                      {slot.count}
                    </span>
                  </button>
                ) : (
                  <div
                    key={`empty_${idx}`}
                    className="aspect-square w-full rounded-[2px] bg-[#555555]/55"
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Flush Bottom Inventory Bar: [ ↓≡ Sort ] on Left + Translucent Spacer + [ 🗑️ ] on Right */}
        <div className="h-[56px] bg-transparent flex items-stretch justify-between shrink-0">
          <button
            type="button"
            onClick={() =>
              setSortMode((prev) =>
                prev === 'default' ? 'count' : prev === 'count' ? 'name' : 'default'
              )
            }
            className="w-[130px] h-full bg-[#686868] hover:bg-[#7A7A7A] text-[14px] font-normal text-[#EAEAEA] flex items-center justify-center gap-2.5 border-r-2 border-[#18191C] transition-colors cursor-pointer"
          >
            {/* Satisfactory Stepped Sort Icon: Down Arrow on Left + 3 Stepped Horizontal Bars on Right */}
            <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 22 18" fill="currentColor">
              {/* Vertical arrow shaft + downward arrowhead */}
              <path d="M5 2h2v10h2.5L6 16 2.5 12H5V2z" />
              {/* 3 horizontal bars of stepped increasing width */}
              <rect x="11" y="2.5" width="4.5" height="2.2" rx="0.5" />
              <rect x="11" y="7.4" width="7" height="2.2" rx="0.5" />
              <rect x="11" y="12.3" width="9.5" height="2.2" rx="0.5" />
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
            className="w-[58px] h-full bg-[#686868] hover:bg-rose-600 text-white flex items-center justify-center border-l-2 border-[#18191C] transition-colors cursor-pointer"
          >
            {/* Satisfactory Solid White Tapered Trash Can Silhouette with Lid, Top Handle, and 3 Vertical Cutouts */}
            <svg className="w-9 h-9" viewBox="0 0 32 32" fill="none">
              {/* Top Handle Loop */}
              <path
                d="M12.5 3.5C12.5 2.67 13.17 2 14 2H18C18.83 2 19.5 2.67 19.5 3.5V5.5H17.5V4H14.5V5.5H12.5V3.5Z"
                fill="currentColor"
              />
              {/* Wide Solid Lid Bar */}
              <rect x="5.5" y="5.5" width="21" height="3.2" rx="1" fill="currentColor" />
              {/* Tapered Solid Bin Body with 3 Vertical Cutout Slots */}
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.8 10.5H25.2L23.6 28.2C23.5 29.2 22.65 30 21.65 30H10.35C9.35 30 8.5 29.2 8.4 28.2L6.8 10.5ZM10.5 13.5L11.4 26.5H13.2L12.3 13.5H10.5ZM15.1 13.5V26.5H16.9V13.5H15.1ZM19.7 13.5L18.8 26.5H20.6L21.5 13.5H19.7Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);
