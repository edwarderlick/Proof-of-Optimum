import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { GlobalStats } from '../types';
import { getMockStats, subscribeToMockDb } from '../utils/mockDb';

export function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'global_stats', 'stats');
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStats({
              total_views: data.total_views || 0,
              total_likes: data.total_likes || 0,
              total_posts: data.total_posts || 0,
              indexed_users: data.indexed_users || 0,
              last_updated_at: data.last_updated_at?.toDate() || new Date(),
              next_update_at: data.next_update_at?.toDate() || new Date(),
            });
          }
          setLoading(false);
        },
        (error) => {
          console.error('Global stats subscription error:', error);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      const handleUpdate = () => {
        setStats(getMockStats());
        setLoading(false);
      };
      handleUpdate();
      return subscribeToMockDb(handleUpdate);
    }
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!stats) return;

    const calculateCountdown = () => {
      const nextTime = new Date(stats.next_update_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((nextTime - now) / 1000));
      setCountdown(diff);
    };

    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);

    return () => clearInterval(timer);
  }, [stats]);

  return {
    stats,
    loading,
    countdown,
  };
}
