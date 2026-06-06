import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reads the `kyle_steal_box` view (steal tactics + call context). As of
 * 2026-06-06 the view also exposes call_type, summary (takeaway) and task_id;
 * see migrations/kyle_steal_box_view.sql for the privacy note.
 */

export interface StealItem {
  tactic: string;
  how_ivan_applies?: string;
  evidence_quote?: string;
}

export interface StealRow {
  id: string;
  task_id: string | null;
  call_type: string | null;
  call_date: string | null;
  summary: string | null;
  created_at: string;
  signal_score: number | null;
  steal_items: StealItem[];
}

/** One steal tactic, flattened with its source-call context. */
export interface StealCard extends StealItem {
  key: string;
  call_date: string | null;
  call_type: string | null;
  summary: string | null;
  created_at: string;
  signal_score: number | null;
  clickup_url: string | null;
}

/** Source-call time for ordering: call_date ms, or -1 so null/invalid sorts last. */
function callTime(c: StealCard): number {
  if (!c.call_date) return -1;
  const t = new Date(c.call_date).getTime();
  return Number.isNaN(t) ? -1 : t;
}

export function useKyleStealBox() {
  const [cards, setCards] = useState<StealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kyle_steal_box')
      .select('id, task_id, call_type, call_date, summary, created_at, signal_score, steal_items')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const flat: StealCard[] = [];
    for (const r of (data || []) as StealRow[]) {
      const items = Array.isArray(r.steal_items) ? r.steal_items : [];
      items.forEach((it, i) => {
        const tactic = (it?.tactic || '').trim();
        if (!tactic) return;
        flat.push({
          ...it,
          tactic,
          key: `${r.id}-${i}`,
          call_date: r.call_date,
          call_type: r.call_type,
          summary: r.summary,
          created_at: r.created_at,
          signal_score: r.signal_score,
          clickup_url: r.task_id ? `https://app.clickup.com/t/${r.task_id}` : null,
        });
      });
    }

    // Order by call date (newest first); null/invalid call dates last,
    // tie-broken by extraction time (created_at) desc.
    flat.sort((a, b) => {
      const ka = callTime(a);
      const kb = callTime(b);
      if (ka !== kb) return kb - ka;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setCards(flat);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { cards, loading, error, refresh };
}
