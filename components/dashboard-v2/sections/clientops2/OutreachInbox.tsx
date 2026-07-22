import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import {
  approveRiseDraft,
  editRiseDraft,
  gateBlocking,
  fmtDate,
  ageLabel,
  GATE,
  type OutreachPayload,
  type OutreachProspect,
  type OutreachMessage,
  type OutreachCampaign,
  type PendingDraft,
} from './shared';

/**
 * Client Ops — OUTREACH INBOX (two-pane). Ivan: "a more comprehensive inbox view
 * of the linkedin chats... see all chats, sent connections, nice UI."
 *
 * Left  = conversation list (every prospect with activity: invite sent, connected,
 *         or any message). Segment chips + search. Needs-a-reply floats to top.
 * Right = the full thread as chat bubbles + the pending draft inline (edit /
 *         approve & send) + a manual composer.
 *
 * Reads the SAME two gated read RPCs the panel already uses (operator_client_outreach
 * + operator_client_pending_drafts). The only writes are the three existing gated
 * paths: approve draft, edit draft, operator_send_to_lead. Nothing new can send.
 */

// 0-10 lane-fit score chip (honest raw number, no band).
function IcpChip({ score }: { score: number | null }) {
  return (
    <span className={`co3-icp ${score == null ? 'co3-icp--low' : ''}`}>
      <span className="co3-icp-l">ICP</span>{score == null ? '—' : <b>{score}</b>}
    </span>
  );
}

const channelLabel = (p: OutreachProspect): string => {
  const ch = (p.preferred_channel || '').toLowerCase();
  if (ch.includes('inmail')) return 'InMail';
  if (ch.includes('email')) return 'Email';
  return 'LinkedIn DM';
};

const DRAFT_KIND_LABEL: Record<PendingDraft['kind'], string> = {
  reply: 'Reply draft', dm2: 'DM 2 · scan', dm1: 'DM 1', draft: 'Draft',
};

type StatusKey = 'needs_reply' | 'awaiting' | 'connected' | 'invited' | 'active';
const STATUS_LABEL: Record<StatusKey, string> = {
  needs_reply: 'Replied · you owe them',
  awaiting: 'Awaiting reply',
  connected: 'Connected, no message yet',
  invited: 'Invite sent',
  active: 'Active',
};

// A prospect the inbox treats as a live conversation, plus the derived fields the
// list sorts + previews on. `staged` prospects (no activity at all) are kept apart.
interface Conversation {
  p: OutreachProspect;
  status: StatusKey;
  lastActivityAt: number;   // ms; 0 when unknown
  snippet: string;
  draft: PendingDraft | null;
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
const hasActivity = (p: OutreachProspect) =>
  !!(p.connection_sent_at || p.connected_at || (p.messages && p.messages.length));

const statusOf = (p: OutreachProspect): StatusKey => {
  if (p.needs_manual_reply) return 'needs_reply';
  if (p.awaiting_reply) return 'awaiting';
  if (p.connected_at && !p.messaged) return 'connected';
  if (p.connection_sent_at && !p.connected_at) return 'invited';
  return 'active';
};

const newestMsg = (p: OutreachProspect): OutreachMessage | undefined =>
  [...(p.messages || [])].reverse().find((m) => !m.is_reaction && (m.text || '').trim());

const snippetOf = (p: OutreachProspect, status: StatusKey): string => {
  const m = newestMsg(p);
  if (m?.text) return (m.direction === 'inbound' ? '' : 'You: ') + m.text.replace(/\s+/g, ' ').trim();
  return STATUS_LABEL[status];
};

const rank: Record<StatusKey, number> = { needs_reply: 0, awaiting: 1, active: 2, connected: 3, invited: 4 };

// Segments across the top of the list. Counts computed live off the full set.
type Segment = 'all' | 'needs_reply' | 'awaiting' | 'connected' | 'invited' | 'drafts' | 'staged';
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'connected', label: 'Connected' },
  { key: 'invited', label: 'Invite sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'staged', label: 'Staged' },
];

export function OutreachInbox({ clientId, company, data, pendingDrafts, reload, reloadDrafts }: {
  clientId: string;
  company: string;
  data: OutreachPayload;
  pendingDrafts: PendingDraft[] | null;
  reload: () => void;
  reloadDrafts: () => void;
}) {
  const [segment, setSegment] = useState<Segment>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false); // narrow screens: thread visible

  const prospects = data?.prospects || [];
  const campaigns = data?.campaigns || [];
  const campaignById = useMemo(() => {
    const m: Record<string, OutreachCampaign> = {};
    campaigns.forEach((c) => { m[c.id] = c; });
    return m;
  }, [campaigns]);

  const draftByProspect = useMemo(() => {
    const m = new Map<string, PendingDraft>();
    (pendingDrafts || []).forEach((d) => { if (!m.has(d.prospect_id)) m.set(d.prospect_id, d); });
    return m;
  }, [pendingDrafts]);

  // Split into live conversations (any activity) and staged (never contacted).
  const { conversations, staged } = useMemo(() => {
    const conv: Conversation[] = [];
    const st: OutreachProspect[] = [];
    prospects.forEach((p) => {
      if (!hasActivity(p)) { st.push(p); return; }
      const status = statusOf(p);
      conv.push({
        p,
        status,
        lastActivityAt: Math.max(
          ms(p.last_reply_at), ms(p.last_dm_sent_at), ms(p.connected_at), ms(p.connection_sent_at),
          ...(p.messages || []).map((mm) => ms(mm.sent_at)),
        ),
        snippet: snippetOf(p, status),
        draft: draftByProspect.get(p.id) || null,
      });
    });
    conv.sort((a, b) => rank[a.status] - rank[b.status] || b.lastActivityAt - a.lastActivityAt);
    return { conversations: conv, staged: st };
  }, [prospects, draftByProspect]);

  const counts = useMemo(() => ({
    all: conversations.length,
    needs_reply: conversations.filter((c) => c.status === 'needs_reply').length,
    awaiting: conversations.filter((c) => c.status === 'awaiting').length,
    connected: conversations.filter((c) => c.status === 'connected').length,
    invited: conversations.filter((c) => c.status === 'invited').length,
    drafts: conversations.filter((c) => c.draft).length,
    staged: staged.length,
  }), [conversations, staged]);

  // The rows shown for the active segment + search.
  const shownConvos = useMemo(() => {
    let list = conversations;
    if (segment === 'needs_reply') list = list.filter((c) => c.status === 'needs_reply');
    else if (segment === 'awaiting') list = list.filter((c) => c.status === 'awaiting');
    else if (segment === 'connected') list = list.filter((c) => c.status === 'connected');
    else if (segment === 'invited') list = list.filter((c) => c.status === 'invited');
    else if (segment === 'drafts') list = list.filter((c) => c.draft);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) =>
      (c.p.name || '').toLowerCase().includes(q) || (c.p.company || '').toLowerCase().includes(q));
    return list;
  }, [conversations, segment, query]);

  const shownStaged = useMemo(() => {
    if (segment !== 'staged') return [];
    const q = query.trim().toLowerCase();
    if (!q) return staged;
    return staged.filter((p) =>
      (p.name || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q));
  }, [staged, segment, query]);

  // Auto-select the top conversation once, and keep a valid selection when data changes.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (data == null) return;
    const inList = selectedId && prospects.some((p) => p.id === selectedId);
    if (inList) return;
    if (!didAutoSelect.current || !inList) {
      const first = conversations[0]?.p.id ?? null;
      setSelectedId(first);
      didAutoSelect.current = true;
    }
  }, [data, conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) || null,
    [prospects, selectedId],
  );
  const selectedDraft = selectedId ? draftByProspect.get(selectedId) || null : null;

  const pick = (id: string) => { setSelectedId(id); setMobileOpen(true); };
  const afterWrite = () => { reload(); reloadDrafts(); };

  return (
    <div className="co4-wrap">
      <style>{CSS}</style>
      {!data.armed && (
        <div className="co3-armbanner">
          <span className="co3-armdot" aria-hidden />
          Sending is paused, so nothing goes out on its own. Replies and connections still show here; anything you approve sends from {company}'s seat.
        </div>
      )}
      <div className={`co4-inbox ${mobileOpen ? 'co4-inbox--mopen' : ''}`}>
          {/* ── LEFT: conversation list ─────────────────────────────── */}
          <div className="co4-list">
            <div className="co4-listhead">
              <input
                className="co4-search"
                placeholder="Search name or company…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="co4-segs">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    className={`co4-seg ${segment === s.key ? 'co4-seg--on' : ''} ${s.key === 'needs_reply' && counts.needs_reply ? 'co4-seg--alert' : ''}`}
                    onClick={() => setSegment(s.key)}
                  >
                    {s.label}<span className="co4-seg-n">{counts[s.key]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="co4-rows">
              {segment === 'staged' ? (
                shownStaged.length === 0
                  ? <div className="co4-listempty">No staged prospects match.</div>
                  : shownStaged.map((p) => (
                    <StagedRow key={p.id} p={p} selected={p.id === selectedId} onClick={() => pick(p.id)} />
                  ))
              ) : shownConvos.length === 0 ? (
                <div className="co4-listempty">No conversations here yet.</div>
              ) : (
                shownConvos.map((c) => (
                  <ConvoRow key={c.p.id} c={c} selected={c.p.id === selectedId} onClick={() => pick(c.p.id)} />
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: thread ───────────────────────────────────────── */}
          <div className="co4-thread">
            {selected ? (
              <ThreadPane
                p={selected}
                draft={selectedDraft}
                campaign={campaignById[selected.campaign_id]}
                clientId={clientId}
                company={company}
                onBack={() => setMobileOpen(false)}
                afterWrite={afterWrite}
              />
            ) : (
              <div className="co4-threadempty">
                <div className="co4-threadempty-h">No conversation selected.</div>
                <div className="co4-threadempty-n">Pick a chat on the left to read the full thread and answer from here.</div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

// ── List rows ────────────────────────────────────────────────────────────────
function ConvoRow({ c, selected, onClick }: { c: Conversation; selected: boolean; onClick: () => void }) {
  const { p, status, draft } = c;
  const age = ageLabel(c.lastActivityAt ? new Date(c.lastActivityAt).toISOString() : null);
  const inbound = status === 'needs_reply';
  return (
    <button className={`co4-row ${selected ? 'co4-row--on' : ''}`} onClick={onClick}>
      <span className={`co4-dot co4-dot--${status}`} aria-hidden />
      <span className="co4-row-body">
        <span className="co4-row-top">
          <span className="co4-row-name">{p.name || '(unnamed)'}</span>
          <span className="co4-row-age">{age}</span>
        </span>
        <span className="co4-row-co">{p.company || '—'}</span>
        <span className={`co4-row-snip ${inbound ? 'co4-row-snip--in' : ''}`}>{c.snippet}</span>
        <span className="co4-row-tags">
          <IcpChip score={p.icp_score} />
          {draft && <span className="co4-tag co4-tag--draft">● {DRAFT_KIND_LABEL[draft.kind]}</span>}
          {draft?.has_link && <span className="co4-tag">scan ✓</span>}
          {gateBlocking(p.gate) && <span className="co4-tag co4-tag--gate">name-gated</span>}
          {p.blacklisted && <span className="co4-tag co4-tag--mute">blacklisted</span>}
        </span>
      </span>
    </button>
  );
}

function StagedRow({ p, selected, onClick }: { p: OutreachProspect; selected: boolean; onClick: () => void }) {
  return (
    <button className={`co4-row ${selected ? 'co4-row--on' : ''}`} onClick={onClick}>
      <span className="co4-dot co4-dot--staged" aria-hidden />
      <span className="co4-row-body">
        <span className="co4-row-top">
          <span className="co4-row-name">{p.name || '(unnamed)'}</span>
        </span>
        <span className="co4-row-co">{p.company || '—'}</span>
        <span className="co4-row-snip">Not contacted yet</span>
        <span className="co4-row-tags">
          <IcpChip score={p.icp_score} />
          {gateBlocking(p.gate) && <span className="co4-tag co4-tag--gate">name-gated</span>}
        </span>
      </span>
    </button>
  );
}

// ── Thread pane ──────────────────────────────────────────────────────────────
type ThreadEvent =
  | { t: number; kind: 'sys'; text: string }
  | { t: number; kind: 'msg'; m: OutreachMessage };

function ThreadPane({ p, draft, campaign, clientId, company, onBack, afterWrite }: {
  p: OutreachProspect;
  draft: PendingDraft | null;
  campaign?: OutreachCampaign;
  clientId: string;
  company: string;
  onBack: () => void;
  afterWrite: () => void;
}) {
  const firstName = (p.name || 'them').split(' ')[0];

  const events = useMemo<ThreadEvent[]>(() => {
    const ev: ThreadEvent[] = [];
    if (p.connection_sent_at) ev.push({ t: ms(p.connection_sent_at), kind: 'sys', text: `Connection request sent · ${fmtDate(p.connection_sent_at)}` });
    if (p.connected_at) ev.push({ t: ms(p.connected_at), kind: 'sys', text: `Connected · ${fmtDate(p.connected_at)}` });
    // NEVER render a pending draft as a sent bubble. The read RPC coalesces sent_at to
    // created_at and includes unsent outbound draft rows in messages[], so a draft can
    // look sent. Drop the outbound row that matches the pending draft — it belongs only
    // in the approve box below, not in the conversation as if it already went out.
    const draftText = (draft?.text || '').trim();
    (p.messages || []).forEach((m) => {
      if (m.direction === 'outbound' && draftText && (m.text || '').trim() === draftText) return;
      ev.push({ t: ms(m.sent_at), kind: 'msg', m });
    });
    return ev.sort((a, b) => a.t - b.t);
  }, [p, draft]);

  const statusLine = useMemo(() => {
    const parts: string[] = [];
    if (p.connected_at) parts.push(`connected ${ageLabel(p.connected_at)} ago`);
    else if (p.connection_sent_at) parts.push(`invite sent ${ageLabel(p.connection_sent_at)} ago`);
    if (p.dm_count) parts.push(`${p.dm_count} DM${p.dm_count === 1 ? '' : 's'}`);
    if (p.reply_count) parts.push(`replied ${p.last_reply_at ? ageLabel(p.last_reply_at) + ' ago' : ''}`.trim());
    return parts.join(' · ');
  }, [p]);

  return (
    <>
      <div className="co4-th-head">
        <button className="co4-back" onClick={onBack}>‹ All chats</button>
        <div className="co4-th-id">
          <div className="co4-th-name">{p.name || '(unnamed)'}</div>
          <div className="co4-th-sub">{p.company || '—'}{p.headline ? ` · ${p.headline}` : ''}</div>
          {statusLine && <div className="co4-th-status">{statusLine}</div>}
        </div>
        <div className="co4-th-chips">
          <IcpChip score={p.icp_score} />
          <span className="co4-th-chip">{channelLabel(p)}</span>
          {campaign && <span className="co4-th-chip">{campaign.name}</span>}
          {p.needs_manual_reply && <span className="co4-th-chip co4-th-chip--alert">Owe reply</span>}
        </div>
      </div>

      <div className="co4-th-body">
        {gateBlocking(p.gate) && (
          <div className="co3-flag">
            Blocked until you OK the anchor name{p.gate?.anchor_client ? ` (${p.gate.anchor_client})` : ''}. {p.gate?.note}
          </div>
        )}
        {events.length === 0 ? (
          <div className="co4-th-none">No messages yet on this thread.</div>
        ) : (
          <div className="co4-th-stream">
            {events.map((e, i) => e.kind === 'sys' ? (
              <div key={i} className="co4-sys">{e.text}</div>
            ) : e.m.is_reaction ? (
              <div key={i} className="co4-react">
                {(e.m.direction === 'inbound' ? firstName : company)} reacted {e.m.text || '·'}
              </div>
            ) : (
              <div key={i} className={`co3-bubble co4-bubble co3-bubble--${e.m.direction === 'inbound' ? 'in' : 'out'}`}>
                <span className="co3-bubble-who">
                  {e.m.direction === 'inbound' ? firstName : company}
                  {e.m.sent_at ? ` · ${fmtDate(e.m.sent_at)}` : ''}
                </span>
                <div className="co3-bubble-t">{e.m.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="co4-th-foot">
        {draft && <InlineDraft key={draft.message_id} draft={draft} company={company} name={p.name} afterWrite={afterWrite} />}
        <Composer p={p} clientId={clientId} company={company} afterWrite={afterWrite} />
      </div>
    </>
  );
}

// ── Inline pending draft: edit / approve & send (existing gated paths) ─────────
function InlineDraft({ draft, company, name, afterWrite }: {
  draft: PendingDraft; company: string; name: string | null; afterWrite: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.text || '');
  const [body, setBody] = useState(draft.text || '');
  const [note, setNote] = useState('');

  const send = async () => {
    if (busy || done || editing) return;
    if (!window.confirm(`Approve and send this ${DRAFT_KIND_LABEL[draft.kind]} to ${name || 'this lead'}? It sends from ${company}'s seat.`)) return;
    setBusy(true); setNote('');
    const r = await approveRiseDraft(draft.message_id);
    setBusy(false);
    if (r.ok) { setDone(true); setNote(r.note || 'Approved.'); setTimeout(afterWrite, 1200); }
    else {
      setNote(r.note || r.error || 'Could not approve.');
      if (r.error === 'conversation_moved_on') { setDone(true); setTimeout(afterWrite, 1600); }
    }
  };
  const save = async () => {
    if (busy) return;
    const t = text.trim();
    if (t.length < 3) { setNote('Draft is too short.'); return; }
    setBusy(true); setNote('');
    const r = await editRiseDraft(draft.message_id, t);
    setBusy(false);
    if (r.ok) { setBody(t); setEditing(false); setNote('Saved.'); }
    else setNote(r.error === 'not_a_pending_draft' ? 'Already sent, can’t edit.' : (r.error || 'Could not save.'));
  };

  return (
    <div className="co4-draft">
      <div className="co4-draft-top">
        <span className={`co3-kind co3-kind--${draft.kind}`}>{DRAFT_KIND_LABEL[draft.kind]}</span>
        {draft.has_link && <span className="co3-scanchip">scan link ✓</span>}
        <span className="co4-draft-l">Drafted for you</span>
      </div>
      {editing ? (
        <textarea
          className="co3-draft-edit"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(3, Math.min(12, text.split('\n').length + 1))}
          autoFocus
        />
      ) : (
        <div className="co3-draft-body co3-draft-body--reply">{body}</div>
      )}
      <div className="co3-draft-row">
        {editing ? (
          <>
            <button className="co3-send-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="co3-edit-btn" disabled={busy} onClick={() => { setText(body); setEditing(false); setNote(''); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="co3-send-btn" disabled={busy || done} onClick={send}>{done ? 'Approved ✓' : busy ? 'Approving…' : 'Approve & send'}</button>
            {!done && <button className="co3-edit-btn" onClick={() => { setText(body); setEditing(true); setNote(''); }}>Edit</button>}
          </>
        )}
        {note && <span className="co3-send-note">{note}</span>}
      </div>
    </div>
  );
}

// ── Manual composer: free-text send from the client's seat (gated RPC) ─────────
function Composer({ p, clientId, company, afterWrite }: {
  p: OutreachProspect; clientId: string; company: string; afterWrite: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const channel = (p.preferred_channel || 'linkedin').toLowerCase().includes('inmail') ? 'inmail' : 'linkedin';

  const send = async () => {
    if (busy) return;
    if (!text.trim()) { setResult('Write the message first.'); return; }
    if (!window.confirm(`Send from ${company}'s seat?`)) return;
    setBusy(true); setResult('');
    try {
      const { data, error } = await supabase.rpc('operator_send_to_lead', {
        p_gate: GATE, p_client_id: clientId, p_prospect_id: p.id, p_channel: channel, p_text: text,
      });
      const r = (data as { ok?: boolean; note?: string; error?: string }) || null;
      setResult(error?.message || r?.note || r?.error || 'No response.');
      if (r?.ok) { setText(''); setTimeout(afterWrite, 1200); }
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <div className="co4-compose">
      <textarea
        className="co4-compose-ta"
        placeholder={`Write to ${p.name?.split(' ')[0] || 'this lead'} (${channel === 'inmail' ? 'InMail' : 'LinkedIn DM'})…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <div className="co4-compose-row">
        <button className="co3-send-btn" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send from seat'}</button>
        {result && <span className="co3-send-note">{result}</span>}
      </div>
    </div>
  );
}

// ── Scoped styles (co4- inbox layer; leans on co3- tokens under .ec) ──────────
const CSS = `
.ec .co4-wrap { display:flex; flex-direction:column; gap:0.9rem; }
.ec .co4-inbox { display:grid; grid-template-columns:minmax(260px,340px) 1fr; height:min(74vh,760px); border:1px solid var(--ec-rule-strong); background:var(--ec-paper); }

/* Left list */
.ec .co4-list { border-right:1px solid var(--ec-rule-strong); display:flex; flex-direction:column; min-height:0; }
.ec .co4-listhead { position:sticky; top:0; z-index:2; background:var(--ec-paper); border-bottom:1px solid var(--ec-rule-strong); padding:0.6rem 0.6rem 0.5rem; display:flex; flex-direction:column; gap:0.5rem; }
.ec .co4-search { width:100%; box-sizing:border-box; font-family:var(--ec-sans); font-size:12.5px; color:var(--ec-ink); background:#fff; border:1px solid var(--ec-rule-strong); padding:0.42rem 0.55rem; }
.ec .co4-search:focus { outline:none; border-color:var(--ec-ink); }
.ec .co4-segs { display:flex; flex-wrap:wrap; gap:0.3rem; }
.ec .co4-seg { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.03em; text-transform:uppercase; color:var(--ec-mutedc); background:none; border:1px solid var(--ec-rule-strong); padding:0.22rem 0.42rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem; }
.ec .co4-seg:hover { background:rgba(19,18,16,0.04); }
.ec .co4-seg--on { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co4-seg--alert:not(.co4-seg--on) { color:var(--ec-red); border-color:var(--ec-red); }
.ec .co4-seg-n { font-variant-numeric:tabular-nums; opacity:0.75; }

.ec .co4-rows { flex:1 1 auto; overflow-y:auto; min-height:0; }
.ec .co4-listempty { font-family:var(--ec-clinical); font-style:italic; font-size:12px; color:var(--ec-mutedc); padding:1.2rem 0.7rem; }
.ec .co4-row { width:100%; display:flex; gap:0.55rem; align-items:flex-start; text-align:left; background:none; border:0; border-bottom:1px solid var(--ec-rule); padding:0.6rem 0.6rem; cursor:pointer; font:inherit; color:inherit; }
.ec .co4-row:hover { background:rgba(19,18,16,0.03); }
.ec .co4-row--on { background:rgba(19,18,16,0.06); }
.ec .co4-dot { width:8px; height:8px; border-radius:9999px; flex:0 0 auto; margin-top:0.35rem; border:1px solid var(--ec-ink); }
.ec .co4-dot--needs_reply { background:var(--ec-red); border-color:var(--ec-red); }
.ec .co4-dot--awaiting { background:transparent; border-color:var(--ec-ink); }
.ec .co4-dot--connected { background:var(--ec-ink); }
.ec .co4-dot--invited { background:transparent; border-style:dashed; border-color:var(--ec-mutedc); }
.ec .co4-dot--active { background:var(--ec-mutedc); border-color:var(--ec-mutedc); }
.ec .co4-dot--staged { background:transparent; border-color:var(--ec-rule-strong); }
.ec .co4-row-body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:0.14rem; }
.ec .co4-row-top { display:flex; align-items:baseline; justify-content:space-between; gap:0.5rem; }
.ec .co4-row-name { font-family:var(--ec-sans); font-size:13px; font-weight:600; color:var(--ec-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co4-row-age { font-family:var(--ec-sans); font-size:10px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; flex:0 0 auto; }
.ec .co4-row-co { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co4-row-snip { font-family:var(--ec-sans); font-size:11.5px; color:var(--ec-body); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co4-row-snip--in { color:var(--ec-ink); font-weight:600; }
.ec .co4-row-tags { display:flex; flex-wrap:wrap; align-items:center; gap:0.3rem; margin-top:0.14rem; }
.ec .co4-tag { font-family:var(--ec-sans); font-size:9px; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; padding:0.1rem 0.34rem; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); }
.ec .co4-tag--draft { color:var(--ec-paper); background:var(--ec-red); border-color:var(--ec-red); }
.ec .co4-tag--gate { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co4-tag--mute { border-style:dashed; }

/* Right thread */
.ec .co4-thread { display:flex; flex-direction:column; min-width:0; min-height:0; }
.ec .co4-threadempty { margin:auto; text-align:center; padding:2rem; }
.ec .co4-threadempty-h { font-family:var(--ec-sans); font-weight:700; font-size:14px; color:var(--ec-ink); }
.ec .co4-threadempty-n { font-family:var(--ec-sans); font-size:12px; color:var(--ec-mutedc); margin-top:0.3rem; max-width:320px; }
.ec .co4-th-head { position:sticky; top:0; z-index:2; display:flex; align-items:flex-start; gap:0.8rem; background:var(--ec-paper); border-bottom:1px solid var(--ec-rule-strong); padding:0.7rem 0.9rem; }
.ec .co4-back { display:none; font-family:var(--ec-sans); font-weight:700; font-size:11px; color:var(--ec-ink); background:none; border:0; cursor:pointer; padding:0.1rem 0.2rem 0.1rem 0; }
.ec .co4-th-id { flex:1 1 auto; min-width:0; }
.ec .co4-th-name { font-family:var(--ec-sans); font-weight:700; font-size:15px; color:var(--ec-ink); }
.ec .co4-th-sub { font-family:var(--ec-sans); font-size:11.5px; color:var(--ec-mutedc); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co4-th-status { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-body); margin-top:0.2rem; font-variant-numeric:tabular-nums; }
.ec .co4-th-chips { display:flex; flex-wrap:wrap; gap:0.35rem; justify-content:flex-end; flex:0 0 auto; }
.ec .co4-th-chip { font-family:var(--ec-sans); font-size:9.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); padding:0.12rem 0.4rem; }
.ec .co4-th-chip--alert { color:var(--ec-paper); background:var(--ec-red); border-color:var(--ec-red); }

.ec .co4-th-body { flex:1 1 auto; overflow-y:auto; min-height:0; padding:0.9rem; display:flex; flex-direction:column; gap:0.7rem; }
.ec .co4-th-none { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; color:var(--ec-mutedc); margin:auto; }
.ec .co4-th-stream { display:flex; flex-direction:column; gap:0.45rem; }
.ec .co4-bubble { max-width:82%; }
.ec .co4-sys { align-self:center; font-family:var(--ec-sans); font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); padding:0.2rem 0; }
.ec .co4-react { align-self:center; font-family:var(--ec-clinical); font-style:italic; font-size:11px; color:var(--ec-mutedc); }

.ec .co4-th-foot { border-top:1px solid var(--ec-rule-strong); background:var(--ec-paper); padding:0.7rem 0.9rem; display:flex; flex-direction:column; gap:0.7rem; max-height:52%; overflow-y:auto; }
.ec .co4-draft { border:1px solid var(--ec-rule-strong); border-left:3px solid var(--ec-ink); padding:0.6rem 0.7rem; display:flex; flex-direction:column; gap:0.5rem; }
.ec .co4-draft-top { display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; }
.ec .co4-draft-l { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); margin-left:auto; }
.ec .co4-compose { display:flex; flex-direction:column; gap:0.45rem; }
.ec .co4-compose-ta { width:100%; box-sizing:border-box; font-family:var(--ec-sans); font-size:12.5px; line-height:1.5; color:var(--ec-body); background:#fff; border:1px solid var(--ec-rule-strong); padding:0.5rem 0.6rem; resize:vertical; }
.ec .co4-compose-ta:focus { outline:none; border-color:var(--ec-ink); }
.ec .co4-compose-row { display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap; }

@media (max-width:760px){
  .ec .co4-inbox { grid-template-columns:1fr; height:auto; }
  .ec .co4-list { border-right:0; }
  .ec .co4-rows { max-height:60vh; }
  .ec .co4-thread { display:none; }
  .ec .co4-inbox--mopen .co4-list { display:none; }
  .ec .co4-inbox--mopen .co4-thread { display:flex; }
  .ec .co4-back { display:inline-flex; }
  .ec .co4-th-body { max-height:none; }
}
`;

export default OutreachInbox;
