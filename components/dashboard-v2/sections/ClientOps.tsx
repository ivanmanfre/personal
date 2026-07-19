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

const GATE_KEY = 'clientops_gate';
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
}
interface ActionRow {
  id: string;
  action: string;
  ref: string | null;
  payload: any;
  created_at: string;
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
const isBadGate = (r: { error?: any; data?: any }) =>
  (r.data && r.data.ok === false && r.data.error === 'bad_gate');

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

// ---- gate prompt ------------------------------------------------------------
function GatePrompt({ onSubmit, error }: { onSubmit: (v: string) => void; error?: string }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }}
      style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}
    >
      <div style={{ color: 'var(--d-paper-dim)', fontSize: 13 }}>
        Enter the operator key to load client internals.
      </div>
      <input
        type="password"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="operator key"
        autoFocus
        style={{
          background: 'var(--d-ink-2)', border: '1px solid var(--d-rule-strong)',
          borderRadius: 8, padding: '10px 12px', color: 'var(--d-paper)', fontSize: 14,
        }}
      />
      {error && <div style={{ color: 'var(--d-bad-txt)', fontSize: 12 }}>{error}</div>}
      <button
        type="submit"
        className="dv-btn-ghost"
        style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
      >
        Unlock
      </button>
    </form>
  );
}

// ---- draft row --------------------------------------------------------------
function DraftRow({ d, onToggle }: { d: Draft; onToggle: (d: Draft, next: boolean) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canToggle = d.status === 'review';
  return (
    <div style={{ borderBottom: '1px solid var(--d-rule)', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <span style={{ fontSize: 12, color: 'var(--d-paper-dim)', width: 52, textAlign: 'right', flexShrink: 0 }}>
          {fmtDate(d.created_at)}
        </span>
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
      {open && (
        <div style={{ padding: '10px 0 4px 26px', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: 'var(--d-paper-2, var(--d-paper))' }}>
          {d.post_body || <span style={{ color: 'var(--d-paper-dim)' }}>No body.</span>}
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
function ClientDetail({ client, gate, onBack, onGateFail }: {
  client: ClientOverview; gate: string; onBack: () => void; onGateFail: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [actions, setActions] = useState<ActionRow[] | null>(null);
  const [draftsErr, setDraftsErr] = useState('');
  const [actionsErr, setActionsErr] = useState('');

  const loadDetail = useCallback(async () => {
    setDraftsErr(''); setActionsErr('');
    const [dRes, aRes] = await Promise.all([
      supabase.rpc('operator_client_drafts', { p_gate: gate, p_client_id: client.client_id }),
      supabase.rpc('operator_client_actions', { p_gate: gate, p_slug: client.board.slug }),
    ]);
    if (isBadGate(dRes) || isBadGate(aRes)) { onGateFail(); return; }
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
  }, [client.client_id, client.board.slug, gate, onGateFail]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const onToggle = useCallback(async (d: Draft, next: boolean) => {
    // optimistic
    setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: next } : x)) ?? prev);
    const res = await supabase.rpc('operator_set_board_visible', {
      p_gate: gate, p_draft_id: d.id, p_visible: next,
    });
    if (isBadGate(res)) {
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: !next } : x)) ?? prev);
      onGateFail();
      return;
    }
    if (res.error || (res.data && res.data.ok === false)) {
      // revert to the exact prior value
      setDrafts((prev) => prev?.map((x) => (x.id === d.id ? { ...x, board_visible: !next } : x)) ?? prev);
      setDraftsErr(res.error?.message || res.data?.error || 'toggle failed');
    }
  }, [gate, onGateFail]);

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

      <Card label="DRAFTS — flip a review draft on to show it on the client board">
        {draftsErr && <ErrLine msg={draftsErr} />}
        {drafts == null ? <Loading what="drafts" /> :
          drafts.length === 0 ? <div style={{ color: 'var(--d-paper-dim)', fontSize: 13, padding: '10px 0' }}>No drafts.</div> :
          drafts.map((d) => <DraftRow key={d.id} d={d} onToggle={onToggle} />)}
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
  const [gate, setGate] = useState<string | null>(() => {
    try { return localStorage.getItem(GATE_KEY); } catch { return null; }
  });
  const [gateErr, setGateErr] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [clients, setClients] = useState<ClientOverview[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const clearGate = useCallback(() => {
    setGate(null);
    setClients(null);
    setSelected(null);
    setGateErr('Operator key rejected. Enter it again.');
    try { localStorage.removeItem(GATE_KEY); } catch { /* ignore */ }
  }, []);

  const loadOverview = useCallback(async (g: string) => {
    setLoadErr('');
    const { data, error } = await supabase.rpc('operator_clients_overview', { p_gate: g });
    if (data && data.ok === false && data.error === 'bad_gate') { clearGate(); return; }
    if (error || (data && data.ok === false)) {
      // a real failure with a valid key — keep the key, surface the error + retry
      setLoadErr(error?.message || data?.error || 'load failed');
      setClients((prev) => prev ?? []);
      return;
    }
    setClients((data?.clients || []) as ClientOverview[]);
  }, [clearGate]);

  useEffect(() => { if (gate) loadOverview(gate); }, [gate, loadOverview]);

  const submitGate = (v: string) => {
    setGateErr('');
    try { localStorage.setItem(GATE_KEY, v); } catch { /* ignore */ }
    setGate(v);
  };

  if (!gate) {
    return (
      <>
        <HeadRow title="Client Ops" meta="Operator review surface" />
        <GatePrompt onSubmit={submitGate} error={gateErr} />
      </>
    );
  }

  if (selected && clients) {
    const c = clients.find((x) => x.client_id === selected);
    if (c) return (
      <ClientDetail
        client={c}
        gate={gate}
        onBack={() => { setSelected(null); loadOverview(gate); }}
        onGateFail={clearGate}
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
          <button onClick={() => loadOverview(gate)} className="dv-btn-ghost" style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Retry</button>
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
