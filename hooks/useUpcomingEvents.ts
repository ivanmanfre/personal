import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import { resolveMeetingTypeFromTitle } from '../lib/meetingTypes';
import type { CalendarEvent, MeetingType } from '../types/dashboard';

function mapEvent(row: any): CalendarEvent {
  const stored = row.meeting_type as MeetingType | null;
  const resolved = stored || resolveMeetingTypeFromTitle(row.title);
  return {
    id: row.id,
    googleEventId: row.google_event_id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    attendees: row.attendees || [],
    meetingUrl: row.meeting_url,
    platform: row.platform,
    location: row.location,
    description: row.description,
    isAllDay: row.is_all_day || false,
    createdAt: row.created_at,
    meetingType: resolved,
  };
}

export function useUpcomingEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('end_time', now)
        .lte('start_time', weekFromNow)
        .eq('is_all_day', false)
        .order('start_time', { ascending: true })
        .limit(20);
      if (error) throw error;
      setEvents((data || []).map(mapEvent));
    } catch (err) {
      // Table might not exist yet - silently fail
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const todayEvents = useMemo(() => {
    const today = new Date().toDateString();
    return events.filter((e) => new Date(e.startTime).toDateString() === today);
  }, [events]);

  const setMeetingType = useCallback(async (eventId: string, meetingType: MeetingType) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ meeting_type: meetingType })
        .eq('id', eventId);
      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, meetingType } : e)));
    } catch (err) {
      toastError('update meeting type', err);
    }
  }, []);

  return { events, todayEvents, loading, refresh: fetch, setMeetingType };
}
