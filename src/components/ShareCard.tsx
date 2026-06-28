import React, { useState } from 'react';
import { Trophy, Check, ArrowUpRight } from 'lucide-react';
import { IndexedUser } from '../types';
import { formatNumber } from '../utils/formatters';

interface ShareCardProps {
  user: IndexedUser;
  rank: number;
}

export default function ShareCard({ user, rank }: ShareCardProps) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(user.avatar_url || null);
  const [fallbackStep, setFallbackStep] = useState(1);

  React.useEffect(() => {
    setAvatarSrc(user.avatar_url || null);
    setFallbackStep(1);
  }, [user]);

  const handleImgError = () => {
    if (fallbackStep === 1) {
      setAvatarSrc(`https://unavatar.io/twitter/${user.x_handle}`);
      setFallbackStep(2);
    } else if (fallbackStep === 2) {
      setAvatarSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&size=80`);
      setFallbackStep(3);
    } else {
      setAvatarSrc(null);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div 
      id="proof-optimum-share-card"
      className="w-[400px] h-[400px] bg-white border border-neutral-200/50 p-8 rounded-[32px] shadow-2xl relative flex flex-col justify-between overflow-hidden select-none"
      style={{
        background: 'radial-gradient(circle at 100% 0%, rgba(201,168,76,0.12) 0%, rgba(255,255,255,1) 60%)'
      }}
    >
      {/* Decorative metal chrome blobs */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-neutral-100 rounded-full blur-2xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-16 h-16 bg-neutral-200 rounded-full blur-xl opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" strokeDasharray="3 3" />
            <path d="M12 6v12M6 12h12" />
          </svg>
          <span className="font-sans text-xs uppercase tracking-[0.2em] font-black text-black">
            Proof of Optimum
          </span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-widest bg-[#c9a84c]/10 text-[#c9a84c] px-2.5 py-1 rounded-full font-bold">
          Ecosystem Rank
        </span>
      </div>

      {/* User Info & Big Rank */}
      <div className="my-auto py-4 flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-neutral-100">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  onError={handleImgError}
                  referrerPolicy="no-referrer"
                  alt={user.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center bg-neutral-100 text-neutral-600 font-bold font-mono text-xl uppercase">
                  {user.display_name.charAt(0)}
                </div>
              )}
            </div>
            {user.verified && (
              <div className="absolute -bottom-1 -right-1 bg-sky-500 text-white rounded-full w-5 h-5 flex items-center justify-center border border-white shadow-sm">
                <Check className="w-2.5 h-2.5 stroke-[4px]" />
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="font-sans text-lg font-black text-black leading-tight max-w-[160px] truncate">
              {user.display_name}
            </div>
            <div className="text-neutral-400 font-mono text-xs mt-0.5">
              @{user.x_handle}
            </div>
          </div>
        </div>

        {/* Huge Rank Number */}
        <div className="text-right flex flex-col items-end">
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Rank</span>
          <div className="flex items-center gap-1.5">
            {rank <= 3 && <Trophy className="w-5 h-5 text-[#c9a84c] fill-current animate-bounce" />}
            <span className="font-sans text-4xl font-black text-black tracking-tight font-extrabold">
              #{rank}
            </span>
          </div>
          <span className="font-mono text-[8px] text-[#c9a84c] font-black uppercase tracking-widest mt-0.5">
            Top {rank <= 1 ? '0.1%' : rank <= 5 ? '0.5%' : rank <= 10 ? '1%' : '5%'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 border-t border-b border-neutral-100 py-3.5 z-10 text-center bg-white/40 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-neutral-400 uppercase tracking-widest">Views</span>
          <span className="font-sans text-sm font-black text-black mt-1">
            {formatNumber(user.total_views)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-neutral-400 uppercase tracking-widest">Likes</span>
          <span className="font-sans text-sm font-black text-black mt-1">
            {formatNumber(user.total_likes)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-neutral-400 uppercase tracking-widest">Posts</span>
          <span className="font-sans text-sm font-black text-black mt-1">
            {formatNumber(user.total_posts)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end border-t border-neutral-100/50 pt-3 z-10 text-left">
        <div>
          <span className="font-mono text-[7px] text-neutral-400 uppercase tracking-wider block">Verification signature</span>
          <code className="font-mono text-[8px] text-neutral-500 font-bold tracking-tighter">
            opt_sig_{Math.floor(Date.now() / 10000).toString().slice(-4)}_{user.x_handle.slice(0,6)}
          </code>
        </div>
        <span className="font-mono text-[7px] text-neutral-400 uppercase tracking-widest font-semibold">
          {currentYear} Proof of Optimum
        </span>
      </div>
    </div>
  );
}
