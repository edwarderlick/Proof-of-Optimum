import React from 'react';
import { Share2 } from 'lucide-react';

interface NavbarProps {
  onNavClick: (view: 'leaderboard' | 'analytics' | 'about') => void;
  activeView: string;
}

export default function Navbar({ onNavClick, activeView }: NavbarProps) {
  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[800px] rounded-full bg-white/80 backdrop-blur-lg border border-neutral-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.06)] flex justify-between items-center px-8 py-3 z-50 transition-all duration-300">
      {/* Brand logo */}
      <div 
        onClick={() => onNavClick('leaderboard')}
        className="flex items-center gap-2 cursor-pointer transition-all hover:scale-102 active:scale-98"
      >
        <img src="/optimum.png" alt="Optimum" className="w-6 h-6 object-contain" />
        <span className="font-sans text-[18px] font-bold text-black tracking-tight select-none">
          Proof of Optimum
        </span>
      </div>

      {/* Navigation links */}
      <nav className="hidden md:flex items-center gap-6">
        <button 
          onClick={() => onNavClick('analytics')}
          className={`font-sans text-xs uppercase tracking-[0.15em] font-semibold transition-colors ${
            activeView === 'analytics' ? 'text-black font-extrabold scale-105' : 'text-neutral-500 hover:text-black'
          }`}
        >
          Analytics
        </button>
        <button 
          onClick={() => onNavClick('leaderboard')}
          className={`font-sans text-xs uppercase tracking-[0.15em] font-semibold transition-colors ${
            activeView === 'leaderboard' ? 'text-black font-extrabold scale-105' : 'text-neutral-500 hover:text-black'
          }`}
        >
          Leaderboard
        </button>
        <button 
          onClick={() => onNavClick('about')}
          className={`font-sans text-xs uppercase tracking-[0.15em] font-semibold transition-colors ${
            activeView === 'about' ? 'text-black font-extrabold scale-105' : 'text-neutral-500 hover:text-black'
          }`}
        >
          About
        </button>
      </nav>
    </header>
  );
}
