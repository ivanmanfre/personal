import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useRiseDtcHome — live data for the single real paying client (Rise DTC,
 * client_id='risedtc', Mattan). READ-ONLY. No mutations.
 *
 * Every read is scoped to client_id='risedtc' so nothing here can ever touch
 * Ivan's own feed. Sources (anon-readable, live-probed 2026-07-18):
 *   - carousel_drafts  (13 rows: review 12, disqualified 1)
 *   - lm_drafts_v2      (1 row: review 1)
 *   - calendar_events   (next Mattan call: 2026-07-20)
 * client_registry is NOT anon-readable (returns 0 rows) — surfaced as an honest
 * gated note rather than faked.
 */

const CLIENT_ID = 'risedtc';

export interface StatusCount {
  status: string;
  count: number;
}

export interface DraftRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string | null;
}

export interface LmRow {
  id: string;
  topic: string;
  status: string;
  format: string | null;
  updatedAt: string | null;
}

export interface NextCall {
  title: string;
  startTime: string;
  meetingUrl: string | null;
  attendees: string[];
}

export interface RiseDtcHomeData {
  loading: boolean;
  // Content queue
  contentBlocked: boolean;
  contentTotal: number;
  contentByStatus: StatusCount[];
  contentRecent: DraftRow[];
  // Lead magnets
  lmBlocked: boolean;
  lmTotal: number;
  lmByStatus: StatusCount[];
  lmItems: LmRow[];
  // Next call
  callBlocked: boolean;
  nextCall: NextCall | null;
  // Registry (anon RLS gated)
  registryVisible: boolean;
  refresh: () => void;
}

// Actionable statuses float to the top of any status breakdown.
const STATUS_ORDER = ['review', 'generating', 'scheduled', 'published', 'disqualified'];
function orderStatuses(counts: StatusCount[]): StatusCount[] {
  return [...counts].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function tally(rows: { status: string | null }[]): StatusCount[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const s = r.status || 'unknown';
    map.set(s, (map.get(s) || 0) + 1);
  }
  return orderStatuses(Array.from(map, ([status, count]) => ({ status, count })));
}

export function useRiseDtcHome(): RiseDtcHomeData {
  const [state, setState] = useState<Omit<RiseDtcHomeData, 'refresh'>>({
    loading: true,
    contentBlocked: false,
    contentTotal: 0,
    contentByStatus: [],
    contentRecent: [],
    lmBlocked: false,
    lmTotal: 0,
    lmByStatus: [],
    lmItems: [],
    callBlocked: false,
    nextCall: null,
    registryVisible: false,
  });

  const fetchAll = useCallback(async () => {
    const nowIso = new Date().toISOString();

    const [draftsRes, lmRes, callRes, registryRes] = await Promise.all([
      supabase
        .from('carousel_drafts')
        .select('id, title, status, updated_at')
        .eq('client_id', CLIENT_ID)
        .order('updated_at', { ascending: false }),
      supabase
        .from('lm_drafts_v2')
        .select('id, topic, status, format, updated_at')
        .eq('client_id', CLIENT_ID)
        .order('updated_at', { ascending: false }),
      supabase
        .from('calendar_events')
        .select('title, start_time, meeting_url, attendees')
        .or('title.ilike.*mattan*,title.ilike.*rise dtc*')
        .gte('start_time', nowIso)
        .order('start_time', { ascending: true })
        .limit(1),
      // client_registry is expected to be anon-RLS gated (0 rows). We probe it
      // only to decide whether to show the "gated" note — never to fake a row.
      supabase
        .from('client_registry')
        .select('client_id, display_name')
        .eq('client_id', CLIENT_ID)
        .limit(1),
    ]);

    const draftRows = (draftsRes.data ?? []) as any[];
    const contentRecent: DraftRow[] = draftRows.slice(0, 8).map((r) => ({
      id: r.id,
      title: (r.title || '').replace(/^\[RISE DTC\]\s*/i, ''),
      status: r.status || 'unknown',
      updatedAt: r.updated_at ?? null,
    }));

    const lmRows = (lmRes.data ?? []) as any[];
    const lmItems: LmRow[] = lmRows.map((r) => ({
      id: r.id,
      topic: r.topic || '(untitled)',
      status: r.status || 'unknown',
      format: r.format ?? null,
      updatedAt: r.updated_at ?? null,
    }));

    const callRow = (callRes.data ?? [])[0] as any | undefined;
    const nextCall: NextCall | null = callRow
      ? {
          title: callRow.title,
          startTime: callRow.start_time,
          meetingUrl: callRow.meeting_url ?? null,
          attendees: Array.isArray(callRow.attendees) ? callRow.attendees : [],
        }
      : null;

    setState({
      loading: false,
      contentBlocked: !!draftsRes.error,
      contentTotal: draftRows.length,
      contentByStatus: tally(draftRows),
      contentRecent,
      lmBlocked: !!lmRes.error,
      lmTotal: lmRows.length,
      lmByStatus: tally(lmRows),
      lmItems,
      callBlocked: !!callRes.error,
      nextCall,
      registryVisible: !registryRes.error && (registryRes.data?.length ?? 0) > 0,
    });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { ...state, refresh: fetchAll };
}
