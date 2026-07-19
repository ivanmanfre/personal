/**
 * useCockpitData — live feeds for the Editorial Cockpit (Direction A).
 *
 * Every count is probed against the app's anon supabase client (same client +
 * RLS as usePulse). A feed that errors or is RLS-blocked renders an honest
 * `offline` state — never a faked number. Born-dead, read-only: nothing here
 * writes or fires.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type FeedState = 'loading' | 'ok' | 'offline';

export interface TriageFeed {
  state: FeedState;
  count: number;
  /** Up to a few real item labels for the lead column. */
  items: string[];
  error?: string;
}

export interface TodayFeeds {
  postsReview: TriageFeed;
  /** Client-owned drafts in review (Rise DTC etc.) — kept OUT of postsReview so
   * the Ivan-queue count matches the Posts board (!clientId). Surfaced as a
   * muted note, never folded into Ivan's actionable count. */
  postsReviewClient: TriageFeed;
  commentDrafts: TriageFeed;
  warmFollowups: TriageFeed;
  workflowsRed: TriageFeed;
  scheduledToday: TriageFeed;
  clientTile: { state: FeedState; rows: number; names: string[]; error?: string };
  loading: boolean;
}

const empty = (): TriageFeed => ({ state: 'loading', count: 0, items: [] });

async function countWithItems(
  table: string,
  filter: (q: any) => any,
  labelCol: string,
  limit = 4,
): Promise<TriageFeed> {
  try {
    const q = filter(
      supabase.from(table).select(labelCol, { count: 'exact' }).limit(limit),
    );
    const { data, count, error } = await q;
    if (error) return { state: 'offline', count: 0, items: [], error: error.message };
    const items = (data ?? [])
      .map((r: Record<string, unknown>) => String(r[labelCol] ?? '').trim())
      .filter(Boolean);
    return { state: 'ok', count: count ?? items.length, items };
  } catch (e) {
    return { state: 'offline', count: 0, items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function useTodayFeeds(): TodayFeeds {
  const [feeds, setFeeds] = useState<TodayFeeds>({
    postsReview: empty(),
    postsReviewClient: empty(),
    commentDrafts: empty(),
    warmFollowups: empty(),
    workflowsRed: empty(),
    scheduledToday: empty(),
    clientTile: { state: 'loading', rows: 0, names: [] },
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    // Local calendar day, not UTC — new Date().toISOString().slice(0,10) reads
    // the UTC date, which drifts a day off local "today" outside UTC+0
    // (see js-toisostring-date-key-trap). Build local midnight boundaries and
    // convert THOSE to ISO for the query range instead.
    const now = new Date();
    const localDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const localDayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    (async () => {
      const [postsReview, postsReviewClient, commentDrafts, warmFollowups, workflowsRed, scheduledToday, client] =
        await Promise.all([
          // Ivan's actionable queue ONLY (client_id IS NULL) — this equals the
          // Posts board REVIEW lane (PostWorkSurface filters !clientId). Client
          // drafts are counted separately below so they surface as a muted note
          // instead of inflating Ivan's number (data-truth LIE #1 fix).
          countWithItems('carousel_drafts', (q) => q.eq('status', 'review').is('client_id', null).order('updated_at', { ascending: false }), 'title'),
          countWithItems('carousel_drafts', (q) => q.eq('status', 'review').not('client_id', 'is', null).order('updated_at', { ascending: false }), 'title'),
          countWithItems('comment_feed', (q) => q.eq('status', 'pending').order('created_at', { ascending: false }), 'target_name'),
          countWithItems('followup_drafts', (q) => q.eq('status', 'pending_approval').order('created_at', { ascending: false }), 'prospect_name'),
          countWithItems('dashboard_workflow_stats', (q) => q.eq('last_execution_status', 'error').order('updated_at', { ascending: false }), 'workflow_name', 6),
          countWithItems('carousel_drafts', (q) => q.eq('status', 'scheduled').gte('scheduled_at', localDayStart).lte('scheduled_at', localDayEnd).order('scheduled_at', { ascending: true }), 'title'),
          (async () => {
            try {
              const { data, count, error } = await supabase
                .from('client_registry')
                .select('*', { count: 'exact' })
                .limit(6);
              if (error) return { state: 'offline' as FeedState, rows: 0, names: [], error: error.message };
              const names = (data ?? [])
                .map((r: any) => String(r.name ?? r.client_name ?? r.slug ?? r.company ?? '').trim())
                .filter(Boolean);
              return { state: 'ok' as FeedState, rows: count ?? names.length, names };
            } catch (e) {
              return { state: 'offline' as FeedState, rows: 0, names: [], error: e instanceof Error ? e.message : String(e) };
            }
          })(),
        ]);

      if (!alive) return;
      setFeeds({
        postsReview,
        postsReviewClient,
        commentDrafts,
        warmFollowups,
        workflowsRed,
        scheduledToday,
        clientTile: client,
        loading: false,
      });
    })();

    return () => { alive = false; };
  }, []);

  return feeds;
}

// ── Warm Pipeline ──────────────────────────────────────────────────────────

export interface FunnelStage {
  key: string;
  label: string;
  count: number | null; // null = offline
}

export interface LatestReply {
  state: FeedState;
  text: string;
  name: string;
  company: string;
  at: string | null;
  error?: string;
}

export interface ApprovalItem {
  id: string;
  prospect: string;
  subject: string;
  preview: string;
}

export interface WarmData {
  loading: boolean;
  stages: FunnelStage[];
  callBooked: number | null;
  reply: LatestReply;
  queue: { state: FeedState; items: ApprovalItem[]; error?: string };
}

async function headCount(table: string, filter: (q: any) => any): Promise<number | null> {
  try {
    const { count, error } = await filter(
      supabase.from(table).select('id', { count: 'exact', head: true }),
    );
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export function useWarmPipeline(): WarmData {
  const [data, setData] = useState<WarmData>({
    loading: true,
    stages: [],
    callBooked: null,
    reply: { state: 'loading', text: '', name: '', company: '', at: null },
    queue: { state: 'loading', items: [] },
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [connSent, connected, dmd, replied, calls] = await Promise.all([
        headCount('outreach_prospects', (q) => q.not('connection_sent_at', 'is', null)),
        headCount('outreach_prospects', (q) => q.not('connected_at', 'is', null)),
        headCount('outreach_prospects', (q) => q.not('last_dm_sent_at', 'is', null)),
        headCount('outreach_prospects', (q) => q.gt('reply_count', 0)),
        headCount('call_reports', (q) => q),
      ]);

      // Latest genuine inbound reply (LinkedIn channel, not a reaction, non-empty,
      // not an auto-reply/optout system tag). Rendered live — never hardcoded.
      let reply: LatestReply = { state: 'offline', text: '', name: '', company: '', at: null };
      try {
        const { data: msgs, error } = await supabase
          .from('outreach_messages')
          .select('message_text, created_at, prospect_id, is_reaction, channel')
          .eq('direction', 'inbound')
          .eq('is_reaction', false)
          .neq('message_text', '')
          .is('channel', null)
          .order('created_at', { ascending: false })
          .limit(12);
        if (error) {
          reply = { state: 'offline', text: '', name: '', company: '', at: null, error: error.message };
        } else {
          const pick = (msgs ?? []).find(
            (m: any) => typeof m.message_text === 'string' && !/^\s*\[/.test(m.message_text),
          );
          if (pick) {
            let name = '';
            let company = '';
            try {
              const { data: pr } = await supabase
                .from('outreach_prospects')
                .select('name, company')
                .eq('id', pick.prospect_id)
                .limit(1);
              if (pr && pr[0]) { name = pr[0].name ?? ''; company = pr[0].company ?? ''; }
            } catch { /* attribution optional */ }
            reply = {
              state: 'ok',
              text: String(pick.message_text).replace(/\s+/g, ' ').trim(),
              name,
              company,
              at: pick.created_at ?? null,
            };
          } else {
            reply = { state: 'ok', text: '', name: '', company: '', at: null };
          }
        }
      } catch (e) {
        reply = { state: 'offline', text: '', name: '', company: '', at: null, error: e instanceof Error ? e.message : String(e) };
      }

      // Approval queue — followup_drafts awaiting approval.
      let queue: WarmData['queue'] = { state: 'offline', items: [] };
      try {
        const { data: rows, error } = await supabase
          .from('followup_drafts')
          .select('id, prospect_name, subject_options, email_body')
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) {
          queue = { state: 'offline', items: [], error: error.message };
        } else {
          const items: ApprovalItem[] = (rows ?? []).map((r: any) => {
            let subject = '';
            const so = r.subject_options;
            if (Array.isArray(so)) subject = String(so[0] ?? '');
            else if (typeof so === 'string') subject = so;
            else if (so && typeof so === 'object') subject = String(Object.values(so)[0] ?? '');
            return {
              id: String(r.id),
              prospect: String(r.prospect_name ?? 'Unknown'),
              subject: subject.trim(),
              preview: String(r.email_body ?? '').replace(/\s+/g, ' ').trim().slice(0, 220),
            };
          });
          queue = { state: 'ok', items };
        }
      } catch (e) {
        queue = { state: 'offline', items: [], error: e instanceof Error ? e.message : String(e) };
      }

      if (!alive) return;
      setData({
        loading: false,
        stages: [
          { key: 'connSent', label: 'Connection sent', count: connSent },
          { key: 'connected', label: 'Connected', count: connected },
          { key: 'dmd', label: "DM'd", count: dmd },
          { key: 'replied', label: 'Replied', count: replied },
        ],
        callBooked: calls,
        reply,
        queue,
      });
    })();
    return () => { alive = false; };
  }, []);

  return data;
}
