import React, { useState } from 'react';
import {
  BUILD_CATEGORIES,
  BUILDING_LIST,
  CONVEYOR_BELT_TIER_LIST,
  CONVEYOR_BELT_TIERS,
  RECIPES,
} from '../game/catalog';
import { getBuildingIconUrl, getItemIconUrl } from '../game/icons';
import { BuildCategory, ConveyorBeltTier, SettingsConfig } from '../game/types';

interface BuildMenuModalProps {
  settings: SettingsConfig;
  activeBeltTier: ConveyorBeltTier;
  onSelectBeltTier: (tier: ConveyorBeltTier) => void;
  onSelectBuildingToPlace: (buildingId: string) => void;
  onClose: () => void;
}

export const BuildMenuModal: React.FC<BuildMenuModalProps> = ({
  settings,
  activeBeltTier,
  onSelectBeltTier,
  onSelectBuildingToPlace,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildCategory>('production');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('miner_mk1');
  const [selectedBeltTier, setSelectedBeltTier] = useState<ConveyorBeltTier | null>(null);

  const categoryBuildings = BUILDING_LIST.filter((b) => b.category === activeCategory);
  const selectedDef =
    categoryBuildings.find((b) => b.id === selectedBuildingId) ??
    categoryBuildings[0] ??
    BUILDING_LIST[0];

  const selectedBeltDef = selectedBeltTier ? CONVEYOR_BELT_TIERS[selectedBeltTier] : null;
  const selectedBuildingIcon = selectedBeltDef
    ? getBuildingIconUrl(selectedBeltDef.id)
    : getBuildingIconUrl(selectedDef.id, selectedDef.defaultRecipeId);

  return (
    <div
      role="dialog"
      aria-label="FICSIT Build Menu"
      className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
        className="w-[96vw] max-w-5xl h-[92vh] max-h-[480px] rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Compact Top Header & Category Bar (Satisfactory Q-Menu Tabs) */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0B0F17] border-b border-[#26334D] shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {BUILD_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedBeltTier(null);
                    const firstInCat = BUILDING_LIST.find((b) => b.category === cat.id);
                    if (firstInCat) setSelectedBuildingId(firstInCat.id);
                  }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-display font-bold text-xs tracking-wide whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#131B2E] text-slate-300 hover:text-white border border-[#26334D]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Close Build Menu"
            onClick={onClose}
            className="min-h-[36px] px-3 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap shrink-0"
          >
            Close [Esc]
          </button>
        </div>

        {/* Always-Horizontal 12-Column Split for Widescreen Android Landscape */}
        <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
          {/* Left 7 Columns: Unified 2/3-Column Landscape Machine & Conveyor Belt Grid */}
          <div className="col-span-7 p-3 overflow-y-auto border-r border-[#26334D]">
            {activeCategory === 'logistics' && (
              <div className="mb-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Conveyor Belts (Mk.1 – Mk.6 Physical Transit)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CONVEYOR_BELT_TIER_LIST.map((bt) => {
                    const isPicked = selectedBeltTier === bt.tier;
                    const isEquipped = activeBeltTier === bt.tier;
                    const bIcon = getBuildingIconUrl(bt.id);
                    return (
                      <button
                        key={bt.id}
                        type="button"
                        onClick={() => setSelectedBeltTier(bt.tier)}
                        onDoubleClick={() => {
                          onSelectBeltTier(bt.tier);
                          onClose();
                        }}
                        className={`min-h-[82px] p-2.5 rounded-xl text-left flex flex-col justify-between ${
                          isPicked
                            ? 'bg-[#1B2744] border-2 border-amber-500 shadow-md'
                            : 'bg-[#0B0F17] border border-[#26334D] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          {bIcon && (
                            <img
                              src={bIcon}
                              alt={bt.name}
                              className="w-8 h-8 object-contain rounded-md bg-[#131B2E] p-0.5 border border-[#26334D] shrink-0"
                            />
                          )}
                          <span
                            className="font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${bt.accentColor}22`,
                              color: bt.accentColor,
                            }}
                          >
                            {bt.capacityPerMin}/m
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <div className="text-xs font-display font-bold text-white truncate">
                            {bt.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {isEquipped
                              ? `Equipped · ${bt.capacityPerMin} items/min`
                              : `Max ${bt.capacityPerMin} items/min`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {categoryBuildings.map((b) => {
                const isPicked = selectedBeltTier === null && selectedDef.id === b.id;
                const bIcon = getBuildingIconUrl(b.id, b.defaultRecipeId);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBeltTier(null);
                      setSelectedBuildingId(b.id);
                    }}
                    onDoubleClick={() => onSelectBuildingToPlace(b.id)}
                    className={`min-h-[88px] p-2.5 rounded-xl text-left flex flex-col justify-between ${
                      isPicked
                        ? 'bg-[#1B2744] border-2 border-amber-500 shadow-md'
                        : 'bg-[#0B0F17] border border-[#26334D] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {bIcon ? (
                        <img
                          src={bIcon}
                          alt={b.name}
                          className="w-8 h-8 object-contain rounded-md bg-[#131B2E] p-0.5 border border-[#26334D] shrink-0"
                        />
                      ) : (
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: b.accentColor }}
                        />
                      )}
                      <span className="font-mono tabular-nums text-[10px] text-slate-400">
                        {b.inputPortCount}IN·{b.outputPortCount}OUT
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-display font-bold text-white truncate">
                        {b.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {b.subcategory}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 5 Columns: Upload Labs Node / Conveyor Belt Blueprint Inspector */}
          <div className="col-span-5 p-3 bg-[#0E1525] flex flex-col justify-between min-h-0 overflow-hidden">
            {selectedBeltDef ? (
              <>
                <div className="overflow-y-auto pr-1 space-y-2.5">
                  <div className="rounded-xl bg-[#131B2E] border border-[#26334D] overflow-hidden">
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: selectedBeltDef.accentColor }}
                    />
                    <div className="p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectedBuildingIcon && (
                            <img
                              src={selectedBuildingIcon}
                              alt={selectedBeltDef.name}
                              className="w-9 h-9 object-contain rounded-lg bg-[#0B0F17] p-1 border border-[#26334D] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-sm font-display font-bold text-white truncate">
                              {selectedBeltDef.name}
                            </h2>
                            <div className="text-[10px] text-slate-400 truncate">
                              {selectedBeltDef.unlockTier}
                            </div>
                          </div>
                        </div>
                        <span
                          className="text-[11px] font-mono font-bold tabular-nums shrink-0"
                          style={{ color: selectedBeltDef.accentColor }}
                        >
                          {selectedBeltDef.capacityPerMin} items/min
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-300 leading-snug">
                        {selectedBeltDef.description}
                      </p>

                      <div className="mt-2 pt-2 border-t border-[#26334D] space-y-1 text-[10px] font-mono tabular-nums text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>Max Throughput:</span>
                          <span className="text-slate-200 font-semibold">
                            {selectedBeltDef.capacityPerMin} items/min
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Primary Material:</span>
                          <span className="text-slate-200">{selectedBeltDef.ingredientName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-[#26334D] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBeltTier(selectedBeltDef.tier);
                      onClose();
                    }}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs active:scale-[0.99] whitespace-nowrap"
                  >
                    Equip {selectedBeltDef.name} ({selectedBeltDef.capacityPerMin}/m)
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="overflow-y-auto pr-1 space-y-2.5">
                  <div className="rounded-xl bg-[#131B2E] border border-[#26334D] overflow-hidden">
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: selectedDef.accentColor }}
                    />
                    <div className="p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectedBuildingIcon && (
                            <img
                              src={selectedBuildingIcon}
                              alt={selectedDef.name}
                              className="w-9 h-9 object-contain rounded-lg bg-[#0B0F17] p-1 border border-[#26334D] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-sm font-display font-bold text-white truncate">
                              {selectedDef.name}
                            </h2>
                            <div className="text-[10px] text-slate-400 truncate">
                              {selectedDef.subcategory}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-amber-400 shrink-0">
                          {selectedDef.powerMw > 0 ? `${selectedDef.powerMw} MW` : 'PASSIVE'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-300 leading-snug">
                        {selectedDef.description}
                      </p>

                      <div className="mt-2 pt-2 border-t border-[#26334D] flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                        <span>Inputs: {selectedDef.inputPortCount}</span>
                        <span>·</span>
                        <span>Outputs: {selectedDef.outputPortCount}</span>
                      </div>
                    </div>
                  </div>

                  {selectedDef.availableRecipeIds.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-300 mb-1">
                        Supported Production Recipes
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {selectedDef.availableRecipeIds.map((rId) => {
                          const r = RECIPES[rId];
                          if (!r) return null;
                          const outSpec = r.outputs[0];
                          const outIcon = getItemIconUrl(outSpec?.itemId ?? outSpec?.itemName);
                          return (
                            <div
                              key={rId}
                              className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#26334D] flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {outIcon && (
                                  <img
                                    src={outIcon}
                                    alt={r.name}
                                    className="w-4 h-4 object-contain shrink-0"
                                  />
                                )}
                                <span className="text-slate-200 font-medium truncate">
                                  {r.name}
                                </span>
                              </div>
                              <span className="font-mono tabular-nums text-amber-300 shrink-0 ml-2">
                                {outSpec?.ratePerMin ?? 0}/min
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 mt-2 border-t border-[#26334D] shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectBuildingToPlace(selectedDef.id)}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs active:scale-[0.99] whitespace-nowrap"
                  >
                    Place {selectedDef.name} on Canvas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
