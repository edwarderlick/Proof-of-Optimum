import React from 'react';
import { RankMode } from '../types';

interface RankToggleProps {
  currentMode: RankMode;
  onChange: (mode: RankMode) => void;
}

export default function RankToggle({ currentMode, onChange }: RankToggleProps) {
  return (
    <div className="flex bg-neutral-100 p-1 rounded-full border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
      {(['views', 'likes', 'posts'] as RankMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-6 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all uppercase font-bold select-none cursor-pointer ${
            currentMode === mode
              ? 'bg-white text-black shadow-sm font-black'
              : 'text-neutral-500 hover:text-black hover:bg-white/40'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
