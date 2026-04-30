import { supabase } from './supabase';

export interface OwnEngineMetrics {
  posts_shipped_quarter: number;
  posts_lifetime: number;
  lead_magnets_quarter: number;
  outreach_messages_quarter: number;
  active_workflows: number;
  recordings_lifetime: number;
  last_post_at: string | null;
  as_of: string;
}

export interface RecentOwnPost {
  id: string;
  post_text: string;
  linkedin_url: string;
  posted_at: string;
  post_type: string | null;
  num_likes: number;
  num_comments: number;
  num_shares: number;
}

export async function fetchOwnEngineMetrics(): Promise<OwnEngineMetrics> {
  const { data, error } = await supabase.rpc('public_engine_metrics');
  if (error) throw error;
  return data as OwnEngineMetrics;
}

export async function fetchRecentOwnPosts(limit = 6): Promise<RecentOwnPost[]> {
  const { data, error } = await supabase.rpc('recent_own_posts', { p_limit: limit });
  if (error) throw error;
  return (data as RecentOwnPost[]) ?? [];
}
