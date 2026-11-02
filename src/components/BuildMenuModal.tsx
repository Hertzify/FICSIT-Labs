import React, { useState } from 'react';
import {
  BUILD_CATEGORIES,
  BUILDING_LIST,
  BUILDINGS,
  RECIPES,
} from '../game/catalog';
import { BuildCategory, SettingsConfig } from '../game/types';

interface BuildMenuModalProps {
  settings: SettingsConfig;
  onSelectBuildingToPlace: (buildingId: string) => void;
  onClose: () => void;
}

export const BuildMenuModal: React.FC<BuildMenuModalProps> = ({
  settings,
  onSelectBuildingToPlace,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildCategory>('production');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('smelter');

  const categoryBuildings = BUILDING_LIST.filter((b) => b.category === activeCategory);
  const selectedDef = BUILDINGS[selectedBuildingId] ?? categoryBuildings[0] ?? BUILDING_LIST[0];

  // Group buildings by subcategory (Satisfactory Build Menu layout)
  const groupedBySub = categoryBuildings.reduce<Record<string, typeof categoryBuildings>>(
    (acc, item) => {
      if (!acc[item.subcategory]) acc[item.subcategory] = [];
      acc[item.subcategory].push(item);
      return acc;
    },
    {}
  );

  return (
    <div
      role="dialog"
      aria-label="FICSIT Build Menu"
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4 md:p-6"
    >
      <div
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
        className="w-full max-w-5xl h-[84vh] max-h-[600px] rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header & Category Bar (Satisfactory Q-Menu Tabs) */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-[#0B0F17] border-b border-[#26334D]">
          <div className="flex items-center gap-2 overflow-x-auto">
            {BUILD_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const firstInCat = BUILDING_LIST.find((b) => b.category === cat.id);
                    if (firstInCat) setSelectedBuildingId(firstInCat.id);
                  }}
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-display font-bold text-xs tracking-wide transition-colors whitespace-nowrap shrink-0 ${
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
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-[#26334D] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap shrink-0"
          >
            Close [Esc]
          </button>
        </div>

        {/* Main Split Body: Left Subcategory Grid + Right Upload Labs Node Blueprint Inspector */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left 7 Columns: Satisfactory Subcategory Rows */}
          <div className="md:col-span-7 p-5 overflow-y-auto space-y-5 border-b md:border-b-0 md:border-r border-[#26334D]">
            {Object.entries(groupedBySub).map(([subName, items]) => (
              <div key={subName}>
                <h3 className="text-xs font-display font-bold text-slate-400 tracking-wide mb-2.5">
                  {subName}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {items.map((b) => {
                    const isPicked = selectedDef.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBuildingId(b.id)}
                        onDoubleClick={() => onSelectBuildingToPlace(b.id)}
                        className={`min-h-[84px] p-3.5 rounded-xl text-left flex flex-col justify-between transition-all ${
                          isPicked
                            ? 'bg-[#1B2744] border-2 border-amber-500 shadow-lg'
                            : 'bg-[#0B0F17] border border-[#26334D] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: b.accentColor }}
                          />
                          <span className="font-mono tabular-nums text-[10px] text-slate-400">
                            {b.inputPortCount} IN · {b.outputPortCount} OUT
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="text-xs font-display font-bold text-white truncate">
                            {b.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {b.subcategory}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right 5 Columns: Upload Labs Node Blueprint Inspector */}
          <div className="md:col-span-5 p-5 bg-[#0E1525] flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Visual Upload Labs Node Card Preview */}
              <div className="rounded-xl bg-[#131B2E] border border-[#26334D] overflow-hidden shadow-lg mb-4">
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: selectedDef.accentColor }}
                />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-display font-bold text-white">
                      {selectedDef.name}
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-amber-400">
                      {selectedDef.powerMw > 0 ? `${selectedDef.powerMw} MW` : 'PASSIVE'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    {selectedDef.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#26334D] flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                    <span>Input Ports: {selectedDef.inputPortCount}</span>
                    <span>·</span>
                    <span>Output Ports: {selectedDef.outputPortCount}</span>
                  </div>
                </div>
              </div>

              {/* Compatible Recipes List */}
              {selectedDef.availableRecipeIds.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2">
                    Supported Production Recipes
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedDef.availableRecipeIds.map((rId) => {
                      const r = RECIPES[rId];
                      if (!r) return null;
                      return (
                        <div
                          key={rId}
                          className="px-3 py-2 rounded-lg bg-[#0B0F17] border border-[#26334D] flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-200 font-medium">{r.name}</span>
                          <span className="font-mono tabular-nums text-amber-300">
                            {r.outputs[0]?.ratePerMin ?? 0}/min
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-[#26334D]">
              <button
                type="button"
                onClick={() => onSelectBuildingToPlace(selectedDef.id)}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-transform active:scale-[0.99] whitespace-nowrap"
              >
                Place {selectedDef.name} on Canvas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
