import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface CallReport {
  id: string;
  transcriptId: string | null;
  meetingTitle: string;
  meetingDate: string | null;
  outcome: string | null;
  reportHtml: string | null;
  reportJson: any;
  createdAt: string;
}

function mapCallReport(row: any): CallReport {
  return {
    id: row.id,
    transcriptId: row.transcript_id ?? null,
    meetingTitle: row.meeting_title || 'Untitled call',
    meetingDate: row.meeting_date ?? null,
    outcome: row.outcome ?? null,
    reportHtml: row.report_html ?? null,
    reportJson: row.report_json ?? null,
    createdAt: row.created_at,
  };
}

export function useCallReports() {
  const [reports, setReports] = useState<CallReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('call_reports')
        .select('*')
        .order('meeting_date', { ascending: false, nullsFirst: false })
        .limit(200);
      setReports((data || []).map(mapCallReport));
    } catch (err) {
      toastError('load call reports', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { reports, loading, refresh: fetch };
}
