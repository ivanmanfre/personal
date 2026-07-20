import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { strengthBand } from '../../../../lib/ideaProjection';
import type { AgentLogEntry } from '../../../../hooks/useContentLibrary';
import type { Severity } from '../../types';

/**
 * Client Ops round-2 — shared plumbing for every cockpit direction.
 *
 * ALL data flows through the round-1 gated SECURITY DEFINER RPCs (operator_*,
 * authenticated-only). Every write path here is the round-1 behavior verbatim:
 * schedule-to-buffer, on-board toggle, approve/pass, cover swap. Directions
 * differ ONLY in the surface they render around this hook.
 *
 * Fabrication law: every aggregate below is computed from the rows the RPCs
 * actually returned. When there is no underlying data the value is null and
 * the surface must render an honest empty state, never a placeholder figure.
 */

export const GATE = 'clientops';
export const PUBLIC_STORAGE = 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public';

export interface Board { slug: string; url: string; token: string; }
export interface ClientOverview {
  client_id: string;
  display_name: string;
  company: string;
  tier: string;
  status: string;
  board: Board;
  lanes: { armed: number; total: number };
  drafts: { review: number; visible: number; total: number };
  spend: { total_usd: number; week_usd: number };
}
export interface Draft {
  id: string;
  title: string;
  status: string;
  qa_score: number | null;
  qa: { verdict?: string; score?: number | string; feedback?: string } | null;
  agent_log: AgentLogEntry[];
  taxonomy: Record<string, any> | null;
  source_post_id: string | null;
  idea_source_label: string | null;
  idea_source_ref: string | null;
  idea_icp_score: number | null;
  idea_agent_log?: AgentLogEntry[];
  board_visible: boolean;
  created_at: string;
  published_at: string | null;
  post_body: string | null;
  type: 'text' | 'single_image' | 'carousel';
  has_media: boolean;
  image_urls?: string[];
  scheduled_at: string | null;
}
export interface ScoreBreakdown {
  icp_fit?: number;
  buyer_signal?: number;
  authority_fit?: number;
  why?: string;
  rubric_version?: string;
}
export interface Idea {
  id: string;
  hook: string;
  title?: string;
  source_label?: string;
  source_ref?: string;
  pillar?: string;
  format?: string;
  created_at?: string;
  icp_score?: number | null;
  score_breakdown?: ScoreBreakdown | null;
  agent_log?: AgentLogEntry[];
}
export interface LmFunnel { views: number; captures: number; completes: number; cta_clicks: number; }
export interface Lm {
  id: string;
  topic: string;
  format: string | null;
  status: string;
  slug: string | null;
  resource_url: string | null;
  landing_url: string | null;
  cover_url: string | null;
  qa: any;
  agent_log: AgentLogEntry[];
  source: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string | null;
  funnel: LmFunnel;
}
export interface ActionRow {
  id: string;
  action: string;
  ref: string | null;
  payload: any;
  created_at: string;
  seen_at: string | null;
  /** Draft title resolved from the ref (carousel_drafts.title); null for non-post events. */
  title: string | null;
  /** Who took the action, when the payload carries it; falls back to a generic label. */
  author: string | null;
}
/** Board-JSON lead-magnet entry carrying a cover variation pair. */
export interface BoardLm { id: string; title: string; cover_url?: string; covers?: string[] }
/** Board-JSON founder identity — drives the client-faithful post preview. */
export interface BoardIdentity {
  founderName: string | null;
  founderHeadline: string | null;
  logoUrl: string | null;
  companyName: string | null;
}
export interface QueueEntry { status?: string | null; publish_date?: string | null; }

export const stripPrefix = (t: string) => (t || '').replace(/^\[[^\]]+\]\s*/, '');
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return (iso || '').slice(0, 10); }
};
export const ageLabel = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const m = ms / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};
export const qaSeverity = (s: number | null): Severity =>
  s == null ? 'neutral' : s >= 75 ? 'good' : s >= 60 ? 'warn' : 'bad';
/** Client-ICP relevance uses Ivan's own idea band law (≥58 High / ≥48 Mid). */
export const icpSeverity = (s: number | null | undefined): Severity => {
  const band = strengthBand(s ?? null);
  return band === 'High' ? 'good' : band === 'Mid' ? 'warn' : band === 'Low' ? 'bad' : 'neutral';
};
export const icpBand = (s: number | null | undefined) => strengthBand(s ?? null);
export const money = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;
export const isUrl = (s?: string | null) => !!s && /^https?:\/\//.test(s);

/** Next open buffer slot: 4 days out, rolled off the weekend (round-1 verbatim). */
export const nextBufferSlot = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

// ── Aggregates — every figure derives from returned rows; null = no data ─────
export interface Aggregates {
  avgQa: number | null;        // mean qa_score over drafts that carry one
  qaN: number;                 // how many drafts back that mean
  avgIcp: number | null;       // mean icp_score over staged ideas that carry one
  icpN: number;
  statusCounts: { review: number; scheduled: number; published: number; disqualified: number; other: number };
  kindCounts: { text: number; image: number; carousel: number };
  onBoard: number;
  bufferDepth: number | null;  // board queue length (null until board JSON loads)
  nextPublish: string | null;  // earliest queue publish_date, if any entry has one
  funnel: LmFunnel;            // summed across client LMs (test-excluded upstream)
  captureRate: number | null;  // captures/views, null when views === 0
  liveLms: number;
  ideasStaged: number;
}
export function computeAggregates(
  drafts: Draft[] | null,
  ideas: Idea[] | null,
  lms: Lm[] | null,
  queue: QueueEntry[] | null,
): Aggregates {
  const ds = drafts || [];
  const is = ideas || [];
  const ls = lms || [];
  const qa = ds.filter((d) => d.qa_score != null);
  const icp = is.filter((i) => i.icp_score != null);
  const statusCounts = { review: 0, scheduled: 0, published: 0, disqualified: 0, other: 0 };
  const kindCounts = { text: 0, image: 0, carousel: 0 };
  ds.forEach((d) => {
    if (d.status in statusCounts) (statusCounts as any)[d.status] += 1; else statusCounts.other += 1;
    if (d.type === 'text') kindCounts.text += 1;
    else if (d.type === 'single_image') kindCounts.image += 1;
    else if (d.type === 'carousel') kindCounts.carousel += 1;
  });
  const funnel = ls.reduce(
    (acc, l) => ({
      views: acc.views + (l.funnel?.views || 0),
      captures: acc.captures + (l.funnel?.captures || 0),
      completes: acc.completes + (l.funnel?.completes || 0),
      cta_clicks: acc.cta_clicks + (l.funnel?.cta_clicks || 0),
    }),
    { views: 0, captures: 0, completes: 0, cta_clicks: 0 },
  );
  const dates = (queue || [])
    .map((q) => q.publish_date)
    .filter((d): d is string => !!d)
    .sort();
  return {
    avgQa: qa.length ? qa.reduce((s, d) => s + (d.qa_score as number), 0) / qa.length : null,
    qaN: qa.length,
    avgIcp: icp.length ? icp.reduce((s, i) => s + (i.icp_score as number), 0) / icp.length : null,
    icpN: icp.length,
    statusCounts,
    kindCounts,
    onBoard: ds.filter((d) => d.board_visible).length,
    bufferDepth: queue ? queue.length : null,
    nextPublish: dates[0] || null,
    funnel,
    captureRate: funnel.views > 0 ? funnel.captures / funnel.views : null,
    liveLms: ls.filter((l) => l.status === 'live').length,
    ideasStaged: is.length,
  };
}

// ── Overview hook ────────────────────────────────────────────────────────────
export function useClientsOverview() {
  const [clients, setClients] = useState<ClientOverview[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.rpc('operator_clients_overview', { p_gate: GATE });
    if (err || (data && data.ok === false)) {
      setError(err?.message || data?.error || 'load failed');
      setClients((prev) => prev ?? []);
      return;
    }
    setClients((data?.clients || []) as ClientOverview[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { clients, error, reload: load };
}

// ── Detail hook: all five loads + round-1 write paths verbatim ───────────────
export function useClientDetail(client: ClientOverview | null) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [actions, setActions] = useState<ActionRow[] | null>(null);
  const [actionsUnseen, setActionsUnseen] = useState<number>(0);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [lms, setLms] = useState<Lm[] | null>(null);
  const [boardLms, setBoardLms] = useState<BoardLm[] | null>(null);
  const [identity, setIdentity] = useState<BoardIdentity | null>(null);
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [errors, setErrors] = useState<{ drafts?: string; actions?: string; ideas?: string; lms?: string }>({});

  const load = useCallback(async () => {
    if (!client) return;
    setErrors({});
    const [dRes, aRes, iRes, lRes, bRes] = await Promise.all([
      supabase.rpc('operator_client_drafts', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('operator_client_actions', { p_gate: GATE, p_slug: client.board.slug }),
      supabase.rpc('operator_client_ideas', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('operator_client_lms', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('get_client_board', { p_slug: client.board.slug, p_token: client.board.token }),
    ]);
    const errs: typeof errors = {};
    if (dRes.error || (dRes.data && dRes.data.ok === false)) { errs.drafts = dRes.error?.message || dRes.data?.error || 'drafts load failed'; setDrafts([]); }
    else setDrafts((dRes.data?.drafts || []) as Draft[]);
    if (aRes.error || (aRes.data && aRes.data.ok === false)) { errs.actions = aRes.error?.message || aRes.data?.error || 'actions load failed'; setActions([]); setActionsUnseen(0); }
    else { setActions((aRes.data?.actions || []) as ActionRow[]); setActionsUnseen(Number(aRes.data?.unseen) || 0); }
    if (iRes.error || (iRes.data && iRes.data.ok === false)) { errs.ideas = iRes.error?.message || iRes.data?.error || 'ideas load failed'; setIdeas([]); }
    else setIdeas((iRes.data?.ideas || []) as Idea[]);
    if (lRes.error || (lRes.data && lRes.data.ok === false)) { errs.lms = lRes.error?.message || lRes.data?.error || 'lead magnets load failed'; setLms([]); }
    else setLms((lRes.data?.lms || []) as Lm[]);
    const board = bRes.data?.board;
    const entries = (board?.lead_magnets || []) as BoardLm[];
    setBoardLms(entries.filter((e) => (Array.isArray(e.covers) && e.covers.length > 0) || e.cover_url));
    setIdentity({
      founderName: board?.founder?.name || null,
      founderHeadline: board?.founder?.headline || null,
      logoUrl: board?.logo_url || board?.brand?.logo_dark || null,
      companyName: board?.company_name || client.company || null,
    });
    setQueue(Array.isArray(board?.queue) ? (board.queue as QueueEntry[]) : null);
    setErrors(errs);
  }, [client?.client_id, client?.board.slug, client?.board.token]);

  useEffect(() => { load(); }, [load]);

  const onToggle = useCallback(async (d: Draft, next: boolean) => {
    setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: next } : x)) ?? prev);
    const res = await supabase.rpc('operator_set_board_visible', { p_gate: GATE, p_draft_id: d.id, p_visible: next });
    if (res.error || (res.data && res.data.ok === false)) {
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: !next } : x)) ?? prev);
      setErrors((e) => ({ ...e, drafts: res.error?.message || res.data?.error || 'toggle failed' }));
      return false;
    }
    return true;
  }, []);

  const onSchedule = useCallback(async (d: Draft): Promise<{ ok: boolean; error?: string }> => {
    const res = await supabase.rpc('operator_schedule_draft', { p_gate: GATE, p_draft_id: d.id, p_publish_at: nextBufferSlot() });
    if (res.data?.ok) {
      const scheduledAt = res.data.scheduled_at as string | undefined;
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, status: 'scheduled', scheduled_at: scheduledAt ?? x.scheduled_at } : x)) ?? prev);
      return { ok: true };
    }
    const err: string | undefined = res.error?.message || res.data?.error;
    if (err !== 'awaiting_media') setErrors((e) => ({ ...e, drafts: err || 'schedule failed' }));
    return { ok: false, error: err };
  }, []);

  const onDecideIdea = useCallback(async (idea: Idea, decision: 'approved' | 'rejected') => {
    setIdeas((prev) => prev?.filter((x) => x.id !== idea.id) ?? prev);
    const res = await supabase.rpc('operator_approve_idea', { p_gate: GATE, p_idea_id: idea.id, p_decision: decision });
    if (res.error || (res.data && res.data.ok === false)) {
      setErrors((e) => ({ ...e, ideas: res.error?.message || res.data?.error || 'decision failed' }));
      setIdeas((prev) => (prev && !prev.some((x) => x.id === idea.id)) ? [idea, ...prev] : prev);
      return false;
    }
    return true;
  }, []);

  const onEditBody = useCallback(async (d: Draft, body: string) => {
    const prevBody = d.post_body;
    setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, post_body: body } : x)) ?? prev);
    const res = await supabase.rpc('operator_edit_draft_body', { p_gate: GATE, p_draft_id: d.id, p_body: body });
    if (res.error || (res.data && res.data.ok === false)) {
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, post_body: prevBody } : x)) ?? prev);
      setErrors((e) => ({ ...e, drafts: res.error?.message || res.data?.error || 'edit failed' }));
      return false;
    }
    return true;
  }, []);

  const onSwapCover = useCallback(async (lmId: string, url: string) => {
    if (!client) return;
    setBoardLms((prev) => prev?.map((x) => (x.id === lmId ? { ...x, cover_url: url } : x)) ?? prev);
    const res = await supabase.rpc('operator_set_lm_cover', { p_gate: GATE, p_slug: client.board.slug, p_lm_id: lmId, p_cover_url: url });
    if (res.error || (res.data && res.data.ok === false)) {
      setErrors((e) => ({ ...e, lms: res.error?.message || res.data?.error || 'cover swap failed' }));
      load();
    }
  }, [client?.board.slug, load]);

  // Mark every unseen client action for this board as read (per-row seen_at stamp —
  // reuses the client_board_actions.seen_at column the WhatsApp notifier already keys
  // off, so there is no second source of truth). Optimistic: zero the badge, then persist.
  const onMarkActionsSeen = useCallback(async () => {
    if (!client) return;
    if (actionsUnseen === 0) return;
    const stamp = new Date().toISOString();
    setActionsUnseen(0);
    setActions((prev) => prev?.map((a) => (a.seen_at ? a : { ...a, seen_at: stamp })) ?? prev);
    const res = await supabase.rpc('operator_mark_actions_seen', { p_gate: GATE, p_slug: client.board.slug });
    if (res.error || (res.data && res.data.ok === false)) {
      setErrors((e) => ({ ...e, actions: res.error?.message || res.data?.error || 'mark seen failed' }));
      load();
    }
  }, [client?.board.slug, actionsUnseen, load]);

  const aggregates = useMemo(
    () => computeAggregates(drafts, ideas, lms, queue),
    [drafts, ideas, lms, queue],
  );

  return { drafts, actions, actionsUnseen, ideas, lms, boardLms, identity, queue, errors, aggregates, reload: load, onToggle, onSchedule, onDecideIdea, onSwapCover, onEditBody, onMarkActionsSeen };
}

// ── Client-faithful LinkedIn preview ─────────────────────────────────────────
// The Posts-board LinkedInPost hardcodes Ivan's identity; a client draft ships
// on the CLIENT founder's LinkedIn, so the preview must read as theirs. No
// founder photo exists yet (client-photos bucket empty) → honest initial
// avatar, never a stock face.
const LI_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const ClientPost: React.FC<{
  text: string;
  identity: BoardIdentity | null;
  image?: string | null;
}> = ({ text, identity, image }) => {
  const name = identity?.founderName || identity?.companyName || 'Client';
  const headline = identity?.founderHeadline || identity?.companyName || '';
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ fontFamily: LI_SANS, backgroundColor: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.10)', boxShadow: '0 2px 10px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 48, height: 48, borderRadius: '9999px', background: '#131210', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600, flexShrink: 0, letterSpacing: '0.02em' }}>{initials}</span>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.9)' }}>
              {name} <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.55)' }}>· 1st</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{headline}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>now · 🌐</div>
          </div>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(0,0,0,0.9)', margin: '14px 0 16px', whiteSpace: 'pre-wrap' }}>
          {text || <span style={{ color: 'rgba(0,0,0,0.4)' }}>(no body yet)</span>}
        </p>
      </div>
      {image && (
        <div style={{ width: '100%', backgroundColor: '#f3f2ef', overflow: 'hidden' }}>
          <img src={image} alt="" loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '8px 16px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>
          <span>Like</span><span>Comment</span><span>Repost</span><span>Send</span>
        </div>
      </div>
    </div>
  );
};
