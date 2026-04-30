import { supabase } from './supabase';

export interface OwnEngineMetrics {
  posts_shipped_quarter: number;
  posts_in_queue: number;
  active_workflows: number;
  avg_days_queue_to_live: number | null;
  last_post_at: string | null;
  as_of: string;
}

export async function fetchOwnEngineMetrics(): Promise<OwnEngineMetrics> {
  const { data, error } = await supabase.rpc('public_engine_metrics');
  if (error) throw error;
  return data as OwnEngineMetrics;
}
