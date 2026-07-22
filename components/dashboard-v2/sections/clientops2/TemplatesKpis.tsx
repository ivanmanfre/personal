import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { GATE, fmtDate } from './shared';

/**
 * Outreach templates + lane KPIs (W3) — one shared surface, two scopes:
 *
 *   clientId = null   → Ivan's own lanes (mounted in Outreach → Lanes & copy)
 *   clientId = 'x'    → that client's lanes (mounted in Client Ops → Outreach)
 *
 * TEMPLATES read/write the new `outreach_templates` table — the canonical copy
 * store seeded VERBATIM from the live n8n sender code nodes (Connection Request
 * Sender / DM Sequence / InMail Audit Sender). Honesty law: the senders still
 * ship their hardcoded copy until the read-through wiring is applied, so an
 * edit here flips the row to "staged" and the surface says so plainly. When
 * integration_config.outreach_templates_wired = 'true', edits read as live.
 *
 * KPIs derive per campaign from outreach_prospects timestamps via the gated
 * operator_outreach_lane_kpis RPC. Every figure is computed from real rows;
 * no data renders as an honest dash, never a placeholder. The single red on
 * this surface is the owed-replies count (the operator bottleneck).
 */

interface LaneKpis {
  staged: number; sent: number; sent_mtd: number; sent_7d: number;
  accepted: number; accept_rate: number | null;
  dm1: number; dm2: number; replied: number; reply_rate: number | null;
  needs_reply: number; last_send_at: string | null;
}
interface Lane { id: string; name: string; is_active: boolean; lane_key: string | null; kpis: LaneKpis }

interface Template {
  key: string; client_id: string | null; lane: string; step: string; label: string;
  body: string; subject: string | null;
  tokens: { token: string; fills: string }[];
  editable: boolean; in_rotation: boolean; source: string | null;
  live_synced: boolean; notes: string | null; updated_at: string;
  history: { at: string; prev_body: string }[];
}

const pctFmt = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const STEP_LABEL: Record<string, string> = {
  connection_note: 'Connection note', dm1: 'DM 1', dm2: 'DM 2', dm3: 'DM 3', inmail: 'InMail',
  email1: 'Email 1', email2: 'Email 2 (+3d)',
};

// ── Email lane status (Ivan scope only) ──────────────────────────────────────
// The Smartlead lane's send counts live in Smartlead (key can't ship in the
// bundle), so this card renders only what Supabase actually knows: leads loaded
// into the v2 campaign, Apollo supply counters, mirrored replies, and the
// feeder's latest all-skipped log line — the honest "is it moving" signal.
interface EmailStatus {
  campaign_id: string | null;
  loaded_ever: number; loaded_v2: number; loaded_7d: number;
  unlocks_today: { date: string; count: number } | null;
  imports_today: { date: string; count: number } | null;
  replies_30d: number;
  last_feeder_skip_at: string | null;
  last_feeder_skip: string;
}
export function EmailLaneCard() {
  const [st, setSt] = useState<EmailStatus | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc('operator_email_lane_status', { p_gate: GATE });
      if (err || (data && data.ok === false)) { setError(err?.message || data?.error || 'email status load failed'); return; }
      setSt(data as EmailStatus);
    })();
  }, []);
  if (error) return <div className="co2-err">{error}</div>;
  if (st == null) return <div className="ws-loading">Reading email lane…</div>;
  const skipErr = (st.last_feeder_skip.match(/"err":"([^"]+)"/) || [])[1];
  const stalled = st.loaded_7d === 0;
  return (
    <div className="co4-lane">
      <div className="co4-lane-head">
        <span className="co4-lane-name">Email — Cold (Agencies) · Smartlead {st.campaign_id || '?'}</span>
        <span className="co3-badge co3-badge--on">Armed</span>
      </div>
      <div className="co4-stats">
        <Stat label="In v2 campaign" v={st.loaded_v2} red={st.loaded_v2 === 0} />
        <Stat label="Loaded, 7d" v={st.loaded_7d} />
        <Stat label="Loaded ever" v={st.loaded_ever} sub="incl. old campaign" />
        <Stat label="Apollo unlocks today" v={st.unlocks_today?.count ?? 0} />
        <Stat label="Imports today" v={st.imports_today?.count ?? 0} />
        <Stat label="Email replies, 30d" v={st.replies_30d} sub="mostly autoresponders" />
      </div>
      {stalled && (
        <div className="co3-armbanner" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
          <span className="co3-armdot" aria-hidden />
          Campaign is armed but the feeder has loaded 0 leads: every run skips all its candidates
          {skipErr ? ` (latest skip reason: ${skipErr}` : ''}
          {st.last_feeder_skip_at ? `${skipErr ? ', ' : ' ('}${fmtDate(st.last_feeder_skip_at)})` : skipErr ? ')' : ''}.
          Supply keeps arriving from Apollo; personalization keeps rejecting it, so nothing sends.
        </div>
      )}
    </div>
  );
}

// ── Lane KPIs ────────────────────────────────────────────────────────────────
export function LaneKpisPanel({ clientId }: { clientId: string | null }) {
  const [lanes, setLanes] = useState<Lane[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.rpc('operator_outreach_lane_kpis', { p_gate: GATE, p_client_id: clientId });
    if (err || (data && data.ok === false)) { setError(err?.message || data?.error || 'KPI load failed'); return; }
    setLanes((data?.lanes || []) as Lane[]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="co2-err">{error}</div>;
  if (lanes == null) return <div className="ws-loading">Reading lane numbers…</div>;
  if (lanes.length === 0) return <div className="co2-emptyline">No campaigns in this scope yet.</div>;

  return (
    <div className="co4-kpis">
      <style>{CSS}</style>
      {lanes.map((l) => <LaneRow key={l.id} lane={l} />)}
      <div className="co4-legend">
        Accept % = accepted / invites sent, all-time for the lane. Reply % = prospects who replied / prospects DM'd.
        Every figure is computed from the lane's real prospect rows at load.
      </div>
    </div>
  );
}

function LaneRow({ lane }: { lane: Lane }) {
  const k = lane.kpis;
  const noSends = k.sent === 0;
  return (
    <div className="co4-lane">
      <div className="co4-lane-head">
        <span className="co4-lane-name">{lane.name}</span>
        <span className={`co3-badge ${lane.is_active ? 'co3-badge--on' : ''}`}>{lane.is_active ? 'Live' : 'Sending paused'}</span>
        {k.last_send_at && <span className="co4-lastsend">last send {fmtDate(k.last_send_at)}</span>}
      </div>
      {noSends ? (
        <div className="co4-nosends">{k.staged > 0 ? `${k.staged} staged, nothing sent yet.` : 'Nothing staged, nothing sent.'}</div>
      ) : (
        <div className="co4-stats">
          <Stat label="Staged" v={k.staged} />
          <Stat label="Invites sent" v={k.sent} sub={`${k.sent_7d} this week`} />
          <Stat label="Accepted" v={k.accepted} sub={pctFmt(k.accept_rate)} />
          <Stat label="DM 1" v={k.dm1} sub={k.dm2 > 0 ? `${k.dm2} on DM 2` : undefined} />
          <Stat label="Replied" v={k.replied} sub={pctFmt(k.reply_rate)} />
          <Stat label="Owe a reply" v={k.needs_reply} red={k.needs_reply > 0} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, sub, red }: { label: string; v: number; sub?: string; red?: boolean }) {
  return (
    <div className="co4-stat">
      <span className="co4-stat-l">{label}</span>
      <span className={`co4-stat-v ${red ? 'co4-stat-v--red' : ''}`}>{v}</span>
      {sub && <span className="co4-stat-sub">{sub}</span>}
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────────────────────
export function TemplatesPanel({ clientId }: { clientId: string | null }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [wired, setWired] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.rpc('operator_outreach_templates', { p_gate: GATE, p_client_id: clientId });
    if (err || (data && data.ok === false)) { setError(err?.message || data?.error || 'templates load failed'); return; }
    setWired(!!data?.wired);
    setTemplates((data?.templates || []) as Template[]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const byLane = useMemo(() => {
    const m: Record<string, Template[]> = {};
    (templates || []).forEach((t) => { (m[t.lane] ||= []).push(t); });
    // Notes → DMs → InMail inside each lane
    const order = ['connection_note', 'dm1', 'dm2', 'dm3', 'inmail'];
    Object.values(m).forEach((arr) => arr.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step)));
    return m;
  }, [templates]);

  if (error) return <div className="co2-err">{error}</div>;
  if (templates == null) return <div className="ws-loading">Loading templates…</div>;
  if (templates.length === 0) return <div className="co2-emptyline">No templates registered for this scope.</div>;

  return (
    <div className="co4-tpls">
      <style>{CSS}</style>
      <div className="co3-armbanner">
        <span className="co3-armdot" aria-hidden />
        {wired
          ? 'The senders read this copy live: a saved edit ships on the next send.'
          : 'This is the exact copy the senders ship today, pulled verbatim from the live n8n nodes. Edits save here as STAGED: the sender keeps shipping the previous copy until the read-through wiring is applied (one gated n8n change, spec ready).'}
      </div>
      {Object.entries(byLane).map(([lane, rows]) => (
        <div key={lane} className="co4-group">
          <div className="co4-group-h">{lane}</div>
          {rows.map((t) => <TemplateCard key={t.key} t={t} wired={wired} onSaved={load} />)}
        </div>
      ))}
    </div>
  );
}

function TemplateCard({ t, wired, onSaved }: { t: Template; wired: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { setDraft(t.body); }, [t.body]);

  const isNote = t.step === 'connection_note';
  const overCap = isNote && draft.length > 200;
  const hasEmDash = /—/.test(draft);

  const save = async () => {
    if (busy || draft === t.body) { setEditing(false); return; }
    setBusy(true); setNote('');
    const { data, error } = await supabase.rpc('operator_edit_outreach_template', { p_gate: GATE, p_key: t.key, p_body: draft });
    setBusy(false);
    if (error || (data && data.ok === false)) { setNote(error?.message || data?.error || 'save failed'); return; }
    setEditing(false);
    setNote(wired ? 'Saved. Ships on the next send.' : 'Saved as staged.');
    onSaved();
  };

  const status = !t.editable ? null
    : wired ? { cls: 'co4-st--live', text: 'Live' }
    : t.live_synced ? { cls: 'co4-st--live', text: 'Live in sender' }
    : { cls: 'co4-st--staged', text: 'Edited, staged: not sending yet' };

  return (
    <div className="co4-tpl">
      <div className="co4-tpl-top">
        <span className="co4-tpl-label">{t.label}</span>
        <span className="co4-tpl-tags">
          <span className="co4-chip">{STEP_LABEL[t.step] || t.step}</span>
          {!t.in_rotation && <span className="co4-chip co4-chip--dim">not in rotation</span>}
          {status && <span className={`co4-st ${status.cls}`}>{status.text}</span>}
          <span className="co4-key">{t.key}</span>
        </span>
      </div>
      {t.subject && <div className="co4-subject">Subject: {t.subject}</div>}
      {editing ? (
        <>
          <textarea className="co3-draft-edit" rows={Math.max(3, draft.split('\n').length + 1)} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="co4-editrow">
            {isNote && <span className={`co4-count ${overCap ? 'co4-count--over' : ''}`}>{draft.length}/200{overCap ? ' — the sender truncates over 200' : ''}</span>}
            {hasEmDash && <span className="co4-count co4-count--over">em dash in copy — house rule is zero</span>}
            <button className="co3-edit-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="co3-edit-btn" disabled={busy} onClick={() => { setDraft(t.body); setEditing(false); setNote(''); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="co4-body" onDoubleClick={() => t.editable && setEditing(true)}>{t.body}</div>
      )}
      {t.tokens.length > 0 && (
        <div className="co4-tokens">
          {t.tokens.map((tk) => <span key={tk.token} className="co4-token">{'{' + tk.token + '}'} <i>{tk.fills}</i></span>)}
        </div>
      )}
      {t.notes && <div className="co4-notes">{t.notes}</div>}
      <div className="co4-foot">
        {t.editable ? (
          !editing && <button className="co3-edit-btn" onClick={() => setEditing(true)}>Edit copy</button>
        ) : (
          <span className="co4-noedit">Not directly editable: this one is composed per prospect at send time.</span>
        )}
        {t.history.length > 0 && <span className="co4-hist">{t.history.length} previous {t.history.length === 1 ? 'version' : 'versions'}</span>}
        {note && <span className="co3-send-note">{note}</span>}
      </div>
    </div>
  );
}

// ── Combined tab body (KPIs on top, templates under) ─────────────────────────
export function TemplatesKpisView({ clientId }: { clientId: string | null }) {
  return (
    <div className="co4-root">
      <style>{CSS}</style>
      <div className="ec-kicker" style={{ marginBottom: '0.7rem' }}>How each lane is doing — real prospect rows, all-time</div>
      <LaneKpisPanel clientId={clientId} />
      {clientId == null && (
        <div style={{ marginTop: '1.1rem' }}>
          <EmailLaneCard />
        </div>
      )}
      <div className="ec-kicker" style={{ margin: '1.8rem 0 0.7rem' }}>The copy each lane sends</div>
      <TemplatesPanel clientId={clientId} />
    </div>
  );
}

// ── Scoped styles (co4- prefix; Black Box v4 register under .ec) ──────────────
const CSS = `
/* co3 classes reused here, redefined locally: the WarmPipeline mount renders
   without OutreachView's scoped <style>, so these must not depend on it. */
.ec .co3-badge { font-family:var(--ec-sans); font-weight:800; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); padding:0.12rem 0.4rem; }
.ec .co3-badge--on { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co3-armbanner { display:flex; align-items:flex-start; gap:0.55rem; font-family:var(--ec-sans); font-size:12px; line-height:1.5; color:var(--ec-body); background:rgba(19,18,16,0.04); border-left:3px solid var(--ec-ink); padding:0.7rem 0.9rem; margin-bottom:1.2rem; }
.ec .co3-armdot { width:8px; height:8px; background:var(--ec-ink); flex:0 0 auto; margin-top:0.35rem; }
.ec .co3-draft-edit { width:100%; box-sizing:border-box; font-family:var(--ec-sans); font-size:13.5px; line-height:1.55; color:var(--ec-ink); background:#fff; border:1px solid var(--ec-ink); border-left:3px solid var(--ec-ink); padding:0.6rem 0.7rem; resize:vertical; }
.ec .co3-draft-edit:focus { outline:none; box-shadow:inset 0 0 0 1px var(--ec-ink); }
.ec .co3-edit-btn { font-family:var(--ec-sans); font-size:12px; font-weight:600; color:var(--ec-ink); background:transparent; border:1px solid var(--ec-rule-strong); padding:0.4rem 0.7rem; cursor:pointer; }
.ec .co3-edit-btn:hover { background:rgba(19,18,16,0.05); }
.ec .co3-edit-btn:disabled { opacity:0.5; cursor:default; }
.ec .co3-send-note { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; color:var(--ec-mutedc); }

.ec .co4-root { }
.ec .co4-kpis { display:flex; flex-direction:column; gap:1.1rem; }
.ec .co4-lane { border-top:3px solid var(--ec-ink); padding-top:0.55rem; }
.ec .co4-lane-head { display:flex; align-items:baseline; gap:0.8rem; flex-wrap:wrap; margin-bottom:0.55rem; }
.ec .co4-lane-name { font-family:var(--ec-sans); font-weight:700; font-size:14.5px; letter-spacing:-0.01em; color:var(--ec-ink); }
.ec .co4-lastsend { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-nosends { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; color:var(--ec-mutedc); padding-bottom:0.4rem; }
.ec .co4-stats { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:0.6rem; padding-bottom:0.4rem; }
.ec .co4-stat { display:flex; flex-direction:column; gap:0.12rem; border-left:1px solid var(--ec-rule); padding-left:0.6rem; }
.ec .co4-stat:first-child { border-left:0; padding-left:0; }
.ec .co4-stat-l { font-family:var(--ec-sans); font-weight:700; font-size:9px; letter-spacing:0.07em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co4-stat-v { font-family:var(--ec-sans); font-weight:800; font-size:20px; letter-spacing:-0.02em; color:var(--ec-ink); font-variant-numeric:tabular-nums; line-height:1.1; }
.ec .co4-stat-v--red { color:var(--ec-red); }
.ec .co4-stat-sub { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-legend { font-family:var(--ec-clinical); font-style:italic; font-size:11px; line-height:1.5; color:var(--ec-mutedc); border-top:1px solid var(--ec-rule); padding-top:0.5rem; }

.ec .co4-tpls { display:flex; flex-direction:column; gap:1.4rem; }
.ec .co4-group { }
.ec .co4-group-h { font-family:var(--ec-sans); font-weight:700; font-size:10.5px; letter-spacing:0.07em; text-transform:uppercase; color:var(--ec-ink); border-bottom:1px solid var(--ec-rule-strong); padding-bottom:0.3rem; margin-bottom:0.7rem; }
.ec .co4-tpl { border:1px solid var(--ec-rule); border-left:3px solid var(--ec-ink); padding:0.7rem 0.85rem; margin-bottom:0.7rem; display:flex; flex-direction:column; gap:0.5rem; }
.ec .co4-tpl-top { display:flex; align-items:baseline; justify-content:space-between; gap:0.8rem; flex-wrap:wrap; }
.ec .co4-tpl-label { font-family:var(--ec-sans); font-weight:700; font-size:13px; color:var(--ec-ink); }
.ec .co4-tpl-tags { display:flex; align-items:baseline; gap:0.45rem; flex-wrap:wrap; }
.ec .co4-chip { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-ink); border:1px solid var(--ec-rule-strong); padding:0.12rem 0.4rem; }
.ec .co4-chip--dim { color:var(--ec-mutedc); border-style:dashed; }
.ec .co4-st { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:0.12rem 0.4rem; }
.ec .co4-st--live { color:var(--ec-paper); background:var(--ec-ink); }
.ec .co4-st--staged { color:var(--ec-ink); border:1px dashed var(--ec-ink); }
.ec .co4-key { font-family:'Courier Prime', ui-monospace, monospace; font-size:10.5px; color:var(--ec-mutedc); }
.ec .co4-subject { font-family:var(--ec-sans); font-weight:600; font-size:12px; color:var(--ec-body); }
.ec .co4-body { font-family:var(--ec-sans); font-size:13.5px; line-height:1.55; color:var(--ec-body); white-space:pre-wrap; }
.ec .co4-editrow { display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap; }
.ec .co4-count { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-count--over { color:var(--ec-red); font-weight:700; }
.ec .co4-tokens { display:flex; flex-direction:column; gap:0.15rem; border-left:1px solid var(--ec-rule); padding-left:0.6rem; }
.ec .co4-token { font-family:'Courier Prime', ui-monospace, monospace; font-size:10.5px; color:var(--ec-mutedc); }
.ec .co4-token i { font-family:var(--ec-clinical); font-size:10.5px; }
.ec .co4-notes { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; line-height:1.5; color:var(--ec-mutedc); }
.ec .co4-foot { display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap; }
.ec .co4-noedit { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; color:var(--ec-mutedc); }
.ec .co4-hist { font-family:var(--ec-sans); font-size:10px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }

@media (max-width:760px){
  .ec .co4-stats { grid-template-columns:repeat(3, minmax(0,1fr)); row-gap:0.9rem; }
  .ec .co4-stat:nth-child(4) { border-left:0; padding-left:0; }
}
`;

export default TemplatesKpisView;
