import React from 'react';
import SearchBar from './SearchBar';
import { Clock } from 'lucide-react';
import { formatCountdown } from '../utils/formatters';

interface HeroSectionProps {
  onSearch: (handle: string) => void;
  isLoading: boolean;
  searchError: string | null;
  countdown: number;
}

export default function HeroSection({ onSearch, isLoading, searchError, countdown }: HeroSectionProps) {
  // Simple check for last updated time
  const lastUpdatedStr = "Jun 26, 10:00 AM";

  return (
    <section className="relative min-h-[90vh] pt-28 md:pt-44 pb-12 md:pb-20 px-4 md:px-6 flex flex-col items-center justify-center text-center">
      {/* Live Status Badge */}
      <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md border border-neutral-200/80 px-4 py-2 rounded-full mb-8 shadow-sm animate-fade-in select-none">
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500">
          LIVE · 239,923 POSTS INDEXED · ALL TIME
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-sans text-4xl md:text-6xl lg:text-8xl font-black leading-[1.1] mb-4 md:mb-6 tracking-[-0.03em] select-none">
        <span className="text-black font-extrabold block">Proof of Optimum</span>
        <span className="text-black font-extrabold block">raises it.</span>
      </h1>

      {/* Subtext */}
      <p className="font-sans text-base md:text-lg text-neutral-500 mb-10 max-w-[500px] leading-relaxed select-none">
        See how much someone has helped Optimum grow on X / Twitter. Search any account to see their contribution score and rank.
      </p>

      {/* Search Bar */}
      <div className="w-full flex justify-center mb-6">
        <SearchBar onSearch={onSearch} isLoading={isLoading} error={searchError} />
      </div>

      {/* Data Freshness */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-400 uppercase tracking-widest select-none">
        <Clock className="w-3.5 h-3.5" />
        <span>Data refreshes every 6 hours · Next update in {formatCountdown(countdown)}</span>
      </div>
    </section>
  );
}
