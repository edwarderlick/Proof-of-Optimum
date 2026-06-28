import { useState } from 'react';
import { IndexedUser } from '../types';

export function useScanUser() {
  const [result, setResult] = useState<IndexedUser | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const scan = async (handle: string) => {
    if (!handle || handle.trim() === '') {
      setError('X handle is required');
      setStatus('error');
      return;
    }

    const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
    setStatus('scanning');
    setError(null);
    setResult(null);

    try {
      // ALWAYS call the scan API — never serve stale Firestore data
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: cleanHandle }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Scan failed');
      }

      if (data.user) {
        const u = data.user;
        const user: IndexedUser = {
          x_handle: u.x_handle || cleanHandle,
          display_name: u.display_name || cleanHandle,
          avatar_url: u.avatar_url || `https://unavatar.io/twitter/${cleanHandle}`,
          verified: !!u.verified,
          followers_count: u.followers_count || 0,
          total_views: u.total_views || 0,
          total_likes: u.total_likes || 0,
          total_posts: u.total_posts || 0,
          rank_views: u.rank_views || 999,
          rank_likes: u.rank_likes || 999,
          rank_posts: u.rank_posts || 999,
          badge: u.badge || null,
          last_indexed_at: new Date(),
        };
        setResult(user);
        setStatus('success');
      } else {
        setError('@' + cleanHandle + ' has no Optimum-related posts yet');
        setStatus('error');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err?.message || 'Scan failed. Try again.');
      setStatus('error');
    }
  };

  return { scan, result, status, error, setResult, setStatus };
}
