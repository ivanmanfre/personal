import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { GATE, fmtDate } from './shared';

/**
 * Outreach templates + lane KPIs (W3) — one shared surface, two scopes:
 *
 *   clientId = null   → Ivan's own lanes (mounted in Outreach → Lanes & copy)
 *   clientId = 'x'    → that client's lanes (mounted in Client Ops → Outreach)
 *
 * Round-2 layout (Ivan 07-22): lanes render as a GRID of compact cards, active
 * lanes only by default (paused behind a counted toggle), template bodies
 * collapsed to a one-line preview until opened. Benched rotation variants and
 * paused-lane noise stay one click away instead of stacking a huge list.
 *
 * TEMPLATES read/write `outreach_templates` — seeded VERBATIM from the live n8n
 * sender nodes. Honesty law: senders ship their hardcoded copy until the
 * read-through wiring is applied; an edit flips the row to "staged" and the
 * surface says so. When integration_config.outreach_templates_wired = 'true',
 * edits read as live.
 *
 * KPIs derive per campaign from real outreach_prospects rows (gated RPC). No
 * data renders as an honest empty line, never a placeholder. The single red on
 * this surface is the owed-replies count.
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
  connection_note: 'Note', dm1: 'DM 1', dm2: 'DM 2', dm3: 'DM 3', inmail: 'InMail',
  email1: 'Email 1', email2: 'Email 2',
};

// ── Email lane status (Ivan scope only) ──────────────────────────────────────
// Smartlead's own send counts live behind its API key (can't ship in the
// bundle), so this card renders only what Supabase knows: leads loaded, Apollo
// supply counters, mirrored replies, and the feeder's latest all-skipped log
// line — the honest "is it moving" signal.
interface EmailStatus {
  campaign_id: string | null;
  loaded_ever: number; loaded_v2: number; loaded_7d: number;
  unlocks_today: { date: string; count: number } | null;
  imports_today: { date: string; count: number } | null;
  replies_30d: number;
  last_feeder_skip_at: string | null;
  last_feeder_skip: string;
}
function EmailLaneCard() {
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
  if (st == null) return <div className="co4-card"><div className="ws-loading">Reading email lane…</div></div>;
  const stalled = st.loaded_7d === 0;
  return (
    <div className="co4-card">
      <div className="co4-card-head">
        <span className="co4-card-name">Email — Cold (Smartlead {st.campaign_id || '?'})</span>
        <span className="co3-badge co3-badge--on">Armed</span>
      </div>
      <div className="co4-grid3">
        <Stat label="In campaign" v={st.loaded_v2} red={st.loaded_v2 === 0} />
        <Stat label="Loaded 7d" v={st.loaded_7d} />
        <Stat label="Replies 30d" v={st.replies_30d} />
        <Stat label="Unlocks today" v={st.unlocks_today?.count ?? 0} />
        <Stat label="Imports today" v={st.imports_today?.count ?? 0} />
        <Stat label="Loaded ever" v={st.loaded_ever} />
      </div>
      {stalled && (
        <div className="co4-stall">
          Armed but the feeder loaded 0 leads this week: every run skipped its whole batch
          {st.last_feeder_skip_at ? ` (last ${fmtDate(st.last_feeder_skip_at)})` : ''}. Supply keeps
          arriving; personalization keeps rejecting it.
        </div>
      )}
    </div>
  );
}

// ── Lane KPIs — grid of compact cards, active first ──────────────────────────
export function LaneKpisPanel({ clientId }: { clientId: string | null }) {
  const [lanes, setLanes] = useState<Lane[] | null>(null);
  const [error, setError] = useState('');
  const [showPaused, setShowPaused] = useState(false);
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

  const active = lanes.filter((l) => l.is_active);
  const paused = lanes.filter((l) => !l.is_active);

  return (
    <div>
      <div className="co4-cards">
        {active.map((l) => <LaneCard key={l.id} lane={l} />)}
        {clientId == null && <EmailLaneCard />}
        {active.length === 0 && <div className="co2-emptyline">No lane is sending right now.</div>}
      </div>
      {paused.length > 0 && (
        <div className="co4-pausedwrap">
          <button className="co4-fold" onClick={() => setShowPaused((v) => !v)}>
            {showPaused ? '− Hide' : '+ Show'} paused lanes ({paused.length})
          </button>
          {showPaused && (
            <div className="co4-cards" style={{ marginTop: '0.7rem' }}>
              {paused.map((l) => <LaneCard key={l.id} lane={l} />)}
            </div>
          )}
        </div>
      )}
      <div className="co4-legend">
        Accept % = accepted / invites sent, all-time. Reply % = replied / DM'd. Real prospect rows at load.
      </div>
    </div>
  );
}

function LaneCard({ lane }: { lane: Lane }) {
  const k = lane.kpis;
  const noSends = k.sent === 0;
  return (
    <div className="co4-card">
      <div className="co4-card-head">
        <span className="co4-card-name">{lane.name}</span>
        <span className={`co3-badge ${lane.is_active ? 'co3-badge--on' : ''}`}>{lane.is_active ? 'Live' : 'Paused'}</span>
      </div>
      {noSends ? (
        <div className="co4-nosends">{k.staged > 0 ? `${k.staged} staged, nothing sent yet.` : 'Nothing staged, nothing sent.'}</div>
      ) : (
        <div className="co4-grid3">
          <Stat label="Sent" v={k.sent} sub={`${k.sent_7d} this wk`} />
          <Stat label="Accepted" v={k.accepted} sub={pctFmt(k.accept_rate)} />
          <Stat label="Replied" v={k.replied} sub={pctFmt(k.reply_rate)} />
          <Stat label="Staged" v={k.staged} />
          <Stat label="DM 1" v={k.dm1} sub={k.dm2 > 0 ? `${k.dm2} DM 2` : undefined} />
          <Stat label="Owe reply" v={k.needs_reply} red={k.needs_reply > 0} />
        </div>
      )}
      {k.last_send_at && <div className="co4-lastsend">last send {fmtDate(k.last_send_at)}</div>}
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

// ── Templates — lane columns, collapsed rows ─────────────────────────────────
export function TemplatesPanel({ clientId }: { clientId: string | null }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [wired, setWired] = useState(false);
  const [error, setError] = useState('');
  const [showBenched, setShowBenched] = useState(false);
  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.rpc('operator_outreach_templates', { p_gate: GATE, p_client_id: clientId });
    if (err || (data && data.ok === false)) { setError(err?.message || data?.error || 'templates load failed'); return; }
    setWired(!!data?.wired);
    setTemplates((data?.templates || []) as Template[]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const benchedCount = useMemo(() => (templates || []).filter((t) => !t.in_rotation).length, [templates]);
  const byLane = useMemo(() => {
    const m: Record<string, Template[]> = {};
    (templates || []).filter((t) => showBenched || t.in_rotation).forEach((t) => { (m[t.lane] ||= []).push(t); });
    const order = ['connection_note', 'dm1', 'dm2', 'dm3', 'inmail', 'email1', 'email2'];
    Object.values(m).forEach((arr) => arr.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step)));
    return m;
  }, [templates, showBenched]);

  if (error) return <div className="co2-err">{error}</div>;
  if (templates == null) return <div className="ws-loading">Loading templates…</div>;
  if (templates.length === 0) return <div className="co2-emptyline">No templates registered for this scope.</div>;

  return (
    <div>
      <div className="co4-tplbar">
        <span className="co4-tplnote">
          {wired
            ? 'Senders read this copy live: a saved edit ships on the next send.'
            : 'Exact copy the senders ship today, verbatim from the live n8n nodes. Edits save as STAGED until the read-through wiring is applied.'}
        </span>
        {benchedCount > 0 && (
          <button className="co4-fold" onClick={() => setShowBenched((v) => !v)}>
            {showBenched ? '− Hide' : '+ Show'} benched variants ({benchedCount})
          </button>
        )}
      </div>
      <div className="co4-lanecols">
        {Object.entries(byLane).map(([lane, rows]) => (
          <div key={lane} className="co4-lanecol">
            <div className="co4-group-h">{lane}</div>
            {rows.map((t) => <TemplateRow key={t.key} t={t} wired={wired} onSaved={load} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateRow({ t, wired, onSaved }: { t: Template; wired: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { setDraft(t.body); }, [t.body]);

  const isNote = t.step === 'connection_note';
  const overCap = isNote && draft.length > 200;
  const hasEmDash = /—/.test(draft);
  const staged = t.editable && !wired && !t.live_synced;

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

  return (
    <div className={`co4-tpl ${open ? 'co4-tpl--open' : ''}`}>
      <button className="co4-tpl-row" onClick={() => setOpen((v) => !v)}>
        <span className="co4-chip">{STEP_LABEL[t.step] || t.step}</span>
        <span className="co4-tpl-main">
          <span className="co4-tpl-label">{t.label}</span>
          {!open && <span className="co4-tpl-preview">{t.body.replace(/\s+/g, ' ').slice(0, 90)}…</span>}
        </span>
        {staged && <span className="co4-dot" title="Edited, staged: not sending yet" aria-hidden />}
        <span className="co4-caret" aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="co4-tpl-detail">
          {t.subject && <div className="co4-subject">Subject: {t.subject}</div>}
          {editing ? (
            <>
              <textarea className="co3-draft-edit" rows={Math.max(3, draft.split('\n').length + 1)} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="co4-editrow">
                {isNote && <span className={`co4-count ${overCap ? 'co4-count--over' : ''}`}>{draft.length}/200{overCap ? ' — sender truncates over 200' : ''}</span>}
                {hasEmDash && <span className="co4-count co4-count--over">em dash in copy: house rule is zero</span>}
                <button className="co3-edit-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
                <button className="co3-edit-btn" disabled={busy} onClick={() => { setDraft(t.body); setEditing(false); setNote(''); }}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="co4-body">{t.body}</div>
          )}
          {t.tokens.length > 0 && (
            <div className="co4-tokens">
              {t.tokens.map((tk) => <span key={tk.token} className="co4-token">{'{' + tk.token + '}'} <i>{tk.fills}</i></span>)}
            </div>
          )}
          {t.notes && <div className="co4-notes">{t.notes}</div>}
          <div className="co4-foot">
            {t.editable ? (
              <>
                {!editing && <button className="co3-edit-btn" onClick={() => setEditing(true)}>Edit copy</button>}
                <span className={`co4-st ${staged ? 'co4-st--staged' : 'co4-st--live'}`}>
                  {staged ? 'Edited, staged: not sending yet' : wired ? 'Live' : 'Live in sender'}
                </span>
              </>
            ) : (
              <span className="co4-noedit">Composed per prospect at send time.</span>
            )}
            {t.history.length > 0 && <span className="co4-hist">{t.history.length} previous {t.history.length === 1 ? 'version' : 'versions'}</span>}
            {note && <span className="co3-send-note">{note}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Combined tab body ────────────────────────────────────────────────────────
export function TemplatesKpisView({ clientId }: { clientId: string | null }) {
  return (
    <div className="co4-root">
      <style>{CSS}</style>
      <div className="ec-kicker" style={{ marginBottom: '0.7rem' }}>How each live lane is doing</div>
      <LaneKpisPanel clientId={clientId} />
      <div className="ec-kicker" style={{ margin: '1.8rem 0 0.7rem' }}>The copy each lane sends</div>
      <TemplatesPanel clientId={clientId} />
    </div>
  );
}

// ── Scoped styles (co4- prefix; Black Box v4 register under .ec) ──────────────
const CSS = `
/* co3 classes reused here, redefined locally: this surface also mounts outside
   OutreachView's scoped <style>, so it must not depend on it. */
.ec .co3-badge { font-family:var(--ec-sans); font-weight:800; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); padding:0.1rem 0.35rem; flex:0 0 auto; }
.ec .co3-badge--on { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co3-draft-edit { width:100%; box-sizing:border-box; font-family:var(--ec-sans); font-size:13px; line-height:1.55; color:var(--ec-ink); background:#fff; border:1px solid var(--ec-ink); border-left:3px solid var(--ec-ink); padding:0.6rem 0.7rem; resize:vertical; }
.ec .co3-draft-edit:focus { outline:none; box-shadow:inset 0 0 0 1px var(--ec-ink); }
.ec .co3-edit-btn { font-family:var(--ec-sans); font-size:11.5px; font-weight:600; color:var(--ec-ink); background:transparent; border:1px solid var(--ec-rule-strong); padding:0.32rem 0.65rem; cursor:pointer; }
.ec .co3-edit-btn:hover { background:rgba(19,18,16,0.05); }
.ec .co3-edit-btn:disabled { opacity:0.5; cursor:default; }
.ec .co3-send-note { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; color:var(--ec-mutedc); }

/* KPI cards */
.ec .co4-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:0.8rem; }
.ec .co4-card { border:1px solid var(--ec-rule); border-top:3px solid var(--ec-ink); padding:0.65rem 0.8rem 0.6rem; display:flex; flex-direction:column; gap:0.55rem; }
.ec .co4-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:0.6rem; }
.ec .co4-card-name { font-family:var(--ec-sans); font-weight:700; font-size:13px; letter-spacing:-0.01em; color:var(--ec-ink); line-height:1.25; }
.ec .co4-grid3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:0.55rem 0.6rem; }
.ec .co4-stat { display:flex; flex-direction:column; gap:0.1rem; }
.ec .co4-stat-l { font-family:var(--ec-sans); font-weight:700; font-size:8.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co4-stat-v { font-family:var(--ec-sans); font-weight:800; font-size:17px; letter-spacing:-0.02em; color:var(--ec-ink); font-variant-numeric:tabular-nums; line-height:1.1; }
.ec .co4-stat-v--red { color:var(--ec-red); }
.ec .co4-stat-sub { font-family:var(--ec-sans); font-size:9.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-nosends { font-family:var(--ec-clinical); font-style:italic; font-size:12px; color:var(--ec-mutedc); }
.ec .co4-lastsend { font-family:var(--ec-sans); font-size:9.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-stall { font-family:var(--ec-sans); font-size:11px; line-height:1.45; color:var(--ec-ink); background:rgba(19,18,16,0.04); border-left:2px solid var(--ec-ink); padding:0.4rem 0.55rem; }
.ec .co4-pausedwrap { margin-top:0.8rem; }
.ec .co4-fold { font-family:var(--ec-sans); font-weight:700; font-size:10.5px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-mutedc); background:none; border:0; border-bottom:1px dashed var(--ec-rule-strong); padding:0 0 0.1rem; cursor:pointer; }
.ec .co4-fold:hover { color:var(--ec-ink); }
.ec .co4-legend { font-family:var(--ec-clinical); font-style:italic; font-size:10.5px; line-height:1.5; color:var(--ec-mutedc); border-top:1px solid var(--ec-rule); padding-top:0.45rem; margin-top:0.9rem; }

/* Template lane columns */
.ec .co4-tplbar { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.8rem; }
.ec .co4-tplnote { font-family:var(--ec-sans); font-size:11.5px; line-height:1.5; color:var(--ec-body); max-width:640px; }
.ec .co4-lanecols { display:grid; grid-template-columns:repeat(auto-fill, minmax(330px, 1fr)); gap:1rem; align-items:start; }
.ec .co4-lanecol { border:1px solid var(--ec-rule); padding:0.6rem 0.7rem; }
.ec .co4-group-h { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.07em; text-transform:uppercase; color:var(--ec-ink); border-bottom:1px solid var(--ec-rule-strong); padding-bottom:0.3rem; margin-bottom:0.45rem; }
.ec .co4-tpl { border-bottom:1px solid var(--ec-rule); }
.ec .co4-tpl:last-child { border-bottom:0; }
.ec .co4-tpl-row { width:100%; display:flex; align-items:center; gap:0.5rem; padding:0.45rem 0; background:none; border:0; cursor:pointer; text-align:left; font:inherit; color:inherit; }
.ec .co4-tpl-row:hover { background:rgba(19,18,16,0.025); }
.ec .co4-tpl-main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:0.08rem; }
.ec .co4-tpl-label { font-family:var(--ec-sans); font-weight:600; font-size:12px; color:var(--ec-ink); }
.ec .co4-tpl-preview { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co4-chip { font-family:var(--ec-sans); font-size:8.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-ink); border:1px solid var(--ec-rule-strong); padding:0.1rem 0.3rem; flex:0 0 auto; min-width:38px; text-align:center; }
.ec .co4-dot { width:7px; height:7px; background:var(--ec-ink); flex:0 0 auto; }
.ec .co4-caret { font-family:var(--ec-sans); font-size:13px; color:var(--ec-mutedc); flex:0 0 auto; width:12px; text-align:center; }
.ec .co4-tpl-detail { padding:0.15rem 0 0.7rem; display:flex; flex-direction:column; gap:0.5rem; }
.ec .co4-subject { font-family:var(--ec-sans); font-weight:600; font-size:11.5px; color:var(--ec-body); }
.ec .co4-body { font-family:var(--ec-sans); font-size:12.5px; line-height:1.55; color:var(--ec-body); white-space:pre-wrap; }
.ec .co4-editrow { display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap; }
.ec .co4-count { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }
.ec .co4-count--over { color:var(--ec-red); font-weight:700; }
.ec .co4-tokens { display:flex; flex-direction:column; gap:0.12rem; border-left:1px solid var(--ec-rule); padding-left:0.55rem; }
.ec .co4-token { font-family:'Courier Prime', ui-monospace, monospace; font-size:10px; color:var(--ec-mutedc); }
.ec .co4-token i { font-family:var(--ec-clinical); font-size:10px; }
.ec .co4-notes { font-family:var(--ec-clinical); font-style:italic; font-size:11px; line-height:1.5; color:var(--ec-mutedc); }
.ec .co4-foot { display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap; }
.ec .co4-st { font-family:var(--ec-sans); font-size:9px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:0.1rem 0.35rem; }
.ec .co4-st--live { color:var(--ec-paper); background:var(--ec-ink); }
.ec .co4-st--staged { color:var(--ec-ink); border:1px dashed var(--ec-ink); }
.ec .co4-noedit { font-family:var(--ec-clinical); font-style:italic; font-size:11px; color:var(--ec-mutedc); }
.ec .co4-hist { font-family:var(--ec-sans); font-size:9.5px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; }

@media (max-width:640px){
  .ec .co4-cards, .ec .co4-lanecols { grid-template-columns:1fr; }
}
`;

export default TemplatesKpisView;
