import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { ScheduledJob, ScheduledStatus } from '../types/dashboard';

function mapRow(row: any): ScheduledJob {
  return {
    id: row.id,
    jobKey: row.job_key,
    source: row.source,
    label: row.label,
    description: row.description,
    category: row.category || 'Meta',
    scheduleHuman: row.schedule_human,
    expectedIntervalMinutes: row.expected_interval_minutes,
    graceMinutes: row.grace_minutes,
    timezone: row.timezone,
    enabled: row.enabled,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    errorCount24h: row.error_count_24h || 0,
    successCount24h: row.success_count_24h || 0,
    lastErrorMessage: row.last_error_message,
    lastDurationMs: row.last_duration_ms,
    minutesSinceLastRun: row.minutes_since_last_run,
    status: (row.status || 'UNKNOWN') as ScheduledStatus,
  };
}

export function useScheduledOps() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_ops_status')
        .select('*')
        .order('label');
      if (error) throw error;
      setJobs((data || []).map(mapRow));
    } catch (err) {
      toastError('load scheduled ops', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const stats = useMemo(() => {
    const c = { ok: 0, overdue: 0, erroring: 0, disabled: 0, unknown: 0 };
    for (const j of jobs) {
      if (j.status === 'OK') c.ok++;
      else if (j.status === 'OVERDUE') c.overdue++;
      else if (j.status === 'ERRORING') c.erroring++;
      else if (j.status === 'DISABLED') c.disabled++;
      else c.unknown++;
    }
    return { total: jobs.length, ...c };
  }, [jobs]);

  return { jobs, loading, refresh: fetch, stats };
}
