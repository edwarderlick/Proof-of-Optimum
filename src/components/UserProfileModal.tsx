import React, { useState } from 'react';
import { X, Check, Share2, ArrowUpRight, Loader2, ExternalLink } from 'lucide-react';
import { IndexedUser } from '../types';
import { formatNumber } from '../utils/formatters';
import ActivityChart from './ActivityChart';
import { useGlobalStats } from '../hooks/useGlobalStats';

interface UserProfileModalProps {
  user: IndexedUser | null;
  isOpen: boolean;
  onClose: () => void;
}

function cardRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function UserProfileModal({ user, isOpen, onClose }: UserProfileModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const { stats } = useGlobalStats();
  const [modalUser, setModalUser] = useState<IndexedUser | null>(user);
  const [avatarError, setAvatarError] = useState(false);

  // Reset all view-state when selected user changes
  React.useEffect(() => {
    if (user) {
      setModalUser(user);
      setAvatarError(false);
    }
  }, [user]);

  // Fetch Firestore profile when user changes — only overwrite fields where fresh data is better
  React.useEffect(() => {
    if (!user?.x_handle) return;
    fetch('/api/user-profile?handle=' + user.x_handle)
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          const fresh = data.user;
          const bestAvatar = fresh.avatar_url || `https://unavatar.io/twitter/${user.x_handle}`;
          setModalUser(prev => ({
            ...prev,
            total_views:     fresh.total_views     > 0 ? fresh.total_views     : prev?.total_views     || 0,
            total_likes:     fresh.total_likes     > 0 ? fresh.total_likes     : prev?.total_likes     || 0,
            total_posts:     fresh.total_posts     > 0 ? fresh.total_posts     : prev?.total_posts     || 0,
            followers_count: fresh.followers_count > 0 ? fresh.followers_count : prev?.followers_count || 0,
            rank_views:      fresh.rank_views      > 0 ? fresh.rank_views      : prev?.rank_views      || 0,
            avatar_url:      bestAvatar,
            display_name:    fresh.display_name    || prev?.display_name || user.x_handle,
          }));
        }
      })
      .catch(console.error);
  }, [user?.x_handle]);

  if (!isOpen || !user) return null;

  // Use fresh data from Firestore if available, fall back to the prop
  const u = modalUser || user;

  const storedRank =
    typeof u.rank_views === 'number' && u.rank_views > 0 && u.rank_views !== 999
      ? u.rank_views
      : (u.rank && u.rank > 0 ? u.rank : null);
  const rankDisplay = storedRank ? `#${storedRank}` : 'UNRANKED';
  const totalIndexed = stats?.indexed_users || 0;
  const rawPercent = storedRank && totalIndexed > 0
    ? (storedRank / totalIndexed) * 100
    : null;
  // Clamp at 100% — rank can exceed total_users if data was indexed at different times
  const topPercent = rawPercent !== null
    ? `Top ${Math.min(rawPercent, 100).toFixed(1)}%`
    : '—';
  const hasData = (u.total_views || 0) > 0 || (u.total_posts || 0) > 0;


  const handleShareCard = async () => {
    setIsSharing(true);
    try {
      const cardUser = modalUser || user;
      const W = 700, H = 380;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // ── DARK BACKGROUND ──
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#0d0d1a');
      bgGrad.addColorStop(1, '#16102a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── HEADER ──
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, W, 48);

      await new Promise<void>((resolve) => {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => { ctx.drawImage(logo, 18, 10, 28, 28); resolve(); };
        logo.onerror = () => resolve();
        logo.src = '/optimum.png';
      });

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Inter, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('PROOF OF OPTIMUM', 54, 30);

      const hGrad = ctx.createLinearGradient(0, 0, W, 0);
      hGrad.addColorStop(0, '#C9A84C');
      hGrad.addColorStop(0.6, '#C9A84C');
      hGrad.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 48, W, 1.5);

      // ── MASCOT: flush left, full height below header ──
      await new Promise<void>((resolve) => {
        const mascot = new Image();
        mascot.crossOrigin = 'anonymous';
        mascot.onload = () => {
          const aspect = mascot.naturalWidth / mascot.naturalHeight;
          const mH = H - 48;
          const mW = mH * aspect;

          const glow = ctx.createRadialGradient(mW / 2, H - 50, 20, mW / 2, H - 50, 180);
          glow.addColorStop(0, 'rgba(80, 40, 160, 0.2)');
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 48, mW + 20, H - 48);

          ctx.drawImage(mascot, 0, 48, mW, mH);
          resolve();
        };
        mascot.onerror = () => resolve();
        mascot.src = '/mascot-transparent.png';
      });

      const MASCOT_WIDTH = 195;
      const RX = MASCOT_WIDTH + 18;

      // ── AVATAR ──
      const avatarSrc = cardUser!.avatar_url || `https://unavatar.io/twitter/${cardUser!.x_handle}`;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const AX = RX + 36, AY = 100, AR = 36;
          ctx.strokeStyle = '#C9A84C';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(AX, AY, AR + 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.save();
          ctx.beginPath();
          ctx.arc(AX, AY, AR, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, AX - AR, AY - AR, AR * 2, AR * 2);
          ctx.restore();
          resolve();
        };
        img.onerror = () => {
          const AX = RX + 36, AY = 100;
          ctx.fillStyle = '#2d2d4e';
          ctx.beginPath();
          ctx.arc(AX, AY, 36, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#888';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText((cardUser!.display_name || cardUser!.x_handle || '?')[0].toUpperCase(), AX, AY + 8);
          resolve();
        };
        img.src = avatarSrc;
      });

      // Name + handle
      const nameX = RX + 90;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText((cardUser!.display_name || cardUser!.x_handle || '').slice(0, 20), nameX, 90);
      ctx.fillStyle = '#7777aa';
      ctx.font = '13px Inter, Arial, sans-serif';
      ctx.fillText('@' + cardUser!.x_handle, nameX, 110);

      // Followers pill
      if ((cardUser!.followers_count || 0) > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(nameX, 118, 130, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#9999bb';
        ctx.font = '11px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(cardUser!.followers_count || 0) + ' followers', nameX + 65, 133);
      }

      // Rank badge
      const rank = storedRank;
      ctx.textAlign = 'center';
      if (rank) {
        ctx.fillStyle = '#C9A84C';
        ctx.beginPath();
        ctx.roundRect(RX, 152, 140, 32, 16);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Inter, Arial, sans-serif';
        ctx.fillText('🏆 RANK #' + rank, RX + 70, 173);
      }

      // Stats cards
      const statsData = [
        { label: 'VIEWS', value: formatNumber(cardUser!.total_views || 0), color: '#C9A84C' },
        { label: 'LIKES', value: formatNumber(cardUser!.total_likes || 0), color: '#ffffff' },
        { label: 'POSTS', value: String(cardUser!.total_posts || 0),       color: '#8888cc' },
      ];

      const cW = 142, cH = 76, cGap = 8, cY = 205;
      statsData.forEach((stat, i) => {
        const cx = RX + i * (cW + cGap);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx, cY, cW, cH, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#555577';
        ctx.font = '9px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, cx + cW / 2, cY + 20);
        ctx.fillStyle = stat.color;
        ctx.font = 'bold 28px Inter, Arial, sans-serif';
        ctx.fillText(stat.value, cx + cW / 2, cY + 56);
      });

      // Bottom gold line
      const bGrad = ctx.createLinearGradient(0, 0, W, 0);
      bGrad.addColorStop(0, 'rgba(201,168,76,0)');
      bGrad.addColorStop(0.15, '#C9A84C');
      bGrad.addColorStop(0.85, '#C9A84C');
      bGrad.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, H - 2, W, 2);

      const link = document.createElement('a');
      link.download = 'proof-optimum-' + cardUser!.x_handle + '.png';
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Share card error:', err);
      alert('Share card failed: ' + String(err));
    }
    setIsSharing(false);
  };

  const handleShareToX = () => {
    const views = formatNumber(u.total_views);
    const text =
      `I'm ranked ${rankDisplay} on Proof of Optimum!\n` +
      `${views} views on @get_optimum posts 🚀\n` +
      `${window.location.origin} #Optimum #ProofOfOptimum`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const signatureCode = `opt_sig_${Math.floor(Date.now() / 100000).toString().slice(-4)}_${u.x_handle.slice(0, 8)}_a8d29b`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center md:px-4">
      {/* Backdrop (desktop only — modal is full-screen on mobile) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} />

      {/* Modal: full-screen on mobile, centered popup on desktop */}
      <div className="relative w-full md:max-w-[720px] max-h-[95vh] md:max-h-[90vh] bg-white rounded-t-[28px] md:rounded-[32px] border border-neutral-200/60 shadow-[0_24px_80px_rgba(0,0,0,0.15)] overflow-y-auto transform transition-all flex flex-col md:flex-row select-none animate-fade-in">

        {/* Close */}
        <button
          className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-black transition-colors z-20 cursor-pointer rounded-full"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT COLUMN */}
        <div id="profile-card-left" className="w-full md:w-[260px] bg-neutral-50/90 border-b md:border-b-0 md:border-r border-neutral-100 p-6 md:p-8 flex flex-col items-center shrink-0 gap-4 md:gap-6">

          {/* Avatar */}
          <div
            className="relative group cursor-pointer"
            onClick={() => window.open(`https://x.com/${u.x_handle}`, '_blank')}
          >
              <img
                key={u.x_handle}
                src={
                  avatarError
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || u.x_handle || '?')}&background=e2e8f0&color=555&size=160`
                    : (u.avatar_url || `https://unavatar.io/twitter/${u.x_handle}`)
                }
                alt={u.display_name || u.x_handle}
                className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-lg transition-transform duration-300 group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={() => { if (!avatarError) setAvatarError(true); }}
              />
            <div className="absolute bottom-1 right-1 bg-sky-500 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-sm">
              <Check className="w-3.5 h-3.5 stroke-[4px]" />
            </div>
            <div className="absolute inset-0 bg-black/0 rounded-full group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Identity */}
          <div className="text-center w-full">
            <h2
              onClick={() => window.open(`https://x.com/${u.x_handle}`, '_blank')}
              className="text-xl font-sans font-extrabold text-black mb-1 hover:underline cursor-pointer"
            >
              {u.display_name}
            </h2>
            <p className="text-neutral-400 font-mono text-xs">@{u.x_handle}</p>
            {(u.followers_count || 0) > 0 && (
              <p className="text-neutral-500 font-mono text-[10px] mt-2 font-bold">
                {formatNumber(u.followers_count)} followers
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-2.5">
            <button
              onClick={handleShareCard}
              disabled={isSharing}
              className="w-full bg-black text-white h-[44px] rounded-full flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-widest font-black hover:scale-[1.02] active:scale-[0.98] disabled:opacity-55 transition-all cursor-pointer"
            >
              {isSharing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Share2 className="w-3.5 h-3.5" /> <span className="hidden md:inline">Share Card</span><span className="md:hidden">Share</span></>
              )}
            </button>

            <button
              onClick={handleShareToX}
              className="w-full border border-neutral-200 bg-white text-black h-[44px] rounded-full flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-widest font-black hover:bg-neutral-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="font-sans text-xs">𝕏</span> Share to X
            </button>

            <a
              href={`https://x.com/${u.x_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full border border-neutral-200 bg-white text-black h-[44px] rounded-full flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-widest font-black hover:bg-neutral-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View on X
            </a>
          </div>

          {/* Verification signature */}
          <div className="w-full bg-neutral-200/50 px-3 py-2.5 rounded-xl border border-neutral-200 text-center">
            <code className="text-[8px] font-mono text-neutral-500 block break-all leading-tight">
              {signatureCode}
            </code>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-grow p-5 md:p-10 flex flex-col justify-center">

          {hasData ? (
            <>
              <div className="mb-6">
                <span className="font-mono text-[9px] uppercase tracking-widest bg-[#c9a84c]/10 text-[#c9a84c] px-2.5 py-1 rounded-full font-extrabold">
                  Rank {rankDisplay} · {topPercent}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-[16px] bg-neutral-50 border border-neutral-200/60">
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1 font-bold">Total Views</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-[#c9a84c] font-sans">
                      {formatNumber(u.total_views)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[16px] bg-neutral-50 border border-neutral-200/60">
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1 font-bold">Total Likes</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-black font-sans">
                      {formatNumber(u.total_likes)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[16px] bg-neutral-50 border border-neutral-200/60">
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1 font-bold">Total Posts</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-neutral-700 font-sans">
                      {formatNumber(u.total_posts)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[16px] bg-neutral-50 border border-neutral-200/60">
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1 font-bold">Optimum Rank</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-black font-sans">{rankDisplay}</span>
                    <span className="text-[9px] text-[#c9a84c] font-mono font-bold">{topPercent}</span>
                  </div>
                </div>
              </div>

              {/* Activity chart */}
              <div className="border-t border-neutral-100 pt-6">
                <ActivityChart user={u} />
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-neutral-400 text-sm mb-2">
                No Optimum-related posts found for @{u.x_handle} yet.
              </p>
              <p className="text-neutral-300 text-xs">
                Post about <span className="font-bold text-neutral-400">@get_optimum</span> to appear on the leaderboard!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
