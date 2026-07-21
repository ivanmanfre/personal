import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import {
  useClientOutreach,
  useClientPendingDrafts,
  approveRiseDraft,
  fmtDate,
  ageLabel,
  GATE,
  type OutreachPayload,
  type OutreachCampaign,
  type OutreachProspect,
  type OutreachSeq,
  type OutreachSeqStep,
  type PendingDraft,
} from './shared';

// Prospect icp_score is a 0-10 lane-fit scale (NOT the 0-100 content-idea scale),
// so it gets its own honest chip: the raw number, no High/Mid/Low band.
function IcpChip({ score }: { score: number | null }) {
  return (
    <span className={`co3-icp ${score == null ? 'co3-icp--low' : ''}`}>
      <span className="co3-icp-l">ICP</span>{score == null ? '—' : <b>{score}</b>}
    </span>
  );
}

/**
 * Client Ops — OUTREACH view (W2). Two honest modes for a client's DMs + InMails:
 *
 *   1. All outreach  — every prospect the system will message, lane-grouped, with
 *      the ACTUAL lane sequence copy (the ratified board.outreach.sequences
 *      package), each prospect's gate flags, and per-prospect generated copy when
 *      it exists. Placeholders like {first} / {brand} are shown literal — they
 *      fill from each prospect's real store + profile at send time.
 *
 *   2. Waiting on response — priority queue. "They replied, you owe them" leads on
 *      top (needs_manual_reply), then "messaged, no reply yet" sorted most-recent
 *      touch first. Both read the columns the Conversation Monitor already stamps.
 *      Empty for RISE DTC today because nothing is armed — an honest empty state
 *      that fills the moment sends go live.
 *
 * READ ONLY. Nothing on this surface sends. RPC is gated + client-scoped.
 */

type Mode = 'list' | 'waiting' | 'drafts';

// Human label + register for each draft kind the RISE machine produces.
const KIND_META: Record<PendingDraft['kind'], { label: string; blurb: string }> = {
  reply: { label: 'Reply draft', blurb: 'Drafted answer to their reply' },
  dm2: { label: 'DM 2 · scan', blurb: 'Delivers their scan' },
  dm1: { label: 'DM 1', blurb: 'Opening message' },
  draft: { label: 'Draft', blurb: 'Queued message' },
};

const laneBadge = (c: OutreachCampaign): string => (c.is_active ? 'Live' : 'Sending paused');

// Channel a prospect is set up for, best-effort from the row.
const channelLabel = (p: OutreachProspect): string => {
  const ch = (p.preferred_channel || '').toLowerCase();
  if (ch.includes('inmail')) return 'InMail';
  if (ch.includes('email')) return 'Email';
  return 'LinkedIn DM';
};

export function OutreachView({ clientId, company }: { clientId: string; company: string }) {
  const { data, error, reload } = useClientOutreach(clientId);
  const { drafts: pendingDrafts, error: draftsError, reload: reloadDrafts } = useClientPendingDrafts(clientId);
  const [mode, setMode] = useState<Mode>('list');

  const seqByLane = useMemo(() => {
    const m: Record<string, OutreachSeq> = {};
    (data?.sequences?.channels || []).forEach((s) => { m[s.key] = s; });
    return m;
  }, [data]);

  // Priority buckets — read straight off the reply infra the monitor maintains.
  const needsReply = useMemo(
    () => (data?.prospects || [])
      .filter((p) => p.needs_manual_reply)
      .sort((a, b) => new Date(b.last_reply_at || 0).getTime() - new Date(a.last_reply_at || 0).getTime()),
    [data],
  );
  const awaiting = useMemo(
    () => (data?.prospects || [])
      .filter((p) => p.awaiting_reply && !p.needs_manual_reply)
      .sort((a, b) => new Date(b.last_dm_sent_at || 0).getTime() - new Date(a.last_dm_sent_at || 0).getTime()),
    [data],
  );

  const campaigns = data?.campaigns || [];
  const prospects = data?.prospects || [];
  const totalProspects = prospects.length;
  const totalWaiting = needsReply.length + awaiting.length;
  const totalDrafts = (pendingDrafts || []).length;
  const replyDrafts = (pendingDrafts || []).filter((d) => d.kind === 'reply').length;
  const anyArmed = !!data?.armed;

  // Pending responses come first: land on the Drafts view the moment a reply someone
  // is owed is waiting (Ivan: "first thing that appears"). Fires once, never fights nav.
  const didAutoLand = useRef(false);
  useEffect(() => {
    if (didAutoLand.current || pendingDrafts == null) return;
    if (replyDrafts > 0) { setMode('drafts'); didAutoLand.current = true; }
  }, [pendingDrafts, replyDrafts]);

  return (
    <section className="co2-laneblock co3-root">
      <style>{CSS}</style>

      <div className="co3-head">
        <div className="ec-kicker" style={{ margin: 0 }}>
          Outreach — every DM and InMail the system will send for {company}, with replies pulled in
        </div>
        <div className="co3-tabs" role="tablist" aria-label="Outreach views">
          <button role="tab" aria-selected={mode === 'drafts'} className={`co3-tab ${mode === 'drafts' ? 'co3-tab--on' : ''} ${totalDrafts ? 'co3-tab--flag' : ''}`} onClick={() => setMode('drafts')}>
            {replyDrafts ? 'Pending responses' : 'Drafts waiting on you'}{totalDrafts ? ` · ${totalDrafts}` : ''}
          </button>
          <button role="tab" aria-selected={mode === 'waiting'} className={`co3-tab ${mode === 'waiting' ? 'co3-tab--on' : ''}`} onClick={() => setMode('waiting')}>
            Waiting on response{totalWaiting ? ` · ${totalWaiting}` : ''}
          </button>
          <button role="tab" aria-selected={mode === 'list'} className={`co3-tab ${mode === 'list' ? 'co3-tab--on' : ''}`} onClick={() => setMode('list')}>
            All outreach{totalProspects ? ` · ${totalProspects}` : ''}
          </button>
          <button className="ws-tool-icon" onClick={() => { reload(); reloadDrafts(); }} title="Refresh outreach">↻</button>
        </div>
      </div>

      {error && <div className="co2-err">{error}</div>}

      {/* Sending-paused truth banner — reads the campaigns' real is_active state. */}
      {!anyArmed && (
        <div className="co3-armbanner">
          <span className="co3-armdot" aria-hidden />
          Sending is paused, so nothing has gone out. This is the copy queued to go out and the people it would reach the moment sending goes live.
        </div>
      )}

      {draftsError && mode === 'drafts' && <div className="co2-err">{draftsError}</div>}

      {data == null && !error ? (
        <div className="ws-loading">Loading outreach…</div>
      ) : mode === 'list' ? (
        <ListView data={data!} seqByLane={seqByLane} armed={anyArmed} clientId={clientId} company={company} />
      ) : mode === 'waiting' ? (
        <WaitingView needsReply={needsReply} awaiting={awaiting} armed={anyArmed} />
      ) : (
        <DraftsView drafts={pendingDrafts} company={company} onApproved={reloadDrafts} />
      )}
    </section>
  );
}

// ── Drafts waiting on you — pending DM1 / DM2 / reply drafts + the human send ──
// Every draft the machine queued but has NOT sent (approved_at null). Each row
// shows what triggered it (the inbound reply, for reply drafts), the draft text,
// whether it carries the scan link, and a Send button. Send = approve the draft;
// the Poll+Send dispatcher then sends from the client's seat. Server double-gates
// (operator gate + risedtc_reply_send_armed), so nothing dispatches on a stray click.
function DraftsView({ drafts, company, onApproved }: { drafts: PendingDraft[] | null; company: string; onApproved: () => void }) {
  if (drafts == null) return <div className="ws-loading">Loading drafts…</div>;
  if (drafts.length === 0) {
    return (
      <div className="co3-empty">
        <div className="co3-empty-h">No drafts waiting on you.</div>
        <div className="co3-empty-note">
          When a prospect replies, the reply drafter writes an answer here (with their scan attached when they ask for it),
          and scan-delivery DM 2s land here on their timer. Every draft waits for your approval — nothing sends on its own.
        </div>
      </div>
    );
  }
  // Pending responses from real people come first (they replied, you owe them),
  // then scan deliveries (dm2), openers (dm1), everything else — newest within each.
  const rank = (k: string) => (k === 'reply' ? 0 : k === 'dm2' ? 1 : k === 'dm1' ? 2 : 3);
  const ordered = [...drafts].sort(
    (a, b) => rank(a.kind) - rank(b.kind) ||
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
  return (
    <div className="co3-drafts">
      <div className="co3-drafts-note">
        {drafts.length} draft{drafts.length === 1 ? '' : 's'} queued for {company}. Approve to send from {company}'s seat — nothing goes out until you do.
      </div>
      {ordered.map((d) => <DraftRow key={d.message_id} d={d} company={company} onApproved={onApproved} />)}
    </div>
  );
}

function DraftRow({ d, company, onApproved }: { d: PendingDraft; company: string; onApproved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const meta = KIND_META[d.kind] || KIND_META.draft;
  const send = async () => {
    if (busy || done) return;
    if (!window.confirm(`Approve and send this ${meta.label} to ${d.name || 'this lead'}? It sends from the client's seat.`)) return;
    setBusy(true); setNote('');
    const r = await approveRiseDraft(d.message_id);
    setBusy(false);
    if (r.ok) { setDone(true); setNote(r.note || 'Approved.'); setTimeout(onApproved, 1200); }
    else setNote(r.note || r.error || 'Could not approve.');
  };
  return (
    <div className="co3-draft">
      <div className="co3-draft-top">
        <IcpChip score={d.icp_score} />
        <span className="co3-pident">
          <span className="co3-pname">{d.name || '(unnamed)'}</span>
          <span className="co3-pmeta">{d.company || '—'}</span>
        </span>
        <span className="co3-draft-tags">
          <span className={`co3-kind co3-kind--${d.kind}`}>{meta.label}</span>
          {d.has_link && <span className="co3-scanchip">scan link ✓</span>}
        </span>
      </div>
      {d.thread && d.thread.length > 0 ? (
        <div className="co3-thread" aria-label="conversation so far">
          {d.thread.map((t, i) => (
            <div key={i} className={`co3-bubble co3-bubble--${t.direction === 'inbound' ? 'in' : 'out'}`}>
              <span className="co3-bubble-who">{t.direction === 'inbound' ? (d.name?.split(' ')[0] || 'them') : company}</span>
              <div className="co3-bubble-t">{t.text}</div>
            </div>
          ))}
        </div>
      ) : (d.kind === 'reply' && d.inbound?.text && (
        <div className="co3-trigger">
          <span className="co3-trigger-l">← they said</span>
          <div className="co3-trigger-t">“{d.inbound.text}”</div>
        </div>
      ))}
      <div className="co3-draft-body co3-draft-body--reply">{d.text}</div>
      <div className="co3-draft-row">
        <button className="co3-send-btn" disabled={busy || done} onClick={send} title="Approve and send">
          {done ? 'Approved ✓' : busy ? 'Approving…' : 'Approve & send'}
        </button>
        {!d.has_link && d.kind !== 'dm1' && <span className="co3-draft-warn">no scan link in this draft</span>}
        {note && <span className="co3-send-note">{note}</span>}
      </div>
    </div>
  );
}

// ── Simple list — lane-grouped: sequence copy + the people in that lane ────────
function ListView({ data, seqByLane, armed, clientId, company }: { data: OutreachPayload; seqByLane: Record<string, OutreachSeq>; armed: boolean; clientId: string; company: string }) {
  const byCampaign = useMemo(() => {
    const m: Record<string, OutreachProspect[]> = {};
    data.prospects.forEach((p) => { (m[p.campaign_id] ||= []).push(p); });
    return m;
  }, [data]);

  if (data.campaigns.length === 0) {
    return <div className="co2-emptyline">No outreach campaigns for this client yet.</div>;
  }

  return (
    <div className="co3-lanes">
      {data.campaigns.map((c) => {
        const seq = c.lane_key ? seqByLane[c.lane_key] : undefined;
        const rows = byCampaign[c.id] || [];
        return (
          <div key={c.id} className="co3-lane">
            <div className="co3-lane-head">
              <div className="co3-lane-name">{c.name}</div>
              <div className="co3-lane-meta">
                <span className={`co3-badge ${c.is_active ? 'co3-badge--on' : ''}`}>{laneBadge(c)}</span>
                <span>{c.counts.total} {c.counts.total === 1 ? 'person' : 'people'}</span>
                {c.counts.gated > 0 && <span className="co3-gatecount">{c.counts.gated} name-gated</span>}
                {c.counts.messaged > 0 && <span>{c.counts.messaged} messaged</span>}
                {c.counts.awaiting_reply > 0 && <span>{c.counts.awaiting_reply} awaiting reply</span>}
              </div>
            </div>

            {/* The actual message copy that goes out on this lane */}
            {seq ? (
              <div className="co3-seq">
                <div className="co3-seq-cap">The messages, in order{seq.badge ? ` · ${seq.badge}` : ''}</div>
                {seq.gate && <div className="co3-flag">{seq.gate}</div>}
                {seq.steps.map((s, i) => <SeqStep key={i} step={s} />)}
              </div>
            ) : (
              <div className="co3-seq-none">Lane retired — no ratified sequence. These people are staged but there is no message set for them.</div>
            )}

            {/* The people in this lane */}
            {rows.length === 0 ? (
              <div className="co2-emptyline" style={{ padding: '0.8rem 0' }}>No one staged in this lane.</div>
            ) : (
              <div className="co3-people">
                {rows.map((p) => <ProspectRow key={p.id} p={p} armed={armed} clientId={clientId} company={company} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeqStep({ step }: { step: OutreachSeqStep }) {
  return (
    <div className="co3-step">
      <div className="co3-step-top">
        <span className="co3-step-label">{step.label || 'Step'}</span>
        {step.when && <span className="co3-step-when">{step.when}</span>}
      </div>
      {step.flag && <div className="co3-flag co3-flag--step">{step.flag}</div>}
      {step.text && <div className="co3-step-text">{step.text}</div>}
    </div>
  );
}

function ProspectRow({ p, armed, clientId, company }: { p: OutreachProspect; armed: boolean; clientId: string; company: string }) {
  const [open, setOpen] = useState(false);
  const hasCopy = !!(p.connection_note || p.offer_angle || (p.messages && p.messages.length));
  const gated = !!p.gate?.gated;
  return (
    <div className={`co3-prow ${open ? 'co3-prow--open' : ''}`}>
      <button className="co3-prow-main" onClick={() => setOpen((v) => !v)}>
        <IcpChip score={p.icp_score} />
        <span className="co3-pident">
          <span className="co3-pname">{p.name || '(unnamed)'}</span>
          <span className="co3-pmeta">{p.company || '—'}{p.headline ? ` · ${p.headline}` : ''}</span>
        </span>
        <span className="co3-ptags">
          <span className="co3-chan">{channelLabel(p)}</span>
          {gated && <span className="co3-gate">name-gated</span>}
          {p.blacklisted && <span className="co3-skip">blacklisted</span>}
          {p.needs_manual_reply && <span className="co3-reply">replied</span>}
          {!p.messaged && !gated && <span className="co3-notarmed">not sent</span>}
        </span>
        <span className="co3-caret" aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="co3-pdetail">
          {gated && p.gate && (
            <div className="co3-flag">
              Blocked until you OK the anchor name{p.gate.anchor_client ? ` (${p.gate.anchor_client})` : ''}. {p.gate.note}
            </div>
          )}
          {hasCopy ? (
            <>
              {p.connection_note && (
                <div className="co3-copy"><span className="co3-copy-l">Connection note</span><div className="co3-copy-t">{p.connection_note}</div></div>
              )}
              {p.offer_angle && (
                <div className="co3-copy"><span className="co3-copy-l">Offer angle</span><div className="co3-copy-t">{p.offer_angle}</div></div>
              )}
              {(p.messages || []).map((m, i) => (
                <div key={i} className={`co3-msg co3-msg--${m.direction}`}>
                  <div className="co3-msg-top">
                    <span>{m.direction === 'inbound' ? '← reply' : '→ sent'}{m.is_reaction ? ' (reaction)' : ''}</span>
                    <span>{m.type}{m.channel ? ` · ${m.channel}` : ''}{m.sent_at ? ` · ${fmtDate(m.sent_at)}` : ''}</span>
                  </div>
                  {m.text && <div className="co3-msg-text">{m.text}</div>}
                </div>
              ))}
            </>
          ) : (
            <div className="co3-copy-none">No per-person copy generated yet. This person gets the lane sequence above, filled from their real store and profile at send.</div>
          )}
          <SendComposer p={p} clientId={clientId} company={company} />
        </div>
      )}
    </div>
  );
}

// Operator send from the panel. Live now: the button is enabled and asks for a plain
// confirm before it fires. The real permission still lives server-side in
// operator_send_to_lead (gate + integration_config.operator_send_armed), so a stray
// click cannot dispatch on its own — the confirm is the operator's own guardrail.
function SendComposer({ p, clientId, company }: { p: OutreachProspect; clientId: string; company: string }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const channel = (p.preferred_channel || 'linkedin').toLowerCase().includes('inmail') ? 'inmail' : 'linkedin';
  const seat = company || clientId;

  const attempt = async () => {
    if (busy) return;
    if (!text.trim()) { setResult('Write the message first.'); return; }
    if (!window.confirm(`Send from ${seat}'s seat?`)) return;
    setBusy(true); setResult('');
    try {
      const { data, error } = await supabase.rpc('operator_send_to_lead', {
        p_gate: GATE, p_client_id: clientId, p_prospect_id: p.id, p_channel: channel, p_text: text,
      });
      const r = (data as { note?: string; error?: string }) || null;
      setResult(error?.message || r?.note || r?.error || 'No response.');
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <div className="co3-send">
      <div className="co3-send-head">
        <span className="co3-send-l">Send from {seat}'s seat</span>
        <span className="co3-send-state co3-send-state--armed">Live</span>
      </div>
      <textarea
        className="co3-send-ta"
        placeholder={`Message to ${p.name || 'this lead'} (${channel === 'inmail' ? 'InMail' : 'LinkedIn DM'})…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <div className="co3-send-row">
        <button className="co3-send-btn" disabled={busy} onClick={attempt} title="Send">
          {busy ? 'Sending…' : 'Send'}
        </button>
        {result && <span className="co3-send-note">{result}</span>}
      </div>
    </div>
  );
}

// ── Priority "waiting on response" ─────────────────────────────────────────────
function WaitingView({ needsReply, awaiting, armed }: {
  needsReply: OutreachProspect[]; awaiting: OutreachProspect[]; armed: boolean;
}) {
  if (needsReply.length === 0 && awaiting.length === 0) {
    return (
      <div className="co3-empty">
        <div className="co3-empty-h">Nothing waiting on a response.</div>
        <div className="co3-empty-note">
          {armed
            ? 'Every messaged lead has been answered. New sends land here the moment someone is messaged and has not replied.'
            : 'No sends have gone out yet. This queue fills once sending goes live: a lead shows here once a DM or InMail is sent and no reply has come back. Leads who reply jump to the top for your answer.'}
        </div>
      </div>
    );
  }
  return (
    <div className="co3-waiting">
      {needsReply.length > 0 && (
        <div className="co3-wgroup">
          <div className="co3-wgroup-h co3-wgroup-h--red">They replied · you owe them a reply ({needsReply.length})</div>
          {needsReply.map((p) => <WaitRow key={p.id} p={p} kind="reply" />)}
        </div>
      )}
      {awaiting.length > 0 && (
        <div className="co3-wgroup">
          <div className="co3-wgroup-h">Messaged · no reply yet ({awaiting.length}) · most recent first</div>
          {awaiting.map((p) => <WaitRow key={p.id} p={p} kind="await" />)}
        </div>
      )}
    </div>
  );
}

function WaitRow({ p, kind }: { p: OutreachProspect; kind: 'reply' | 'await' }) {
  const touch = kind === 'reply' ? p.last_reply_at : p.last_dm_sent_at;
  const lastInbound = kind === 'reply'
    ? [...(p.messages || [])].reverse().find((m) => m.direction === 'inbound' && !m.is_reaction)
    : undefined;
  return (
    <div className={`co3-wrow ${kind === 'reply' ? 'co3-wrow--reply' : ''}`}>
      <IcpChip score={p.icp_score} />
      <span className="co3-pident">
        <span className="co3-pname">{p.name || '(unnamed)'}</span>
        <span className="co3-pmeta">{p.company || '—'}</span>
      </span>
      {lastInbound?.text && <span className="co3-wreply" title={lastInbound.text}>“{lastInbound.text}”</span>}
      <span className="co3-wtouch">
        {kind === 'reply'
          ? `replied ${touch ? ageLabel(touch) + ' ago' : ''}`
          : `sent ${touch ? ageLabel(touch) + ' ago' : ''} · ${p.dm_count || 0} DM${p.dm_count === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

// ── Scoped styles (co3- prefix; Black Box v4 register under .ec) ──────────────
const CSS = `
.ec .co3-root { border-top:1px solid var(--ec-rule); padding-top:1.6rem; }
.ec .co3-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.9rem; }
.ec .co3-tabs { display:flex; align-items:center; gap:0.5rem; flex:0 0 auto; }
.ec .co3-tab { font-family:var(--ec-sans); font-weight:700; font-size:11px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-mutedc); background:var(--ec-paper); border:1px solid var(--ec-rule-strong); padding:0.32rem 0.7rem; cursor:pointer; transition:background 0.15s ease, color 0.15s ease; }
.ec .co3-tab:hover { background:rgba(19,18,16,0.04); }
.ec .co3-tab--on { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }

.ec .co3-armbanner { display:flex; align-items:flex-start; gap:0.55rem; font-family:var(--ec-sans); font-size:12px; line-height:1.5; color:var(--ec-body); background:rgba(19,18,16,0.04); border-left:3px solid var(--ec-ink); padding:0.7rem 0.9rem; margin-bottom:1.2rem; }
.ec .co3-armdot { width:8px; height:8px; border-radius:9999px; background:var(--ec-ink); flex:0 0 auto; margin-top:0.35rem; }

/* Lanes */
.ec .co3-lanes { display:flex; flex-direction:column; gap:2rem; }
.ec .co3-lane { border-top:3px solid var(--ec-ink); padding-top:0.8rem; }
.ec .co3-lane-head { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.7rem; }
.ec .co3-lane-name { font-family:var(--ec-sans); font-weight:700; font-size:16px; letter-spacing:-0.01em; color:var(--ec-ink); }
.ec .co3-lane-meta { display:flex; flex-wrap:wrap; gap:0.9rem; font-family:var(--ec-sans); font-size:11px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; align-items:baseline; }
.ec .co3-badge { font-weight:800; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); padding:0.12rem 0.4rem; }
.ec .co3-badge--on { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co3-gatecount { color:var(--ec-ink); font-weight:700; }

/* Sequence copy */
.ec .co3-seq { border-left:1px solid var(--ec-rule); padding-left:0.9rem; margin:0.4rem 0 1rem; display:flex; flex-direction:column; gap:0.7rem; }
.ec .co3-seq-cap { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-seq-none { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; color:var(--ec-mutedc); margin:0.3rem 0 1rem; }
.ec .co3-step { }
.ec .co3-step-top { display:flex; align-items:baseline; gap:0.7rem; margin-bottom:0.25rem; }
.ec .co3-step-label { font-family:var(--ec-sans); font-weight:700; font-size:10.5px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-ink); }
.ec .co3-step-when { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co3-step-text { font-family:var(--ec-sans); font-size:13.5px; line-height:1.55; color:var(--ec-body); white-space:pre-wrap; }
.ec .co3-flag { font-family:var(--ec-sans); font-size:11.5px; line-height:1.45; color:var(--ec-ink); background:rgba(19,18,16,0.05); border-left:2px solid var(--ec-ink); padding:0.4rem 0.6rem; }
.ec .co3-flag--step { margin:0.15rem 0 0.35rem; }

/* People */
.ec .co3-people { border-top:1px solid var(--ec-rule); }
.ec .co3-prow { border-bottom:1px solid var(--ec-rule); }
.ec .co3-prow-main { width:100%; display:flex; align-items:center; gap:0.8rem; padding:0.55rem 0.1rem; background:none; border:0; cursor:pointer; text-align:left; font:inherit; color:inherit; }
.ec .co3-prow-main:hover { background:rgba(19,18,16,0.025); }
.ec .co3-icp { font-family:var(--ec-sans); color:var(--ec-ink); border:1px solid var(--ec-rule-strong); padding:0.16rem 0.4rem; flex:0 0 auto; display:inline-flex; align-items:baseline; gap:0.28rem; min-width:52px; justify-content:center; }
.ec .co3-icp-l { font-weight:700; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-icp b { font-weight:800; font-size:13px; font-variant-numeric:tabular-nums; color:var(--ec-ink); }
.ec .co3-icp--low { color:var(--ec-mutedc); }
.ec .co3-pident { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:0.1rem; }
.ec .co3-pname { font-family:var(--ec-sans); font-size:13.5px; font-weight:600; color:var(--ec-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co3-pmeta { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mutedc); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co3-ptags { display:flex; align-items:center; gap:0.4rem; flex:0 0 auto; flex-wrap:wrap; justify-content:flex-end; }
.ec .co3-chan { font-family:var(--ec-sans); font-size:9.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-gate, .ec .co3-skip, .ec .co3-reply, .ec .co3-notarmed { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:0.12rem 0.4rem; }
.ec .co3-gate { color:var(--ec-paper); background:var(--ec-ink); }
.ec .co3-skip { color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); }
.ec .co3-reply { color:var(--ec-paper); background:var(--ec-red); }
.ec .co3-notarmed { color:var(--ec-mutedc); border:1px dashed var(--ec-rule-strong); }
.ec .co3-caret { font-family:var(--ec-sans); font-size:15px; color:var(--ec-mutedc); flex:0 0 auto; width:16px; text-align:center; }
.ec .co3-pdetail { padding:0.2rem 0.1rem 0.9rem 3.4rem; display:flex; flex-direction:column; gap:0.6rem; }
.ec .co3-copy { }
.ec .co3-copy-l { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-copy-t { font-family:var(--ec-sans); font-size:13px; line-height:1.55; color:var(--ec-body); white-space:pre-wrap; margin-top:0.15rem; }
.ec .co3-copy-none { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; line-height:1.5; color:var(--ec-mutedc); }
.ec .co3-msg { border-left:2px solid var(--ec-rule-strong); padding:0.2rem 0 0.2rem 0.6rem; }
.ec .co3-msg--inbound { border-left-color:var(--ec-ink); }
.ec .co3-msg-top { display:flex; justify-content:space-between; gap:0.8rem; font-family:var(--ec-sans); font-size:10px; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-msg-text { font-family:var(--ec-sans); font-size:13px; line-height:1.5; color:var(--ec-body); white-space:pre-wrap; margin-top:0.2rem; }

/* Operator send composer — gated + inert */
.ec .co3-send { margin-top:0.4rem; border-top:1px dashed var(--ec-rule-strong); padding-top:0.7rem; display:flex; flex-direction:column; gap:0.5rem; }
.ec .co3-send-head { display:flex; align-items:center; justify-content:space-between; gap:0.8rem; }
.ec .co3-send-l { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-send-state { font-family:var(--ec-sans); font-weight:800; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); border:1px dashed var(--ec-rule-strong); padding:0.12rem 0.4rem; }
.ec .co3-send-state--armed { color:var(--ec-paper); background:var(--ec-ink); border-style:solid; border-color:var(--ec-ink); }
.ec .co3-send-ta { width:100%; font-family:var(--ec-sans); font-size:12.5px; line-height:1.5; color:var(--ec-body); background:var(--ec-paper); border:1px solid var(--ec-rule-strong); padding:0.5rem 0.6rem; resize:vertical; }
.ec .co3-send-row { display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap; }
.ec .co3-send-btn { font-family:var(--ec-sans); font-weight:700; font-size:11px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-paper); background:var(--ec-ink); border:1px solid var(--ec-ink); padding:0.32rem 0.9rem; cursor:pointer; }
.ec .co3-send-btn:disabled { color:var(--ec-mutedc); background:var(--ec-paper); border:1px dashed var(--ec-rule-strong); cursor:not-allowed; }
.ec .co3-send-note { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; color:var(--ec-mutedc); }

/* Drafts waiting on you */
.ec .co3-tab--flag { border-color:var(--ec-ink); }
.ec .co3-tab--flag.co3-tab--on { background:var(--ec-red); border-color:var(--ec-red); }
.ec .co3-drafts { display:flex; flex-direction:column; gap:1rem; }
.ec .co3-drafts-note { font-family:var(--ec-sans); font-size:12px; line-height:1.5; color:var(--ec-body); background:rgba(19,18,16,0.04); border-left:3px solid var(--ec-ink); padding:0.6rem 0.8rem; }
.ec .co3-draft { border:1px solid var(--ec-rule-strong); border-left:3px solid var(--ec-ink); padding:0.8rem 0.9rem; display:flex; flex-direction:column; gap:0.6rem; }
.ec .co3-draft-top { display:flex; align-items:center; gap:0.8rem; }
.ec .co3-draft-tags { display:flex; align-items:center; gap:0.4rem; flex:0 0 auto; flex-wrap:wrap; justify-content:flex-end; }
.ec .co3-kind { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:0.14rem 0.42rem; color:var(--ec-paper); background:var(--ec-ink); }
.ec .co3-kind--reply { background:var(--ec-red); }
.ec .co3-kind--dm1 { color:var(--ec-mutedc); background:none; border:1px solid var(--ec-rule-strong); }
.ec .co3-scanchip { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:0.14rem 0.42rem; color:var(--ec-ink); border:1px solid var(--ec-ink); }
.ec .co3-trigger { border-left:2px solid var(--ec-ink); padding:0.1rem 0 0.1rem 0.6rem; }
.ec .co3-trigger-l { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co3-trigger-t { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; line-height:1.5; color:var(--ec-body); margin-top:0.15rem; }
.ec .co3-thread { display:flex; flex-direction:column; gap:0.4rem; }
.ec .co3-bubble { max-width:88%; padding:0.4rem 0.6rem; border-radius:9px; }
.ec .co3-bubble--in { align-self:flex-start; background:rgba(19,18,16,0.05); border:1px solid var(--ec-rule); border-bottom-left-radius:2px; }
.ec .co3-bubble--out { align-self:flex-end; background:var(--ec-paper); border:1px solid var(--ec-rule-strong); border-bottom-right-radius:2px; }
.ec .co3-bubble-who { display:block; font-family:var(--ec-sans); font-weight:700; font-size:9px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-mutedc); margin-bottom:0.12rem; }
.ec .co3-bubble-t { font-family:var(--ec-clinical); font-size:12.5px; line-height:1.5; color:var(--ec-body); white-space:pre-wrap; }
.ec .co3-draft-body { font-family:var(--ec-sans); font-size:13.5px; line-height:1.55; color:var(--ec-body); white-space:pre-wrap; background:var(--ec-paper); border:1px solid var(--ec-rule); padding:0.6rem 0.7rem; }
.ec .co3-draft-body--reply { border-left:3px solid var(--ec-ink); }
.ec .co3-draft-row { display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap; }
.ec .co3-draft-warn { font-family:var(--ec-clinical); font-style:italic; font-size:11px; color:var(--ec-mutedc); }

/* Waiting */
.ec .co3-empty { padding:2rem 0; }
.ec .co3-empty-h { font-family:var(--ec-sans); font-weight:700; font-size:15px; color:var(--ec-ink); margin-bottom:0.4rem; }
.ec .co3-empty-note { font-family:var(--ec-sans); font-size:12.5px; line-height:1.6; color:var(--ec-mutedc); max-width:560px; }
.ec .co3-waiting { display:flex; flex-direction:column; gap:1.6rem; }
.ec .co3-wgroup-h { font-family:var(--ec-sans); font-weight:700; font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); padding-bottom:0.4rem; border-bottom:1px solid var(--ec-rule-strong); margin-bottom:0.2rem; }
.ec .co3-wgroup-h--red { color:var(--ec-red); }
.ec .co3-wrow { display:flex; align-items:center; gap:0.8rem; padding:0.55rem 0.1rem; border-bottom:1px solid var(--ec-rule); }
.ec .co3-wrow--reply { background:rgba(190,30,30,0.03); }
.ec .co3-wreply { flex:1 1 auto; min-width:0; font-family:var(--ec-clinical); font-style:italic; font-size:12px; color:var(--ec-body); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co3-wtouch { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; flex:0 0 auto; }

@media (max-width:640px){
  .ec .co3-pdetail { padding-left:0.8rem; }
  .ec .co3-ptags { justify-content:flex-start; }
}
`;

export default OutreachView;
