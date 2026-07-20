import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { HeadRow, KpiRow, KpiTile, StatusChip, Card } from '../primitives';
import type { Severity } from '../types';
import QAVerdictPanel from '../../dashboard/QAVerdictPanel';
import AgentLogFeed from '../../dashboard/AgentLogFeed';
import { strengthBand } from '../../../lib/ideaProjection';
import type { AgentLogEntry } from '../../../hooks/useContentLibrary';

/**
 * Client Ops — operator-only review surface (Ivan's dashboard).
 * Manifest-driven (client_registry rows with non-null platform). The client
 * board itself stays a pure client surface; every machine internal (QA scores,
 * spend, board-visibility toggle, action feed) lives HERE, behind the operator
 * gate. Positioning law: the client only ever sees filtered, reviewed output.
 *
 * All data flows through gated SECURITY DEFINER RPCs (operator_*). The gate is a
 * dedicated operator secret held only in localStorage + hashed server-side — it
 * is NOT the public dashboard hash, so nothing here is reachable from the bundle.
 *
 * Parity depth (sources, ICP scores, agent logs, comments, LM lane) lives on
 * THIS surface only — the public client board deliberately shows none of it.
 */

// Operator surface, no password: the RPCs carry a fixed plumbing token (they run
// on Ivan's own dashboard). Real protection for the board token + spend rides on
// the authed session (operator_* RPCs are authenticated-only since the RLS fold).
const GATE = 'clientops';
const PUBLIC_STORAGE = 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public';

interface Board { slug: string; url: string; token: string; }
interface ClientOverview {
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
interface Draft {
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
  board_visible: boolean;
  created_at: string;
  published_at: string | null;
  post_body: string | null;
  type: 'text' | 'single_image' | 'carousel';
  has_media: boolean;
  image_urls?: string[];
  scheduled_at: string | null;
}
interface ActionRow {
  id: string;
  action: string;
  ref: string | null;
  payload: any;
  created_at: string;
}
interface ScoreBreakdown {
  icp_fit?: number;
  buyer_signal?: number;
  authority_fit?: number;
  why?: string;
  rubric_version?: string;
}
interface Idea {
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
interface LmFunnel { views: number; captures: number; completes: number; cta_clicks: number; }
interface Lm {
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

const stripPrefix = (t: string) => (t || '').replace(/^\[[^\]]+\]\s*/, '');
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso?.slice(0, 10) || ''; }
};
// Three distinct tiers so weak edit-or-kill drafts pop red (goes beyond the
// literal neutral/warn spec on purpose — the operator scans for <60s).
const qaSeverity = (s: number | null): Severity =>
  s == null ? 'neutral' : s >= 75 ? 'good' : s >= 60 ? 'warn' : 'bad';
// Client-ICP relevance uses Ivan's own idea band law (strengthBand ≥58 High / ≥48 Mid)
// so both systems read identically at a glance.
const icpSeverity = (s: number | null | undefined): Severity => {
  const band = strengthBand(s ?? null);
  return band === 'High' ? 'good' : band === 'Mid' ? 'warn' : band === 'Low' ? 'bad' : 'neutral';
};
const money = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;
const isUrl = (s?: string | null) => !!s && /^https?:\/\//.test(s);

// Next open buffer slot: 4 days out, rolled forward off the weekend (Ivan
// posts weekdays only). Reads the clock only inside the call, never at
// module scope, so this stays pure/deterministic per-invocation.
const nextBufferSlot = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

// Muted pill — same look as StatusPill's default (lowercase, bordered,
// dim text). Reused for the idea pillar tag and the asset-guard state.
function MutedPill({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, color: 'var(--d-paper-dim)', border: '1px solid var(--d-rule-strong)',
      borderRadius: 999, padding: '2px 8px', textTransform: 'lowercase', letterSpacing: '.02em',
    }}>{label}</span>
  );
}

// One-line provenance: honest label + outbound link when the ref is a URL.
function SourceLine({ label, refStr }: { label?: string | null; refStr?: string | null }) {
  if (!label && !refStr) return null;
  return (
    <span style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>
      {label || 'Source'}
      {isUrl(refStr) && (
        <>{' '}<a href={refStr!} target="_blank" rel="noreferrer" style={{ color: 'var(--d-good)' }}>source ↗</a></>
      )}
    </span>
  );
}

const Loading = ({ what }: { what: string }) => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading {what}…</div>
);
const ErrLine = ({ msg }: { msg: string }) => (
  <div style={{ color: 'var(--d-bad-txt)', fontSize: 12, margin: '4px 0 10px' }}>{msg}</div>
);

// review status is the common case → render it as a muted pill, not an amber
// warn chip (StatusChip collapses 'neutral' to warn). Colored chips are reserved
// for disqualified (warn) / published (good) so the eye only catches exceptions.
function StatusPill({ status }: { status: string }) {
  if (status === 'disqualified') return <StatusChip label={status} severity="warn" />;
  if (status === 'published' || status === 'scheduled' || status === 'live') return <StatusChip label={status} severity="good" />;
  return (
    <span style={{
      fontSize: 11, color: 'var(--d-paper-dim)', border: '1px solid var(--d-rule-strong)',
      borderRadius: 999, padding: '2px 8px', textTransform: 'lowercase', letterSpacing: '.02em',
    }}>{status}</span>
  );
}

// ---- draft row --------------------------------------------------------------
function DraftRow({ d, onToggle, onSchedule, onChanged }: {
  d: Draft;
  onToggle: (d: Draft, next: boolean) => Promise<void>;
  onSchedule: (d: Draft) => Promise<{ ok: boolean; error?: string }>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedNote, setSchedNote] = useState('');
  const canToggle = d.status === 'review';
  const canSchedule = d.status === 'review' && d.has_media !== false;

  const handleSchedule = async () => {
    if (schedBusy) return;
    setSchedBusy(true);
    setSchedNote('');
    try {
      const res = await onSchedule(d);
      if (!res.ok && res.error === 'awaiting_media') setSchedNote('waiting on image');
    } finally {
      setSchedBusy(false);
    }
  };

  const pipelineSource = d.taxonomy?.source as string | undefined;
  const sourceLabel = d.idea_source_label
    || (pipelineSource === 'client-risedtc' ? 'Client pipeline' : pipelineSource)
    || null;

  return (
    <div style={{ borderBottom: '1px solid var(--d-rule)', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
          style={{
            background: 'none', border: 'none', color: 'var(--d-paper-dim)', cursor: 'pointer',
            fontSize: 12, width: 16, flexShrink: 0,
          }}
        >
          {open ? '▾' : '▸'}
        </button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--d-paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stripPrefix(d.title)}
        </span>
        {d.type !== 'text' && <MutedPill label={d.type.replace('_', ' ')} />}
        <StatusPill status={d.status} />
        {d.qa_score != null && <StatusChip label={`QA ${d.qa_score}`} severity={qaSeverity(d.qa_score)} />}
        {d.idea_icp_score != null && <StatusChip label={`ICP ${Math.round(d.idea_icp_score)}`} severity={icpSeverity(d.idea_icp_score)} />}
        {d.status === 'scheduled' && d.scheduled_at && (
          <StatusChip label={`Scheduled · ${fmtDate(d.scheduled_at)}`} severity="good" />
        )}
        <span style={{ fontSize: 12, color: 'var(--d-paper-dim)', width: 52, textAlign: 'right', flexShrink: 0 }}>
          {fmtDate(d.created_at)}
        </span>
        {d.status === 'review' && (
          canSchedule ? (
            <button
              className="dv-btn dv-btn--good"
              disabled={schedBusy}
              onClick={handleSchedule}
              style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
            >
              {schedBusy ? 'Scheduling…' : 'Schedule to buffer'}
            </button>
          ) : (
            <MutedPill label="waiting on image" />
          )
        )}
        <label
          title={canToggle ? 'Show on the client board' : 'Only review drafts can be shown'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: 96, justifyContent: 'flex-end', flexShrink: 0, opacity: canToggle ? 1 : 0.4 }}
        >
          <span style={{ fontSize: 11, color: 'var(--d-paper-dim)' }}>On board</span>
          <button
            role="switch"
            aria-checked={d.board_visible}
            aria-label="On board"
            disabled={!canToggle || busy}
            className={`dv-switch ${d.board_visible ? 'dv-switch--on' : ''}`}
            onClick={async () => {
              if (!canToggle || busy) return;
              setBusy(true);
              try { await onToggle(d, !d.board_visible); } finally { setBusy(false); }
            }}
          />
        </label>
      </div>
      {/* Always-visible provenance line — every draft says where it came from */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 0 26px' }}>
        <SourceLine
          label={sourceLabel || 'Source unknown (pre-pipeline draft)'}
          refStr={d.idea_source_ref || (isUrl(d.source_post_id) ? d.source_post_id : null)}
        />
      </div>
      {schedNote && (
        <div style={{ fontSize: 11, color: 'var(--d-warn, var(--d-paper-dim))', padding: '4px 0 0 26px' }}>{schedNote}</div>
      )}
      {open && (
        <div style={{ padding: '10px 0 4px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: 'var(--d-paper-2, var(--d-paper))' }}>
            {d.post_body || <span style={{ color: 'var(--d-paper-dim)' }}>No body.</span>}
          </div>
          {(d.image_urls?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.image_urls!.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt={`asset ${i + 1}`} style={{ height: 72, borderRadius: 6, border: '1px solid var(--d-rule)' }} />
                </a>
              ))}
            </div>
          )}
          <QAVerdictPanel entries={d.agent_log || []} />
          <AgentLogFeed
            entries={d.agent_log || []}
            table="carousel_drafts"
            rowId={d.id}
            onNoteAdded={onChanged}
          />
        </div>
      )}
    </div>
  );
}

// ---- idea row ----------------------------------------------------------------
function IdeaRow({ idea, onDecide, onChanged }: {
  idea: Idea;
  onDecide: (idea: Idea, decision: 'approved' | 'rejected') => Promise<void>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [open, setOpen] = useState(false);
  const b = idea.score_breakdown;

  const decide = async (decision: 'approved' | 'rejected') => {
    if (busy) return;
    setBusy(decision);
    try { await onDecide(idea, decision); } finally { setBusy(null); }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--d-rule)', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse idea' : 'Expand idea'}
          style={{
            background: 'none', border: 'none', color: 'var(--d-paper-dim)', cursor: 'pointer',
            fontSize: 12, width: 16, flexShrink: 0, paddingTop: 2,
          }}
        >
          {open ? '▾' : '▸'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--d-paper)' }}>{idea.hook}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <SourceLine label={idea.source_label} refStr={idea.source_ref} />
            {idea.pillar && <MutedPill label={idea.pillar} />}
          </div>
        </div>
        {idea.icp_score != null && (
          <StatusChip label={`ICP ${Math.round(idea.icp_score)}`} severity={icpSeverity(idea.icp_score)} />
        )}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            className="dv-btn dv-btn--good"
            disabled={busy !== null}
            onClick={() => decide('approved')}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {busy === 'approved' ? 'Approving…' : 'Approve → generate'}
          </button>
          <button
            className="dv-btn dv-btn--dim"
            disabled={busy !== null}
            onClick={() => decide('rejected')}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {busy === 'rejected' ? 'Passing…' : 'Pass'}
          </button>
        </div>
      </div>
      {open && (
        <div style={{ padding: '10px 0 4px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {idea.title && idea.title !== idea.hook && (
            <div style={{ fontSize: 13, color: 'var(--d-paper-2, var(--d-paper))' }}>{idea.title}</div>
          )}
          {b ? (
            <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', lineHeight: 1.6 }}>
              ICP fit {b.icp_fit ?? '—'}/40 · Buyer signal {b.buyer_signal ?? '—'}/30 · Authority {b.authority_fit ?? '—'}/30
              {b.why && <div style={{ marginTop: 2, color: 'var(--d-paper-2, var(--d-paper))' }}>{b.why}</div>}
              {b.rubric_version && (
                <div style={{ marginTop: 2, fontSize: 11 }}>rubric: {b.rubric_version} (provisional — pending Mattan's criteria)</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>Not scored yet.</div>
          )}
          <AgentLogFeed
            entries={idea.agent_log || []}
            table="client_ideas"
            rowId={idea.id}
            onNoteAdded={onChanged}
          />
        </div>
      )}
    </div>
  );
}

// ---- lead magnet row --------------------------------------------------------
function LmRow({ lm, onChanged }: { lm: Lm; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const f = lm.funnel || { views: 0, captures: 0, completes: 0, cta_clicks: 0 };
  return (
    <div style={{ borderBottom: '1px solid var(--d-rule)', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
          style={{
            background: 'none', border: 'none', color: 'var(--d-paper-dim)', cursor: 'pointer',
            fontSize: 12, width: 16, flexShrink: 0,
          }}
        >
          {open ? '▾' : '▸'}
        </button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--d-paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stripPrefix(lm.topic)}
        </span>
        {lm.format && <MutedPill label={lm.format.replace('_', ' ')} />}
        <StatusPill status={lm.status} />
        <span style={{ fontSize: 12, color: 'var(--d-paper-dim)', flexShrink: 0 }}>
          {f.views} views · {f.captures} captures
        </span>
        {lm.resource_url && (
          <a href={lm.resource_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--d-good)', flexShrink: 0 }}>
            open ↗
          </a>
        )}
      </div>
      <div style={{ padding: '4px 0 0 26px' }}>
        <SourceLine label={lm.source === 'client-risedtc' ? 'Client pipeline' : lm.source} refStr={lm.source_ref} />
      </div>
      {open && (
        <div style={{ padding: '10px 0 4px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', lineHeight: 1.6 }}>
            Funnel (real traffic): {f.views} views · {f.captures} captures · {f.completes} completes · {f.cta_clicks} CTA clicks
            {lm.landing_url && (
              <>{' · '}<a href={lm.landing_url} target="_blank" rel="noreferrer" style={{ color: 'var(--d-good)' }}>landing ↗</a></>
            )}
          </div>
          <QAVerdictPanel entries={lm.agent_log || []} />
          <AgentLogFeed
            entries={lm.agent_log || []}
            table="lm_drafts_v2"
            rowId={lm.id}
            onNoteAdded={onChanged}
          />
        </div>
      )}
    </div>
  );
}

// ---- action feed row --------------------------------------------------------
function ActionFeedRow({ a }: { a: ActionRow }) {
  const p = a.payload || {};
  const isVoice = p.event === 'voice_note' || a.action === 'voice_note';
  const audioUrl = isVoice && p.path ? `${PUBLIC_STORAGE}/${p.path}` : null;
  const summary = isVoice
    ? `voice note${p.duration_s ? ` · ${Math.round(p.duration_s)}s` : ''}`
    : (p.event || p.text || a.ref || JSON.stringify(p).slice(0, 80));
  return (
    <div className="dv-row">
      <span className="dv-row-bullet" />
      <span className="dv-row-name">{a.action}</span>
      <span className="dv-row-meta" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
      {audioUrl && (
        <a href={audioUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--d-good)' }}>play</a>
      )}
      <span className="dv-row-date">{fmtDate(a.created_at)}</span>
    </div>
  );
}

// ---- client detail ----------------------------------------------------------
function ClientDetail({ client, onBack }: {
  client: ClientOverview; onBack: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [actions, setActions] = useState<ActionRow[] | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [lms, setLms] = useState<Lm[] | null>(null);
  const [draftsErr, setDraftsErr] = useState('');
  const [actionsErr, setActionsErr] = useState('');
  const [ideasErr, setIdeasErr] = useState('');
  const [lmsErr, setLmsErr] = useState('');

  const loadDetail = useCallback(async () => {
    setDraftsErr(''); setActionsErr(''); setIdeasErr(''); setLmsErr('');
    const [dRes, aRes, iRes, lRes] = await Promise.all([
      supabase.rpc('operator_client_drafts', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('operator_client_actions', { p_gate: GATE, p_slug: client.board.slug }),
      supabase.rpc('operator_client_ideas', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('operator_client_lms', { p_gate: GATE, p_client_id: client.client_id }),
    ]);
    if (dRes.error || (dRes.data && dRes.data.ok === false)) {
      setDraftsErr(dRes.error?.message || dRes.data?.error || 'drafts load failed');
      setDrafts([]);
    } else {
      setDrafts((dRes.data?.drafts || []) as Draft[]);
    }
    if (aRes.error || (aRes.data && aRes.data.ok === false)) {
      setActionsErr(aRes.error?.message || aRes.data?.error || 'actions load failed');
      setActions([]);
    } else {
      setActions((aRes.data?.actions || []) as ActionRow[]);
    }
    if (iRes.error || (iRes.data && iRes.data.ok === false)) {
      setIdeasErr(iRes.error?.message || iRes.data?.error || 'ideas load failed');
      setIdeas([]);
    } else {
      setIdeas((iRes.data?.ideas || []) as Idea[]);
    }
    if (lRes.error || (lRes.data && lRes.data.ok === false)) {
      setLmsErr(lRes.error?.message || lRes.data?.error || 'lead magnets load failed');
      setLms([]);
    } else {
      setLms((lRes.data?.lms || []) as Lm[]);
    }
  }, [client.client_id, client.board.slug]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const onToggle = useCallback(async (d: Draft, next: boolean) => {
    // optimistic
    setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: next } : x)) ?? prev);
    const res = await supabase.rpc('operator_set_board_visible', {
      p_gate: GATE, p_draft_id: d.id, p_visible: next,
    });
    if (res.error || (res.data && res.data.ok === false)) {
      // revert to the exact prior value
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: !next } : x)) ?? prev);
      setDraftsErr(res.error?.message || res.data?.error || 'toggle failed');
    }
  }, []);

  const onSchedule = useCallback(async (d: Draft): Promise<{ ok: boolean; error?: string }> => {
    const res = await supabase.rpc('operator_schedule_draft', {
      p_gate: GATE, p_draft_id: d.id, p_publish_at: nextBufferSlot(),
    });
    if (res.data?.ok) {
      const scheduledAt = res.data.scheduled_at as string | undefined;
      setDrafts((prev) => prev?.map((x) => (
        x.id === d.id ? { ...x, status: 'scheduled', scheduled_at: scheduledAt ?? x.scheduled_at } : x
      )) ?? prev);
      return { ok: true };
    }
    const err: string | undefined = res.error?.message || res.data?.error;
    if (err !== 'awaiting_media') setDraftsErr(err || 'schedule failed');
    return { ok: false, error: err };
  }, []);

  const onDecideIdea = useCallback(async (idea: Idea, decision: 'approved' | 'rejected') => {
    setIdeas((prev) => prev?.filter((x) => x.id !== idea.id) ?? prev);
    const res = await supabase.rpc('operator_approve_idea', {
      p_gate: GATE, p_idea_id: idea.id, p_decision: decision,
    });
    if (res.error || (res.data && res.data.ok === false)) {
      setIdeasErr(res.error?.message || res.data?.error || 'decision failed');
      // restore on failure (idea may already be gone from the list elsewhere)
      setIdeas((prev) => (prev && !prev.some((x) => x.id === idea.id)) ? [idea, ...prev] : prev);
    }
  }, []);

  const boardLink = client.board?.url ? `${client.board.url}?k=${client.board.token ?? ''}` : undefined;

  const draftKinds = drafts
    ? {
        text: drafts.filter((d) => d.type === 'text').length,
        image: drafts.filter((d) => d.type === 'single_image').length,
        carousel: drafts.filter((d) => d.type === 'carousel').length,
      }
    : null;

  return (
    <>
      <button onClick={onBack} className="dv-btn-ghost" style={{ padding: '6px 12px', borderRadius: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 }}>
        ← All clients
      </button>
      <HeadRow
        title={client.company}
        chip={{ label: client.status, severity: client.status === 'live' ? 'good' : 'warn' }}
        meta={<>{client.tier}<br />{client.drafts.review} in review · {client.drafts.visible} on board</>}
      />
      <KpiRow>
        <KpiTile label="In review" value={client.drafts.review} />
        <KpiTile label="On board" value={client.drafts.visible} severity="good" />
        <KpiTile label="Lanes armed" value={`${client.lanes.armed}/${client.lanes.total}`} />
        <KpiTile label="Spend (total)" value={money(client.spend?.total_usd)} />
      </KpiRow>
      <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', margin: '6px 2px 18px' }}>
        {money(client.spend?.week_usd)} this week · Max-plan runs log $0
        {boardLink && <>{' · '}<a href={boardLink} target="_blank" rel="noreferrer" style={{ color: 'var(--d-good)' }}>view board as client ↗</a></>}
      </div>

      <Card label={`IDEAS — ${ideas?.length ?? '…'} staged, ranked by client-ICP fit — approve to generate, or pass`}>
        {ideasErr && <ErrLine msg={ideasErr} />}
        {ideas == null ? <Loading what="ideas" /> :
          ideas.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No staged ideas.</div> :
          ideas.map((idea) => <IdeaRow key={idea.id} idea={idea} onDecide={onDecideIdea} onChanged={loadDetail} />)}
      </Card>

      <div style={{ height: 18 }} />

      <Card label={`DRAFTS — ${drafts?.length ?? '…'}${draftKinds ? ` (${draftKinds.text} text · ${draftKinds.image} image · ${draftKinds.carousel} carousel)` : ''} — flip a review draft on to show it on the client board`}>
        {draftsErr && <ErrLine msg={draftsErr} />}
        {drafts == null ? <Loading what="drafts" /> :
          drafts.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No drafts.</div> :
          drafts.map((d) => <DraftRow key={d.id} d={d} onToggle={onToggle} onSchedule={onSchedule} onChanged={loadDetail} />)}
      </Card>

      <div style={{ height: 18 }} />

      <Card label={`LEAD MAGNETS — ${lms?.length ?? '…'} in the client funnel`}>
        {lmsErr && <ErrLine msg={lmsErr} />}
        {lms == null ? <Loading what="lead magnets" /> :
          lms.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No lead magnets yet.</div> :
          lms.map((lm) => <LmRow key={lm.id} lm={lm} onChanged={loadDetail} />)}
      </Card>

      <div style={{ height: 18 }} />

      <Card label="CLIENT ACTIONS — last 20 taps, edits, voice notes">
        {actionsErr && <ErrLine msg={actionsErr} />}
        {actions == null ? <Loading what="actions" /> :
          actions.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No client activity yet.</div> :
          <div className="dv-row-list">{actions.map((a) => <ActionFeedRow key={a.id} a={a} />)}</div>}
      </Card>
    </>
  );
}

// ---- client card (overview) -------------------------------------------------
function ClientCard({ c, onOpen }: { c: ClientOverview; onOpen: () => void }) {
  const boardLink = c.board?.url ? `${c.board.url}?k=${c.board.token ?? ''}` : undefined;
  return (
    <div
      className="dv-card"
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, color: 'var(--d-paper)', fontWeight: 600 }}>{c.company}</div>
          <div style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>{c.tier}</div>
        </div>
        <StatusChip label={c.status} severity={c.status === 'live' ? 'good' : 'warn'} />
      </div>
      <KpiRow>
        <KpiTile label="In review" value={c.drafts.review} />
        <KpiTile label="On board" value={c.drafts.visible} severity="good" />
        <KpiTile label="Lanes" value={`${c.lanes.armed}/${c.lanes.total}`} />
        <KpiTile label="Spend" value={money(c.spend?.total_usd)} />
      </KpiRow>
      {boardLink && (
        <div style={{ marginTop: 10 }}>
          <a
            href={boardLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--d-good)' }}
          >
            view board as client ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ---- section root -----------------------------------------------------------
export function ClientOps() {
  const [loadErr, setLoadErr] = useState('');
  const [clients, setClients] = useState<ClientOverview[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoadErr('');
    const { data, error } = await supabase.rpc('operator_clients_overview', { p_gate: GATE });
    if (error || (data && data.ok === false)) {
      setLoadErr(error?.message || data?.error || 'load failed');
      setClients((prev) => prev ?? []);
      return;
    }
    setClients((data?.clients || []) as ClientOverview[]);
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  if (selected && clients) {
    const c = clients.find((x) => x.client_id === selected);
    if (c) return (
      <ClientDetail
        client={c}
        onBack={() => { setSelected(null); loadOverview(); }}
      />
    );
  }

  return (
    <>
      <HeadRow
        title="Client Ops"
        chip={clients ? { label: `${clients.length} live`, severity: 'good' } : undefined}
        meta={<>Reviewed output the client sees<br />Machine internals stay here</>}
        live
      />
      {loadErr && (
        <div style={{ margin: '4px 0 14px' }}>
          <ErrLine msg={loadErr} />
          <button onClick={() => loadOverview()} className="dv-btn-ghost" style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {clients == null ? <Loading what="clients" /> :
        clients.length === 0 ? (
          <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '12px 0' }}>
            No productized clients yet. Bootstrap one and it appears here automatically.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {clients.map((c) => (
              <ClientCard key={c.client_id} c={c} onOpen={() => setSelected(c.client_id)} />
            ))}
          </div>
        )}
    </>
  );
}
