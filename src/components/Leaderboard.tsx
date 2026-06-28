import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Search, Loader2, ArrowRight } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useGlobalStats } from '../hooks/useGlobalStats';
import { IndexedUser, RankMode } from '../types';
import LeaderboardRow from './LeaderboardRow';
import RankToggle from './RankToggle';
import { formatCountdown } from '../utils/formatters';

interface LeaderboardProps {
  onUserSelect: (user: IndexedUser) => void;
  onScan?: (handle: string) => void;
  isScanning?: boolean;
  scanError?: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  rankMode: RankMode;
  setRankMode: (mode: RankMode) => void;
}

export default function Leaderboard({
  onUserSelect,
  onScan,
  isScanning,
  scanError,
  searchTerm,
  setSearchTerm,
  rankMode,
  setRankMode,
}: LeaderboardProps) {
  const { allUsers, visibleUsers, totalCount, loading, loadMore, hasMore, visibleCount, revealHandle } =
    useLeaderboard(rankMode);
  const { countdown } = useGlobalStats();

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [highlightedHandle, setHighlightedHandle] = useState<string | null>(null);
  const [pendingScanHandle, setPendingScanHandle] = useState<string | null>(null);
  const [foundNotice, setFoundNotice] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync local with parent (e.g. when parent resets)
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Clear highlight and found notice after 3 seconds
  useEffect(() => {
    if (highlightedHandle) {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        setHighlightedHandle(null);
        setFoundNotice(null);
      }, 3000);
    }
    return () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); };
  }, [highlightedHandle]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = localSearch.trim();
    if (!raw) return;

    const cleanHandle = raw.replace(/^@/, '').toLowerCase();

    // Always scan for fresh data — never serve stale leaderboard data
    setFoundNotice(null);
    setPendingScanHandle(cleanHandle);
    onScan?.(cleanHandle);
  };

  // When scan finishes (isScanning goes false), clear the pending label
  useEffect(() => {
    if (!isScanning) setPendingScanHandle(null);
  }, [isScanning]);

  // Infinite scroll: load more rows when the sentinel div enters the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < totalCount) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, totalCount]);

  // As-you-type filtering (when search is active, filter all loaded users)
  const filteredUsers = localSearch.trim()
    ? allUsers.filter(
        u =>
          u.x_handle.toLowerCase().includes(localSearch.toLowerCase()) ||
          u.display_name.toLowerCase().includes(localSearch.toLowerCase())
      )
    : visibleUsers;

  const noSearchMatch = localSearch.trim().length > 0 && filteredUsers.length === 0 && !loading;

  return (
    <div className="w-full max-w-[1000px] mx-auto select-none animate-fade-in px-4">
      <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
              className="w-full h-[56px] pl-14 pr-6 bg-white border border-neutral-200/80 rounded-full focus:ring-2 focus:ring-black/5 focus:border-neutral-300 focus:outline-none transition-all text-sm shadow-[0_2px_10px_rgba(0,0,0,0.01)]"
              placeholder="Search or scan @handle..."
              disabled={isScanning}
            />
          </div>
          <button
            type="submit"
            disabled={!localSearch.trim() || isScanning}
            className="shrink-0 bg-black text-white h-[56px] px-5 rounded-full font-mono text-[9px] uppercase tracking-widest font-bold disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </form>

        <RankToggle currentMode={rankMode} onChange={setRankMode} />
      </div>

      {/* Scan / found status messages */}
      {foundNotice && !isScanning && (
        <div className="mb-4 font-mono text-[10px] text-[#c9a84c] uppercase tracking-widest font-extrabold">
          ✓ {foundNotice}
        </div>
      )}
      {isScanning && pendingScanHandle && (
        <div className="mb-4 flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Scanning @{pendingScanHandle} for fresh data...
        </div>
      )}
      {scanError && !isScanning && (
        <div className="mb-4 font-mono text-xs text-red-500 uppercase tracking-widest">
          {scanError}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-[20px] shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-neutral-200/80 p-16 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
              Loading Leaderboard...
            </span>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">
            No data yet. Run /api/refresh to index Optimum posts.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-neutral-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-neutral-50/50 border-b border-neutral-200/80">
                <tr className="text-left font-mono text-[10px] text-neutral-400 uppercase tracking-widest">
                  <th className="px-3 md:px-8 py-3 md:py-4 font-extrabold">Rank</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 font-extrabold">Account</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 font-extrabold text-right">Views</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 font-extrabold text-right">Likes</th>
                  <th className="hidden md:table-cell px-8 py-4 font-extrabold text-right">Posts</th>
                  <th className="hidden md:table-cell px-8 py-4 font-extrabold text-right"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center">
                      {noSearchMatch ? (
                        <div className="flex flex-col items-center gap-3">
                          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                            @{localSearch.replace(/^@/, '')} not in leaderboard
                          </span>
                          {onScan && (
                            <button
                              onClick={() => handleSearchSubmit()}
                              disabled={isScanning}
                              className="bg-black text-white px-5 py-2.5 rounded-full font-mono text-[9px] uppercase tracking-widest font-bold hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
                            >
                              {isScanning ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                              ) : (
                                <>Scan @{localSearch.replace(/^@/, '')} <ArrowRight className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                          No matching accounts found
                        </span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <LeaderboardRow
                      key={user.x_handle}
                      user={user}
                      rankMode={rankMode}
                      onRowClick={onUserSelect}
                      highlighted={highlightedHandle === user.x_handle}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Infinite scroll sentinel — triggers loadMore when it scrolls into view */}
          {!localSearch.trim() && hasMore && (
            <div ref={sentinelRef} className="h-4" />
          )}

          <div className="px-8 py-5 border-t border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="text-neutral-400 w-4 h-4 animate-spin-delayed" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                DATA REFRESHES IN: {formatCountdown(countdown)}
              </span>
            </div>
            <div className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
              {localSearch.trim()
                ? `SHOWING ${filteredUsers.length} OF ${totalCount}`
                : visibleCount >= totalCount
                  ? `SHOWING ALL ${totalCount} INDEXED ACCOUNTS`
                  : `SHOWING ${visibleCount} OF ${totalCount} · SCROLL FOR MORE`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
