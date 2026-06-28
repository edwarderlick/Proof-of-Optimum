import { IndexedUser, GlobalStats } from '../types';

const INITIAL_USERS: IndexedUser[] = [
  {
    x_handle: 'vitalik.eth',
    display_name: 'Vitalik Buterin',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
    verified: true,
    followers_count: 5400000,
    total_views: 2800000,
    total_likes: 98200,
    total_posts: 512,
    rank_views: 1,
    rank_likes: 1,
    rank_posts: 1,
    badge: 'top1',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'opt_builder',
    display_name: 'Optimum Dev',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop',
    verified: true,
    followers_count: 82500,
    total_views: 1900000,
    total_likes: 72400,
    total_posts: 310,
    rank_views: 2,
    rank_likes: 2,
    rank_posts: 3,
    badge: 'top5',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'bob_blocks',
    display_name: 'Blockchain Bob',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 12400,
    total_views: 1200000,
    total_likes: 48000,
    total_posts: 185,
    rank_views: 3,
    rank_likes: 3,
    rank_posts: 4,
    badge: 'top5',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'schen_crypto',
    display_name: 'Sarah Chen',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 24100,
    total_views: 950000,
    total_likes: 31200,
    total_posts: 420,
    rank_views: 4,
    rank_likes: 4,
    rank_posts: 2,
    badge: 'top10',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'alex_eth',
    display_name: 'Alex Rivers',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 5100,
    total_views: 810000,
    total_likes: 22100,
    total_posts: 92,
    rank_views: 5,
    rank_likes: 5,
    rank_posts: 6,
    badge: 'top10',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'optimum_fan',
    display_name: 'Elena Rostova',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 9800,
    total_views: 640000,
    total_likes: 18500,
    total_posts: 140,
    rank_views: 6,
    rank_likes: 6,
    rank_posts: 5,
    badge: 'top10',
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'defi_wizard',
    display_name: 'Gavin Smith',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop',
    verified: true,
    followers_count: 15200,
    total_views: 520000,
    total_likes: 12300,
    total_posts: 64,
    rank_views: 7,
    rank_likes: 7,
    rank_posts: 8,
    badge: null,
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'layer2_max',
    display_name: 'Nikhil Nair',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 3300,
    total_views: 430000,
    total_likes: 9800,
    total_posts: 78,
    rank_views: 8,
    rank_likes: 8,
    rank_posts: 7,
    badge: null,
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'crypto_curious',
    display_name: 'Jane Doe',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 1200,
    total_views: 280000,
    total_likes: 6200,
    total_posts: 30,
    rank_views: 9,
    rank_likes: 9,
    rank_posts: 10,
    badge: null,
    last_indexed_at: new Date().toISOString()
  },
  {
    x_handle: 'web3_scout',
    display_name: 'Liam Carter',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=256&auto=format&fit=crop',
    verified: false,
    followers_count: 2500,
    total_views: 150000,
    total_likes: 3500,
    total_posts: 45,
    rank_views: 10,
    rank_likes: 10,
    rank_posts: 9,
    badge: null,
    last_indexed_at: new Date().toISOString()
  }
];

const INITIAL_STATS: GlobalStats = {
  total_views: 24200000,
  total_likes: 614300,
  total_posts: 240000,
  indexed_users: 30695,
  last_updated_at: new Date().toISOString(),
  next_update_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
};

// Simple pub-sub implementation
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToMockDb(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach(l => l());
}

export function getMockUsers(): IndexedUser[] {
  const data = localStorage.getItem('opt_mock_users');
  if (!data) {
    localStorage.setItem('opt_mock_users', JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(data);
}

export function getMockStats(): GlobalStats {
  const data = localStorage.getItem('opt_mock_stats');
  if (!data) {
    localStorage.setItem('opt_mock_stats', JSON.stringify(INITIAL_STATS));
    return INITIAL_STATS;
  }
  return JSON.parse(data);
}

export function saveMockUsers(users: IndexedUser[]) {
  // Sort and assign ranks
  // rank_views
  const sortedViews = [...users].sort((a, b) => b.total_views - a.total_views);
  sortedViews.forEach((u, i) => {
    u.rank_views = i + 1;
  });

  // rank_likes
  const sortedLikes = [...users].sort((a, b) => b.total_likes - a.total_likes);
  sortedLikes.forEach((u, i) => {
    u.rank_likes = i + 1;
  });

  // rank_posts
  const sortedPosts = [...users].sort((a, b) => b.total_posts - a.total_posts);
  sortedPosts.forEach((u, i) => {
    u.rank_posts = i + 1;
  });

  // Assign badges
  users.forEach(u => {
    const viewRank = u.rank_views;
    if (viewRank === 1) u.badge = 'top1';
    else if (viewRank <= 5) u.badge = 'top5';
    else if (viewRank <= 10) u.badge = 'top10';
    else u.badge = null;
  });

  localStorage.setItem('opt_mock_users', JSON.stringify(users));
  
  // Re-calculate global stats
  const stats = getMockStats();
  stats.indexed_users = users.length + 30685; // anchor with base
  stats.total_views = users.reduce((acc, u) => acc + u.total_views, 24200000 - INITIAL_USERS.reduce((acc, u) => acc + u.total_views, 0));
  stats.total_likes = users.reduce((acc, u) => acc + u.total_likes, 614300 - INITIAL_USERS.reduce((acc, u) => acc + u.total_likes, 0));
  stats.total_posts = users.reduce((acc, u) => acc + u.total_posts, 240000 - INITIAL_USERS.reduce((acc, u) => acc + u.total_posts, 0));
  stats.last_updated_at = new Date().toISOString();
  localStorage.setItem('opt_mock_stats', JSON.stringify(stats));

  notifyListeners();
}

export function scanUserMock(handle: string): Promise<IndexedUser> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
      const users = getMockUsers();
      const existing = users.find(u => u.x_handle.toLowerCase() === cleanHandle);
      
      if (existing) {
        resolve(existing);
        return;
      }

      // Generate highly plausible data
      const randomViews = Math.floor(Math.random() * 800000) + 50000;
      const randomLikes = Math.floor(randomViews * (Math.random() * 0.05 + 0.02));
      const randomPosts = Math.floor(Math.random() * 120) + 5;
      const randomFollowers = Math.floor(Math.random() * 25000) + 200;

      const newUser: IndexedUser = {
        x_handle: cleanHandle,
        display_name: cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1),
        avatar_url: `https://images.unsplash.com/photo-${['1534528741775-53994a69daeb', '1507003211169-0a1dd7228f2d', '1500648767791-00dcc994a43e', '1494790108377-be9c29b29330', '1539571696357-5a69c17a67c6'][Math.floor(Math.random() * 5)]}?q=80&w=256&auto=format&fit=crop`,
        verified: Math.random() > 0.7,
        followers_count: randomFollowers,
        total_views: randomViews,
        total_likes: randomLikes,
        total_posts: randomPosts,
        rank_views: 0,
        rank_likes: 0,
        rank_posts: 0,
        badge: null,
        last_indexed_at: new Date().toISOString()
      };

      const updatedUsers = [...users, newUser];
      saveMockUsers(updatedUsers);
      
      // Get with rank computed
      const refreshedUsers = getMockUsers();
      const finalUser = refreshedUsers.find(u => u.x_handle.toLowerCase() === cleanHandle)!;
      resolve(finalUser);
    }, 1500); // realistic scan latency
  });
}
