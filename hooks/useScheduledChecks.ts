import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';

export type CheckState = 'due' | 'upcoming' | 'scheduled' | 'done';

export interface ScheduledCheck {
  id: string;
  title: string;
  detail: string | null;
  category: string;
  dueDate: string;        // YYYY-MM-DD
  status: string;         // pending | reviewed | dismissed
  link: string | null;
  source: string | null;
  daysUntil: number;
  state: CheckState;
}

function mapRow(r: any): ScheduledCheck {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    category: r.category,
    dueDate: r.due_date,
    status: r.status,
    link: r.link,
    source: r.source,
    daysUntil: r.days_until,
    state: r.state as CheckState,
  };
}

export function useScheduledChecks() {
  const [checks, setChecks] = useState<ScheduledCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_checks_status')
        .select('*')
        .order('due_date');
      if (error) throw error;
      setChecks((data || []).map(mapRow));
    } catch (err) {
      toastError('load scheduled checks', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const markReviewed = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_checks')
        .update({ status: 'reviewed' })
        .eq('id', id);
      if (error) throw error;
      toastSuccess('Check marked reviewed');
      fetch();
    } catch (err) {
      toastError('mark check reviewed', err);
    }
  }, [fetch]);

  const snooze = useCallback(async (id: string, days = 7) => {
    const c = checks.find((x) => x.id === id);
    if (!c) return;
    const base = new Date(`${c.dueDate}T00:00:00`);
    base.setDate(base.getDate() + days);
    const newDue = base.toISOString().slice(0, 10);
    try {
      const { error } = await supabase
        .from('scheduled_checks')
        .update({ due_date: newDue, status: 'pending' })
        .eq('id', id);
      if (error) throw error;
      toastSuccess(`Snoozed ${days}d → ${newDue}`);
      fetch();
    } catch (err) {
      toastError('snooze check', err);
    }
  }, [checks, fetch]);

  const stats = useMemo(() => {
    let due = 0, upcoming = 0, scheduled = 0, done = 0;
    for (const c of checks) {
      if (c.state === 'due') due++;
      else if (c.state === 'upcoming') upcoming++;
      else if (c.state === 'scheduled') scheduled++;
      else done++;
    }
    return { total: checks.length, due, upcoming, scheduled, done };
  }, [checks]);

  return { checks, loading, refresh: fetch, stats, markReviewed, snooze };
}
