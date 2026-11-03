import React, { useState } from 'react';
import { CHANGELOG_DATA } from '../game/changelogData';
import { APP_BUILD_TAG } from '../game/version';

interface ChangelogModalProps {
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(CHANGELOG_DATA[0].version);

  const activeRelease =
    CHANGELOG_DATA.find((r) => r.version === selectedVersion) || CHANGELOG_DATA[0];

  return (
    <div
      role="dialog"
      aria-label="Changelog"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-[96vw] max-w-3xl h-[90vh] max-h-[500px] rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0B0F17] border-b border-[#26334D] shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-display font-bold text-white tracking-wide">
              Patch Notes &amp; Changelog
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-[#131B2E] border border-amber-500/40 text-[10px] font-mono font-semibold text-amber-400">
              {APP_BUILD_TAG}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] flex items-center justify-center font-bold text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body: Left Version Nav + Right Detail Area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Versions Sidebar */}
          <div className="w-36 sm:w-44 shrink-0 bg-[#0B0F17]/70 border-r border-[#26334D] p-2 overflow-y-auto space-y-1">
            {CHANGELOG_DATA.map((release) => {
              const isSelected = release.version === selectedVersion;
              return (
                <button
                  key={release.version}
                  type="button"
                  onClick={() => setSelectedVersion(release.version)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-mono transition-all flex flex-col ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:bg-[#1E293B] hover:text-white'
                  }`}
                >
                  <span className="font-semibold text-[11px] truncate">{release.tag}</span>
                  <span
                    className={`text-[9px] ${
                      isSelected ? 'text-slate-900/80 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {release.date}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Release Notes Panel */}
          <div className="flex-1 min-w-0 p-3 sm:p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#26334D]">
              <div>
                <h3 className="text-sm font-bold text-white font-display">
                  Release {activeRelease.tag}
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Published {activeRelease.date}
                </span>
              </div>
            </div>

            {activeRelease.categories.map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
                  {cat.category}
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {cat.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="p-2.5 rounded-xl bg-[#0B0F17] border border-[#26334D]/80 flex flex-col gap-0.5"
                    >
                      <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-300 pl-3 leading-relaxed">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0B0F17] border-t border-[#26334D] flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
          <span>Straightforward changelog — quick to scan</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
