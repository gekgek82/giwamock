'use client';

import { useState, useMemo } from 'react';

interface PairItem {
  pool: string;
  label: string;
  subLabel: string;
}

interface PairSidebarPanelProps {
  pairs: PairItem[];
  selectedPool: string | null;
  onSelect: (pool: string | null) => void;
  accentColor?: 'indigo' | 'green';
}

export function PairSidebarPanel({
  pairs,
  selectedPool,
  onSelect,
  accentColor = 'indigo',
}: PairSidebarPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      search.trim() === ''
        ? pairs
        : pairs.filter((p) =>
            p.label.toLowerCase().includes(search.toLowerCase()),
          ),
    [pairs, search],
  );

  const activeClass =
    accentColor === 'green'
      ? 'bg-ds-green-900 text-white'
      : 'bg-ds-violet-900 text-white';

  const activeSubClass =
    accentColor === 'green' ? 'text-ds-green-400' : 'text-ds-violet-400';

  return (
    <aside className="w-48 flex-shrink-0 bg-ds-background-200 border-r border-ds-gray-400 flex flex-col">
      <div className="p-3 border-b border-ds-gray-400">
        <p className="text-[10px] text-ds-gray-600 uppercase tracking-widest mb-2">
          Pairs
        </p>
        <input
          className="w-full text-xs bg-ds-background-100 border border-ds-gray-400 rounded px-2 py-1.5 text-ds-gray-900 placeholder-ds-gray-600 focus:outline-none focus:border-ds-gray-600"
          placeholder="Search pairs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto p-2 flex flex-col gap-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedPool === null
              ? activeClass
              : 'text-ds-gray-800 hover:bg-ds-gray-200'
          }`}
        >
          All Pairs (Global)
        </button>
        {filtered.map((pair) => (
          <button
            key={pair.pool}
            onClick={() => onSelect(pair.pool)}
            className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
              selectedPool === pair.pool
                ? activeClass
                : 'text-ds-gray-800 hover:bg-ds-gray-200'
            }`}
          >
            <div>{pair.label}</div>
            <div
              className={`text-[10px] ${
                selectedPool === pair.pool
                  ? activeSubClass
                  : 'text-ds-gray-600'
              }`}
            >
              {pair.subLabel}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
