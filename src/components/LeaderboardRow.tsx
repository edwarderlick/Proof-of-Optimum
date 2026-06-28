import React from 'react';
import { Trophy, Check, ArrowRight } from 'lucide-react';
import { IndexedUser, RankMode } from '../types';
import { formatNumber, formatRank } from '../utils/formatters';

interface LeaderboardRowProps {
  key?: React.Key;
  user: IndexedUser;
  rankMode: RankMode;
  onRowClick: (user: IndexedUser) => void;
  highlighted?: boolean;
}

export default function LeaderboardRow({ user, rankMode, onRowClick, highlighted }: LeaderboardRowProps) {

  const renderRankCell = () => {
    const rankNum =
      (typeof user.rank_views === 'number' && user.rank_views > 0 && user.rank_views !== 999)
        ? user.rank_views
        : (user.rank || 999);
    if (rankNum === 1) {
      return (
        <div className="w-9 h-9 flex items-center justify-center bg-[#c9a84c]/10 rounded-full text-[#c9a84c] shadow-sm animate-pulse">
          <Trophy className="w-5 h-5 fill-current" />
        </div>
      );
    }
    if (rankNum === 2) {
      return (
        <div className="w-9 h-9 flex items-center justify-center bg-neutral-300/30 rounded-full text-neutral-500 shadow-sm">
          <Trophy className="w-5 h-5 fill-current" />
        </div>
      );
    }
    if (rankNum === 3) {
      return (
        <div className="w-9 h-9 flex items-center justify-center bg-[#CD7F32]/10 rounded-full text-[#CD7F32] shadow-sm">
          <Trophy className="w-5 h-5 fill-current" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 flex items-center justify-center font-mono text-xs font-bold text-neutral-400">
        {formatRank(rankNum)}
      </div>
    );
  };

  return (
    <tr
      id={`row-${user.x_handle}`}
      onClick={() => onRowClick(user)}
      className={`transition-colors cursor-pointer group select-none ${
        highlighted
          ? 'bg-[#c9a84c]/10 ring-1 ring-inset ring-[#c9a84c]/30'
          : 'hover:bg-neutral-50/50'
      }`}
    >
      <td className="px-3 md:px-8 py-3 md:py-5 text-left font-medium">
        {renderRankCell()}
      </td>

      <td className="px-3 md:px-8 py-3 md:py-5">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative shrink-0">
            <div className="relative w-9 h-9 md:w-11 md:h-11 rounded-full overflow-hidden border border-neutral-200 shadow-sm bg-neutral-100 flex items-center justify-center">
              <span className="font-bold font-mono text-sm uppercase text-neutral-500 select-none pointer-events-none">
                {(user.display_name || user.x_handle || '?').charAt(0)}
              </span>
              <img
                src={user.avatar_url || `https://unavatar.io/twitter/${user.x_handle}`}
                alt={user.display_name || user.x_handle}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (!t.src.includes('unavatar.io')) {
                    t.src = `https://unavatar.io/twitter/${user.x_handle}`;
                    return;
                  }
                  if (!t.src.includes('ui-avatars.com')) {
                    t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || user.x_handle || '?')}&background=e2e8f0&color=555&size=80`;
                    return;
                  }
                  t.style.display = 'none';
                }}
              />
            </div>
            {user.verified && (
              <div className="absolute -bottom-1 -right-1 bg-sky-500 text-white rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center border-2 border-white shadow-sm">
                <Check className="w-2 h-2 md:w-2.5 md:h-2.5 stroke-[4px]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className={`font-semibold text-xs md:text-base leading-snug truncate max-w-[100px] md:max-w-none ${highlighted ? 'text-[#8a6a1a]' : 'text-black'}`}>
              {user.display_name}
            </div>
            <div className="text-neutral-400 font-mono text-[10px] md:text-xs mt-0.5 truncate max-w-[100px] md:max-w-none">
              @{user.x_handle}
            </div>
          </div>
        </div>
      </td>

      <td className="px-3 md:px-8 py-3 md:py-5 text-right font-mono text-xs md:text-sm">
        <span className={`font-bold ${rankMode === 'views' ? 'text-[#c9a84c]' : 'text-neutral-800'}`}>
          {formatNumber(user.total_views)}
        </span>
      </td>

      <td className="px-3 md:px-8 py-3 md:py-5 text-right font-mono text-xs md:text-sm">
        <span className={`font-bold ${rankMode === 'likes' ? 'text-[#c9a84c]' : 'text-neutral-800'}`}>
          {formatNumber(user.total_likes)}
        </span>
      </td>

      <td className="hidden md:table-cell px-8 py-5 text-right font-mono text-sm">
        <span className={`font-bold ${rankMode === 'posts' ? 'text-[#c9a84c]' : 'text-neutral-800'}`}>
          {formatNumber(user.total_posts)}
        </span>
      </td>

      <td className="hidden md:table-cell px-8 py-5 text-right shrink-0">
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400 group-hover:text-black transition-colors">
          view <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </span>
      </td>
    </tr>
  );
}
