import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ScanListRow {
  id: string;
  company_slug: string;
  domain: string;
  email: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  source: 'inbound' | 'outreach' | string;
  created_at: string;
  completed_at: string | null;
  company_name: string | null;
  automation_score: number | null;
  automation_grade: string | null;
  top_gap_title: string | null;
}

const COLUMNS = [
  'id', 'company_slug', 'domain', 'email', 'status', 'source',
  'created_at', 'completed_at', 'company_name',
  'automation_score', 'automation_grade', 'top_gap_title',
].join(', ');

const LIMIT = 30;
const IVAN_EMAIL = 'ivan.manfredi2001@gmail.com';

function isIvanEmail(email: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower === IVAN_EMAIL || lower.endsWith('@ivanmanfredi.com');
}

export function useScansList() {
  const [rows, setRows] = useState<ScanListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('scans')
      .select(COLUMNS)
      .neq('email', IVAN_EMAIL)
      .not('email', 'ilike', '%@ivanmanfredi.com')
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as unknown as ScanListRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('scans-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scans' },
        (payload) => {
          const row = payload.new as ScanListRow;
          if (isIvanEmail(row.email)) return;
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)].slice(0, LIMIT));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scans' },
        (payload) => {
          const row = payload.new as ScanListRow;
          if (isIvanEmail(row.email)) return;
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  return { rows, loading, error, refresh };
}
