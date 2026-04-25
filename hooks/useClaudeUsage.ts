import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type UsageSession = {
  id: string;
  source: "local" | "railway";
  session_id: string;
  project_path: string;
  primary_model: string;
  started_at: string;
  ended_at: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  message_count: number;
  turn_count: number;
  tool_call_counts: Record<string, number>;
  session_kind: string | null;
  first_user_message: string | null;
};

export type DailyTotal = {
  day: string;
  source: "local" | "railway";
  total_tokens: number;
  estimated_cost: number;
  session_count: number;
};

export type ProjectTotal = {
  project_path: string;
  source: "local" | "railway";
  total_tokens: number;
  estimated_cost: number;
  session_count: number;
  last_session: string;
};

export type UsageData = {
  sessions: UsageSession[];
  outliers: UsageSession[];
  daily: DailyTotal[];
  projects: ProjectTotal[];
  loading: boolean;
  error: string | null;
};

const REFRESH_MS = 60_000;
const WINDOW_DAYS = 30;
const SESSION_LIMIT = 500;
const OUTLIER_Z_THRESHOLD = 2;

function flagOutliers(sessions: UsageSession[]): UsageSession[] {
  if (sessions.length < 5) return [];
  const totals = sessions.map(s => s.total_tokens);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return [];
  return sessions.filter(s => (s.total_tokens - mean) / stddev >= OUTLIER_Z_THRESHOLD);
}

export function useClaudeUsage(): UsageData {
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [daily, setDaily] = useState<DailyTotal[]>([]);
  const [projects, setProjects] = useState<ProjectTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [s, d, p] = await Promise.all([
          supabase.rpc("claude_usage_recent_sessions", { p_days: WINDOW_DAYS, p_limit: SESSION_LIMIT }),
          supabase.rpc("claude_usage_daily_totals", { p_days: WINDOW_DAYS }),
          supabase.rpc("claude_usage_by_project", { p_days: WINDOW_DAYS }),
        ]);
        if (cancelled) return;
        if (s.error) throw s.error;
        if (d.error) throw d.error;
        if (p.error) throw p.error;
        setSessions((s.data ?? []) as UsageSession[]);
        setDaily((d.data ?? []) as DailyTotal[]);
        setProjects((p.data ?? []) as ProjectTotal[]);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load usage");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const outliers = useMemo(() => flagOutliers(sessions), [sessions]);

  return { sessions, outliers, daily, projects, loading, error };
}
