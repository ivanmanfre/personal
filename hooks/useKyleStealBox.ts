import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reads the safe `kyle_steal_box` view (steal tactics only — no prospect PII).
 * The view is provisioned by migrations/kyle_steal_box_view.sql. If it is missing,
 * `error` is set so the panel can show a provisioning hint instead of crashing.
 */

export interface StealItem {
  tactic: string;
  how_ivan_applies?: string;
  evidence_quote?: string;
}

export interface StealRow {
  id: string;
  call_date: string | null;
  created_at: string;
  signal_score: number | null;
  steal_items: StealItem[];
}

/** One steal tactic, flattened with its source-call recency for sorting/labeling. */
export interface StealCard extends StealItem {
  key: string;
  created_at: string;
  signal_score: number | null;
}

export function useKyleStealBox() {
  const [cards, setCards] = useState<StealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kyle_steal_box')
      .select('id, call_date, created_at, signal_score, steal_items')
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
          created_at: r.created_at,
          signal_score: r.signal_score,
        });
      });
    }
    setCards(flat);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { cards, loading, error, refresh };
}
