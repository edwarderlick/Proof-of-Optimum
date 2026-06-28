import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { IndexedUser, RankMode } from '../types';
import { getMockUsers, subscribeToMockDb } from '../utils/mockDb';

export function useLeaderboard(rankMode: RankMode) {
  const [allUsers, setAllUsers] = useState<IndexedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [rankMode]);

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      setLoading(true);
      const orderField =
        rankMode === 'views' ? 'total_views' :
        rankMode === 'likes' ? 'total_likes' : 'total_posts';

      const q = query(
        collection(db, 'indexed_users'),
        orderBy(orderField, 'desc'),
        limit(2000)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loadedUsers: IndexedUser[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedUsers.push({
              x_handle: data.x_handle || doc.id,
              display_name: data.display_name || data.x_handle,
              avatar_url: data.avatar_url || '',
              verified: !!data.verified,
              followers_count: data.followers_count || 0,
              total_views: data.total_views || 0,
              total_likes: data.total_likes || 0,
              total_posts: data.total_posts || 0,
              rank_views: data.rank_views || 999,
              rank_likes: data.rank_likes || 999,
              rank_posts: data.rank_posts || 999,
              badge: data.badge || null,
              last_indexed_at: data.last_indexed_at?.toDate() || new Date(),
            });
          });

          const computedUsers = loadedUsers.map((user, index) => {
            const storedRank =
              typeof user.rank_views === 'number' && user.rank_views > 0 && user.rank_views !== 999
                ? user.rank_views
                : index + 1;
            return {
              ...user,
              rank: storedRank,
              rank_views: storedRank,
            };
          });

          setAllUsers(computedUsers);
          setLoading(false);
        },
        (error) => {
          console.error('Leaderboard subscription error:', error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setAllUsers([]);
      setLoading(false);
    }
  }, [rankMode]);

  const visibleUsers = allUsers.slice(0, visibleCount);
  const totalCount = allUsers.length;
  const hasMore = visibleCount < totalCount;

  const loadMore = () => {
    if (hasMore) setVisibleCount((prev) => Math.min(prev + 50, totalCount));
  };

  // Expand visible rows to include the given handle (for scroll-to)
  const revealHandle = (handle: string) => {
    const idx = allUsers.findIndex(u => u.x_handle === handle);
    if (idx >= 0) setVisibleCount((prev) => Math.max(prev, idx + 1));
  };

  return {
    allUsers,
    visibleUsers,
    totalCount,
    loading,
    loadMore,
    hasMore,
    visibleCount,
    revealHandle,
  };
}
