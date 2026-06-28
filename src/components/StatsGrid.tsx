import React from 'react';
import { TrendingUp, Heart, History, ShieldCheck, Loader2 } from 'lucide-react';
import { GlobalStats } from '../types';
import { formatNumber } from '../utils/formatters';

interface StatsGridProps {
  stats: GlobalStats | null;
  loading: boolean;
}

export default function StatsGrid({ stats, loading }: StatsGridProps) {
  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 select-none">
      {/* Stat 1: Views */}
      <div className="bg-white border border-neutral-200/80 rounded-[20px] p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300">
        <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Total Views</p>
        <p className="font-sans text-3xl md:text-4xl font-extrabold text-black tracking-tighter">
          {formatNumber(stats.total_views)}
        </p>
        <div className="mt-4 flex items-center gap-1 text-[#C9A84C]">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">12% increase</span>
        </div>
      </div>

      {/* Stat 2: Likes */}
      <div className="bg-white border border-neutral-200/80 rounded-[20px] p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300">
        <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Total Likes</p>
        <p className="font-sans text-3xl md:text-4xl font-extrabold text-black tracking-tighter">
          {formatNumber(stats.total_likes)}
        </p>
        <div className="mt-4 flex items-center gap-1 text-[#C9A84C]">
          <Heart className="w-3.5 h-3.5" />
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Engagement peak</span>
        </div>
      </div>

      {/* Stat 3: Posts */}
      <div className="bg-white border border-neutral-200/80 rounded-[20px] p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300">
        <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Total Posts</p>
        <p className="font-sans text-3xl md:text-4xl font-extrabold text-black tracking-tighter">
          {formatNumber(stats.total_posts)}
        </p>
        <div className="mt-4 flex items-center gap-1 text-[#C9A84C]">
          <History className="w-3.5 h-3.5" />
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">All time</span>
        </div>
      </div>

      {/* Stat 4: Indexed Users */}
      <div className="bg-white border border-neutral-200/80 rounded-[20px] p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300">
        <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Indexed Users</p>
        <p className="font-sans text-3xl md:text-4xl font-extrabold text-black tracking-tighter">
          {stats.indexed_users.toLocaleString()}
        </p>
        <div className="mt-4 flex items-center gap-1 text-[#C9A84C]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Active ecosystem</span>
        </div>
      </div>
    </div>
  );
}
