export interface IndexedUser {
  x_handle: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  followers_count: number;
  total_views: number;
  total_likes: number;
  total_posts: number;
  rank_views: number;
  rank_likes: number;
  rank_posts: number;
  badge: string | null;
  last_indexed_at: Date | string;
  rank?: number; // computed client-side
}

export interface GlobalStats {
  total_views: number;
  total_likes: number;
  total_posts: number;
  indexed_users: number;
  last_updated_at: Date | string;
  next_update_at: Date | string;
}

export type RankMode = 'views' | 'likes' | 'posts';
