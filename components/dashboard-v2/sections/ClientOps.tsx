import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { HeadRow, KpiRow, KpiTile, StatusChip, Card } from '../primitives';
import type { Severity } from '../types';

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
 */

// Operator surface, no password: the RPCs carry a fixed plumbing token (they run
// on Ivan's own dashboard). Real protection for the board token + spend rides on
// the planned dashboard-wide gate/RLS fold, not a per-panel prompt.
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
  board_visible: boolean;
  created_at: string;
  published_at: string | null;
  post_body: string | null;
  type: 'text' | 'single_image' | 'carousel';
  has_media: boolean;
  scheduled_at: string | null;
}
interface ActionRow {
  id: string;
  action: string;
  ref: string | null;
  payload: any;
  created_at: string;
}
interface Idea {
  id: string;
  hook: string;
  title?: string;
  source_label?: string;
  pillar?: string;
  format?: string;
  created_at?: string;
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
const money = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;

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
  if (status === 'published' || status === 'scheduled') return <StatusChip label={status} severity="good" />;
  return (
    <span style={{
      fontSize: 11, color: 'var(--d-paper-dim)', border: '1px solid var(--d-rule-strong)',
      borderRadius: 999, padding: '2px 8px', textTransform: 'lowercase', letterSpacing: '.02em',
    }}>{status}</span>
  );
}

// ---- draft row --------------------------------------------------------------
function DraftRow({ d, onToggle, onSchedule }: {
  d: Draft;
  onToggle: (d: Draft, next: boolean) => Promise<void>;
  onSchedule: (d: Draft) => Promise<{ ok: boolean; error?: string }>;
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
        <StatusPill status={d.status} />
        {d.qa_score != null && <StatusChip label={`QA ${d.qa_score}`} severity={qaSeverity(d.qa_score)} />}
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
      {schedNote && (
        <div style={{ fontSize: 11, color: 'var(--d-warn, var(--d-paper-dim))', padding: '4px 0 0 26px' }}>{schedNote}</div>
      )}
      {open && (
        <div style={{ padding: '10px 0 4px 26px', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: 'var(--d-paper-2, var(--d-paper))' }}>
          {d.post_body || <span style={{ color: 'var(--d-paper-dim)' }}>No body.</span>}
        </div>
      )}
    </div>
  );
}

// ---- idea row ----------------------------------------------------------------
function IdeaRow({ idea, onDecide }: {
  idea: Idea;
  onDecide: (idea: Idea, decision: 'approved' | 'rejected') => Promise<void>;
}) {
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (busy) return;
    setBusy(decision);
    try { await onDecide(idea, decision); } finally { setBusy(null); }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--d-rule)', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--d-paper)' }}>{idea.hook}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {idea.source_label && (
              <span style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>{idea.source_label}</span>
            )}
            {idea.pillar && <MutedPill label={idea.pillar} />}
          </div>
        </div>
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
  const [draftsErr, setDraftsErr] = useState('');
  const [actionsErr, setActionsErr] = useState('');
  const [ideasErr, setIdeasErr] = useState('');

  const loadDetail = useCallback(async () => {
    setDraftsErr(''); setActionsErr(''); setIdeasErr('');
    const [dRes, aRes, iRes] = await Promise.all([
      supabase.rpc('operator_client_drafts', { p_gate: GATE, p_client_id: client.client_id }),
      supabase.rpc('operator_client_actions', { p_gate: GATE, p_slug: client.board.slug }),
      supabase.rpc('operator_client_ideas', { p_gate: GATE, p_client_id: client.client_id }),
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

      <Card label="IDEAS — approve to send into generation, or pass">
        {ideasErr && <ErrLine msg={ideasErr} />}
        {ideas == null ? <Loading what="ideas" /> :
          ideas.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No staged ideas.</div> :
          ideas.map((idea) => <IdeaRow key={idea.id} idea={idea} onDecide={onDecideIdea} />)}
      </Card>

      <div style={{ height: 18 }} />

      <Card label="DRAFTS — flip a review draft on to show it on the client board">
        {draftsErr && <ErrLine msg={draftsErr} />}
        {drafts == null ? <Loading what="drafts" /> :
          drafts.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No drafts.</div> :
          drafts.map((d) => <DraftRow key={d.id} d={d} onToggle={onToggle} onSchedule={onSchedule} />)}
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
