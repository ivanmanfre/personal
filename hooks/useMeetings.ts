import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { MeetingTranscript, MeetingStats } from '../types/dashboard';

function mapTranscript(row: any): MeetingTranscript {
  return {
    id: row.id,
    firefliesId: row.fireflies_id,
    title: row.title,
    date: row.date,
    durationMinutes: row.duration_minutes || 0,
    participants: row.participants || [],
    transcriptText: row.transcript_text || '',
    summary: row.summary,
    actionItems: row.action_items || [],
    topics: row.topics || [],
    followUpDraft: row.follow_up_draft,
    followUpSent: row.follow_up_sent || false,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    meetingType: row.meeting_type,
    phaseCoverage: row.phase_coverage,
  };
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingTranscript[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('transcripts')
        .select('*')
        .order('date', { ascending: false })
        .limit(200);
      setMeetings((data || []).map(mapTranscript));
    } catch (err) {
      toastError('load meetings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const stats: MeetingStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = meetings.filter((m) => new Date(m.date) >= weekAgo);
    const withActions = meetings.filter((m) => m.actionItems.length > 0);
    const totalDuration = meetings.reduce((s, m) => s + m.durationMinutes, 0);
    return {
      total: meetings.length,
      thisWeek: thisWeek.length,
      withActionItems: withActions.length,
      avgDurationMinutes: meetings.length > 0 ? Math.round(totalDuration / meetings.length) : 0,
    };
  }, [meetings]);

  return { meetings, stats, loading, refresh: fetch };
}
