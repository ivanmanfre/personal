import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useWarmPipeline } from '../../../lib/useCockpitData';
import '../editorial-cockpit.css';
import './worksurface.css';
import './outreachsurface.css';

/**
 * Outreach work surface (Wave 2, Direction B) — the founder's "replies waiting
 * for me, better formatted" ask made first-class.
 *
 *  DESK (default) — a formatted replies-waiting queue at the top, the one number
 *    the whole surface exists to move (REPLIES WAITING, the composition's single
 *    red). Below it, the follow-up drafts approval queue relocated from the now
 *    dead Warm section (followup_drafts pending), preserving its exact read-only,
 *    approval-NOT-armed gating. A subtle latest-reply hero leads the queue.
 *  CLASSIC — lazy-loads the unmodified OutreachPanel (all 4 tabs: Overview /
 *    Pipeline / Review / Email). Every classic capability stays one toggle away.
 *
 * All queue data here is READ-only. Opening a thread flips to Classic with
 * ?prospect=<id> set; OutreachPanel reads that param on mount and opens its
 * fully-wired ProspectDetailModal, so every reply-send write path is reused
 * untouched (no mutation surface is re-implemented here). Mode persists in
 * localStorage. No n8n webhook fires on load.
 */

const OutreachPanel = lazy(() => import('../../dashboard/OutreachPanel'));

const DAY = 86_400_000;
const ts = (s: string | null | undefined): number => (s ? new Date(s).getTime() : 0);

// "2h" / "1d 11h" — age from an actual sent_at timestamp (never created_at).
function ageLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? `${d}d ${rem}h` : `${d}d`;
}

// Monochrome verdict tone — red is reserved for the REPLIES WAITING count.
function verdictTone(v: string | null): string {
  const s = (v || '').toLowerCase();
  if (/strong|great|ideal|high|healthy|worth/.test(s)) return 'ors-badge--strong';
  if (/weak|poor|low|thin|avoid|skip|off|noise|peer/.test(s)) return 'ors-badge--weak';
  return '';
}

const MODE_KEY = 'outreach-desk-mode';
type Mode = 'desk' | 'classic';
function readMode(): Mode {
  if (typeof window === 'undefined') return 'desk';
  return window.localStorage.getItem(MODE_KEY) === 'classic' ? 'classic' : 'desk';
}

// ── Desk data ───────────────────────────────────────────────────────────────
interface DeskProspect {
  id: string;
  name: string;
  company: string | null;
  stage: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  lastDmSentAt: string | null;
  needsManualReply: boolean;
  icpScore: number | null;
}
interface Inbound { text: string; sentAt: string | null; }
interface DeskData {
  loading: boolean;
  prospects: DeskProspect[];
  inbound: Record<string, Inbound>;       // prospect_id -> latest genuine inbound
  audits: Record<string, string>;         // lowercased prospect name -> verdict
  latest: (Inbound & { prospectId: string }) | null;
  sent7d: number | null;
  connected7d: number | null;
  email7d: number | null;
  error: string | null;
}

async function headCount(filter: (q: any) => any, table = 'outreach_prospects'): Promise<number | null> {
  try {
    const { count, error } = await filter(supabase.from(table).select('id', { count: 'exact', head: true }));
    return error ? null : count ?? 0;
  } catch { return null; }
}

// READ-only. Mirrors the genuine-inbound + owed-reply rules proven in
// NextUpCard / useWarmPipeline, sourced by sent_at (never created_at — a
// backfill sync lag makes created_at surface ~1-year-old messages as "new").
function useRepliesDesk() {
  const [data, setData] = useState<DeskData>({
    loading: true, prospects: [], inbound: {}, audits: {}, latest: null,
    sent7d: null, connected7d: null, email7d: null, error: null,
  });
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sevenAgo = new Date(Date.now() - 7 * DAY).toISOString();
      const [pRes, mRes, aRes, sent7d, connected7d, email7d] = await Promise.all([
        // Candidates for the owed rule all satisfy reply_count > 0 — pre-filter.
        supabase
          .from('outreach_prospects')
          .select('id,name,company,stage,reply_count,last_reply_at,last_dm_sent_at,needs_manual_reply,icp_score')
          .neq('stage', 'archived')
          .gt('reply_count', 0)
          .order('last_reply_at', { ascending: false })
          .limit(200),
        // Genuine inbound, LinkedIn channel, ordered by sent_at DESC (NEVER created_at).
        supabase
          .from('outreach_messages')
          .select('prospect_id,message_text,sent_at')
          .eq('direction', 'inbound')
          .eq('is_reaction', false)
          .neq('message_text', '')
          .is('channel', null)
          .order('sent_at', { ascending: false })
          .limit(120),
        supabase
          .from('audience_audits')
          .select('prospect_name,verdict,audited_at')
          .order('audited_at', { ascending: false })
          .limit(80),
        headCount((q) => q.not('connection_sent_at', 'is', null).gte('connection_sent_at', sevenAgo)),
        headCount((q) => q.not('connected_at', 'is', null).gte('connected_at', sevenAgo)),
        headCount((q) => q.eq('direction', 'inbound').eq('channel', 'email').gte('sent_at', sevenAgo), 'outreach_messages'),
      ]);
      if (!alive) return;

      const prospects: DeskProspect[] = (pRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name ?? 'Unknown',
        company: r.company ?? null,
        stage: r.stage ?? null,
        replyCount: r.reply_count ?? 0,
        lastReplyAt: r.last_reply_at ?? null,
        lastDmSentAt: r.last_dm_sent_at ?? null,
        needsManualReply: r.needs_manual_reply ?? false,
        icpScore: r.icp_score ?? null,
      }));

      // Latest genuine inbound per prospect (first hit wins — rows arrive sent_at DESC).
      const inbound: Record<string, Inbound> = {};
      let latest: (Inbound & { prospectId: string }) | null = null;
      (mRes.data ?? []).forEach((m: any) => {
        const text = typeof m.message_text === 'string' ? m.message_text : '';
        if (!text || /^\s*\[/.test(text)) return; // skip system/auto-reply tags
        const pid = m.prospect_id as string | null;
        if (!pid) return;
        const clean = text.replace(/\s+/g, ' ').trim();
        if (!inbound[pid]) inbound[pid] = { text: clean, sentAt: m.sent_at ?? null };
        if (!latest) latest = { prospectId: pid, text: clean, sentAt: m.sent_at ?? null };
      });

      const audits: Record<string, string> = {};
      (aRes.data ?? []).forEach((a: any) => {
        const key = String(a.prospect_name ?? '').toLowerCase().trim();
        if (key && a.verdict && !audits[key]) audits[key] = String(a.verdict);
      });

      setData({
        loading: false, prospects, inbound, audits, latest,
        sent7d, connected7d, email7d,
        error: pRes.error?.message ?? mRes.error?.message ?? null,
      });
    })();
    return () => { alive = false; };
  }, [nonce]);

  return { data, refresh };
}

const OutreachWorkSurface: React.FC = () => {
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    if (typeof window !== 'undefined') window.localStorage.setItem(MODE_KEY, m);
  }, []);

  const { data, refresh } = useRepliesDesk();
  const warm = useWarmPipeline();               // follow-up drafts queue (read-only, relocated)
  const repliesRef = useRef<HTMLElement>(null);

  // Owed / waiting rule — verbatim from NextUpCard.tsx:29-37 + useWarmPipeline.
  // reply_count > 0 AND last_reply_at within 7d AND (needs_manual_reply OR
  // (stage === 'replied' AND last_reply_at > last_dm_sent_at)). Ordered by the
  // inbound message's sent_at DESC (falls back to last_reply_at).
  const owed = useMemo(() =>
    data.prospects
      .filter((p) =>
        p.replyCount > 0 &&
        Date.now() - ts(p.lastReplyAt) <= 7 * DAY &&
        (p.needsManualReply || (p.stage === 'replied' && ts(p.lastReplyAt) > ts(p.lastDmSentAt))),
      )
      .map((p) => ({ p, msg: data.inbound[p.id] as Inbound | undefined }))
      .sort((a, b) => ts(b.msg?.sentAt ?? b.p.lastReplyAt) - ts(a.msg?.sentAt ?? a.p.lastReplyAt)),
    [data.prospects, data.inbound],
  );

  const leadId = owed[0]?.p.id ?? null;

  const openThread = useCallback((id: string) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('section', 'outreach');
      url.searchParams.set('prospect', id);
      window.history.replaceState(null, '', url.toString());
    }
    setMode('classic');
  }, [setMode]);

  const focusReplies = useCallback(() => {
    setMode('desk');
    repliesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [setMode]);

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const latest = data.latest;

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Outreach</span>
        <span className="ec-topline-meta">{now}</span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Outreach</h1>
        <div className="ws-tools">
          <button className="ws-tool" aria-pressed={mode === 'desk'} onClick={() => setMode('desk')}>Desk</button>
          <button className="ws-tool" aria-pressed={mode === 'classic'} onClick={() => setMode('classic')}>Classic</button>
          <button className="ws-tool-icon" onClick={refresh} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${data.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mode === 'classic' ? (
        <Suspense fallback={<div className="ws-loading">Loading classic outreach…</div>}>
          <OutreachPanel />
        </Suspense>
      ) : (
        <>
          {/* Glance strip — counts read the exact arrays/head-reads below. The
              single red is REPLIES WAITING when > 0. */}
          <div className="ws-tally" style={{ ['--ws-tally-cols' as any]: 4 }}>
            <button className="ws-tally-tile" onClick={focusReplies} title="Jump to the replies-waiting queue">
              <span className="ws-tally-no">01</span>
              <span className={`ws-tally-count ${owed.length ? 'ws-tally-count--red' : 'ws-tally-count--zero'}`} data-tally="replies">{owed.length}</span>
              <span className="ws-tally-label">Replies waiting</span>
              <span className="ws-tally-sub">{owed.length ? 'genuine inbound owed a reply' : 'nothing owed'}</span>
            </button>
            <div className="ws-tally-tile">
              <span className="ws-tally-no">02</span>
              <span className={`ws-tally-count ${data.sent7d ? '' : 'ws-tally-count--zero'}`}>{data.sent7d ?? '–'}</span>
              <span className="ws-tally-label">Sent 7d</span>
              <span className="ws-tally-sub">connection invites</span>
            </div>
            <div className="ws-tally-tile">
              <span className="ws-tally-no">03</span>
              <span className={`ws-tally-count ${data.connected7d ? '' : 'ws-tally-count--zero'}`}>{data.connected7d ?? '–'}</span>
              <span className="ws-tally-label">Connected 7d</span>
              <span className="ws-tally-sub">accepted invites</span>
            </div>
            <div className="ws-tally-tile">
              <span className="ws-tally-no">04</span>
              <span className={`ws-tally-count ${data.email7d ? '' : 'ws-tally-count--zero'}`}>{data.email7d ?? '–'}</span>
              <span className="ws-tally-label">Email 7d</span>
              <span className="ws-tally-sub">inbound, cold-email lane</span>
            </div>
          </div>

          {/* Latest reply — subtle hero, sourced by sent_at (not the created_at
              path, which can surface a backfilled ~1-year-old message). */}
          {latest && latest.text && (
            <div className="ors-hero">
              <div className="ors-hero-lbl">Latest reply</div>
              <div className="ors-hero-q">“{latest.text.slice(0, 200)}{latest.text.length > 200 ? '…' : ''}”</div>
              <div className="ors-hero-attr">
                {(data.prospects.find((p) => p.id === latest!.prospectId)?.name) || 'a prospect'}
                {latest.sentAt ? ` · ${ageLabel(latest.sentAt)} ago · inbound · linkedin` : ' · inbound · linkedin'}
              </div>
            </div>
          )}

          {/* ── Replies-waiting queue (the headline lane) ─────────────────────── */}
          <section ref={repliesRef} className="ws-lane">
            <div className="ws-lane-cap">
              <span className="ws-lane-cap-h">Replies waiting on you</span>
              <span className="ws-lane-cap-hint">click a row to open the thread</span>
            </div>

            {data.loading && data.prospects.length === 0 ? (
              <div className="ws-loading">Reading outreach_messages…</div>
            ) : owed.length === 0 ? (
              <div className="ws-empty">
                <div className="ws-empty-h">No replies owed</div>
                <div className="ws-empty-note">No genuine inbound reply is waiting on you inside the 7-day window. New replies surface here the moment a prospect answers.</div>
              </div>
            ) : (
              <div className="ors-queue">
                {owed.map(({ p, msg }) => {
                  const verdict = data.audits[p.name.toLowerCase().trim()];
                  const age = ageLabel(msg?.sentAt ?? p.lastReplyAt);
                  return (
                    <button key={p.id} className={`ors-row ${p.id === leadId ? 'ors-row--lead' : ''}`} onClick={() => openThread(p.id)}>
                      <div className="ors-row-top">
                        <span className="ors-name">{p.name}</span>
                        {p.company && <span className="ors-company">{p.company}</span>}
                        {age && <span className="ors-age">{age}</span>}
                      </div>
                      <div className={`ors-snippet ${msg?.text ? '' : 'ors-snippet--none'}`}>
                        {msg?.text ? `${msg.text.slice(0, 120)}${msg.text.length > 120 ? '…' : ''}` : 'Reply on record. Open the thread to read it.'}
                      </div>
                      <div className="ors-row-meta">
                        {verdict && <span className={`ors-badge ${verdictTone(verdict)}`}>{verdict}</span>}
                        {p.icpScore != null && <span className="ors-icp">ICP {p.icpScore}</span>}
                        <span className="ors-open">Open thread</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Follow-up drafts (relocated from Warm — approval NOT armed) ────── */}
          <section className="ws-lane" style={{ marginTop: '1.8rem' }}>
            <div className="ws-lane-cap">
              <span className="ws-lane-cap-h">Follow-up drafts</span>
              <span className="ws-lane-cap-hint">followup_drafts · pending approval</span>
            </div>
            <div className="ors-fu-note">
              Relocated from the retired Warm section. Read-only here. Send a follow-up from Classic → the prospect thread.
            </div>

            {warm.queue.state === 'offline' ? (
              <span className="ec-offline">source offline{warm.queue.error ? `: ${warm.queue.error.slice(0, 60)}` : ''}</span>
            ) : warm.queue.items.length === 0 && !warm.loading ? (
              <p className="ec-note">No follow-up drafts awaiting approval.</p>
            ) : (
              <div>
                {warm.queue.items.map((it) => (
                  <div className="ec-q-row" key={it.id}>
                    <div className="ec-q-head">
                      <span className="ec-q-name">{it.prospect}</span>
                      <span className="ec-item-tag">followup_drafts · pending</span>
                    </div>
                    {it.subject && <div className="ec-q-subject">{it.subject}</div>}
                    {it.preview && <div className="ec-q-preview">{it.preview}{it.preview.length >= 220 ? '…' : ''}</div>}
                    <div className="ec-q-actions">
                      <button className="ec-btn ec-btn--primary" disabled>Approve</button>
                      <button className="ec-btn" disabled>Edit</button>
                      <button className="ec-btn" disabled>Skip</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default OutreachWorkSurface;
