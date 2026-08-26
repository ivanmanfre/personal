/**
 * OutreachTopOfPanel — the ballot-winning top of the RISE outreach panel.
 *
 * Ivan resolved the 2026-08-25 tournament on 2026-08-26: candidate A (the call sheet)
 * with candidate C's dark weekly hero grafted ABOVE the named roster. This file is that
 * decision, rendered once and shared by BOTH layout branches (DeskOutreachSurface and the
 * legacy `?skin=` OutreachSurface in ClientBoardPage), so the two can never drift apart.
 *
 * Every figure here comes from `board.outreach_truth`, the server-computed blob written by
 * rise_outreach_truth_apply() every 6 hours, and every figure carries that blob's
 * `counted_at`. Nothing on this surface is computed from the browser clock or from the
 * live send log, which is what the predecessor run's Fork 3 was about: the panel used to
 * bucket `last_reply_at` client-side and disagree with the weekly report.
 *
 * The blacklist filter lives server-side: `replied_7d` is built from a CTE that carries
 * `blacklisted is distinct from true`, so a vendor or a phishing thread can never render
 * into the client's roster. `replied_weekly` is deliberately NOT blacklist-filtered (a
 * closed week already delivered to Mattan must never move) — see the comment block in
 * rise_outreach_truth_compute().
 *
 * Deliberately NOT here: the "about 25 wrote back" line the tournament's candidate C
 * carried. That number was imported from a weekly note, not read from the log, and an
 * imported receipt is a claim we cannot stand behind (feedback-no-imported-receipts).
 */
import React from 'react';
import { Plate, Eyebrow, Num, Delta, Spark, Chip, Footnote, Card, Drill, PlateMute, PlateRule } from './desk-kit';
import type { Board, OutreachLogEntry, OutreachTruth } from '../ClientBoardPage';

/* ══════════════════════════ dates + numbers ══════════════════════════ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** "17 Aug". Week labels and booked dates both read in this one shape. */
function dayMonth(iso?: string | null): string {
  if (!iso) return '';
  const d = parseIso(iso);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** "Thu 20 Aug, 21:34 UTC". Always UTC: the blob is counted in UTC and the client reads
 *  from three timezones, so a local render would make two people see two different days. */
function stampUtc(iso?: string | null): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}
/** "26 Aug, 04:01 UTC" — the counted-at stamp that rides every number on this surface. */
export function countedStamp(iso?: string | null): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}
/** A week_monday in the blob is a bare `YYYY-MM-DD`; Date parses that as UTC midnight,
 *  which is what every comparison here wants. Returns null rather than an Invalid Date. */
function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
const DAY_MS = 86400000;

/* ══════════════════════════ roster ↔ send-log wiring ══════════════════════════ */

/**
 * The anchor id of a person's row inside the EXISTING send-log Drill. The roster only
 * knows a name and a company; the send log is keyed on prospect_id. Both sides derive the
 * same id from the name so a roster click can open the trail that is already on the page,
 * instead of shipping a second trail component (mission instruction, critic F7).
 */
export function sendLogAnchorId(name?: string | null): string {
  const k = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return k ? `sendlog-${k}` : '';
}

/**
 * Roster name click: open the send-log Drill (and every <details> above it) on the person,
 * then scroll them into view. When the person has no trail on this page the handler does
 * nothing and the anchor's href takes over, opening their profile — so a click always does
 * something, and it is never a fabricated trail.
 */
export function openSendLogFor(ev: React.MouseEvent, anchorId: string): void {
  if (!anchorId || typeof document === 'undefined') return;
  const el = document.getElementById(anchorId);
  if (!el) return;
  ev.preventDefault();
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === 'DETAILS') (node as HTMLDetailsElement).open = true;
    node = node.parentElement;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ══════════════════════════ vendor scrub (shared) ══════════════════════════ */

/**
 * Lane names in the live board JSON still carry the tool we source from ("Pure cold: Sales
 * Navigator", "RiseDTC — Cold (DTC Sales Nav)"). Vendor vocabulary is on the client-facing
 * ban list, so every lane string is filtered on its way to the screen. THE REAL FIX IS
 * UPSTREAM — rename outreach.lanes[].name in the board JSON — this is the presentation
 * backstop until then. Lives here, not in DeskOutreachSurface, so both layout branches can
 * import it without ClientBoardPage and DeskOutreachSurface importing each other.
 */
export const VENDOR_RE = /\b(?:sales\s*nav(?:igator)?|apollo(?:\.io)?|linkedin\s*recruiter|unipile|smartlead|phantombuster|harvestapi|apify)\b/gi;
export function scrubVendor(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(VENDOR_RE, '')
    .replace(/\(\s*\)/g, '')            // "(Sales Navigator)" -> "()" -> ""
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\+\s*pull\b/gi, '')    // "Sales Navigator + Apollo pull" -> "+ pull" -> ""
    .replace(/\s*[:–—,;+-]\s*\)/g, ')')
    .replace(/\s*[:–—,;+-]\s*$/, '')
    .replace(/^\s*[:–—,;+-]\s*/, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
/** Lane name for display. If the scrub eats the whole name (a lane called nothing but its
 *  vendor) fall back to a neutral, non-fabricated label rather than leaking the original. */
export function laneName(name?: string | null): string { return scrubVendor(name) || 'Outreach lane'; }

/* ══════════════════════════ funnel_gates display scrub ══════════════════════════ */

/**
 * funnel_gates is computed for Mattan ("show me the filters") but its strings are written
 * in our vocabulary: tool names, column names, and one sentence that reports a defect in
 * our own send path. Three display-level passes, in order. None of them touches the data,
 * and none of them changes a number.
 *
 *  1. tool names out (same ban list DeskOutreachSurface already applies to lane names),
 *  2. column/code identifiers to plain English,
 *  3. self-damage sentences dropped. A client-facing surface never carries a receipt
 *     against ourselves (feedback-no-self-damage-no-machine-reveal-2026-08-21). Every
 *     sentence that RECONCILES two numbers on this page survives; the one sentence that
 *     only reports our sender ignoring our own filters does not.
 */
const GATE_TERMS: [RegExp, string][] = [
  [/\bfrom\s+Sales\s*Nav(?:igator)?\b/gi, 'from our sourcing list'],
  [/\bheld on a ballot awaiting Ivan\b/gi, 'waiting on a review from Ivan'],
  [/\bconnection_sent_at\s*\/\s*stage\b/gi, 'the connection-request stamp'],
  [/\bconnection_sent_at\b/gi, 'the connection-request stamp'],
  [/\bskip_reason\b/gi, 'the cut reason'],
  [/\binmail_ready\b/gi, 'ready to InMail'],
  [/\bad_intel\.[a-z_.]+/gi, 'the ad reading'],
  [/\bpicker predicate\b/gi, 'the send queue rule'],
  [/\bthe picker\b/gi, 'the send queue'],
  [/\bpicker\b/gi, 'send queue'],
  [/\bgold_icp[a-z0-9_]*\s*\/\s*icp_score\b/gi, 'the fit score'],
  [/\brise_note_final\s*\/\s*name_gate\b/gi, 'the written invite'],
  [/\bstore_recon_v2\b/gi, 'the store check'],
  [/\bshopify_verified\s*\/\s*store_url\b/gi, 'the storefront check'],
  [/\bexec_gate\s*\/\s*title_gate\b/gi, 'the owner check'],
  [/\bliveness_checked_at\s*\/\s*follower_check\b/gi, 'the profile check'],
  [/\bjudge_reason\s*\/\s*judge_score\b/gi, 'the fit review'],
  [/\bjudge_reason\b/gi, 'the fit review'],
  [/\bvendor_check\b/gi, 'the own-brand check'],
  [/\bviewed_at\b/gi, 'the view record'],
  [/\binvitation_id\b/gi, 'their request'],
  [/\bsource\b/gi, 'where they came from'],
  [/\baudience_floor\b/gi, 'the audience floor'],
  [/\bname_gate\b/gi, 'the name clearance'],
  [/\banchor_client\b/gi, 'a current client network'],
  [/\bstore_recon\b/gi, 'the store check'],
];
/** Only the sentence that reports our own send path ignoring our own filters. */
const GATE_SELF_DAMAGE_RE = /never reads|still sendable/i;

export function plainGate(raw?: string | null): string {
  if (!raw) return '';
  const kept = raw
    .split(/(?<=\.)\s+/)
    .filter((s) => !GATE_SELF_DAMAGE_RE.test(s))
    .join(' ');
  let s = kept;
  for (const [re, to] of GATE_TERMS) s = s.replace(re, to);
  return s
    .replace(VENDOR_RE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(?:from|via|through|against)\s*$/i, '')
    .replace(/\s*[:–—,;-]\s*$/, '')
    .trim();
}

/* ══════════════════════════ types ══════════════════════════ */

/** One lane of board.outreach_truth.funnel_gates. Shape mirrors the RPC exactly. */
type GateStage = {
  stage: string; label_plain_english?: string | null; evidence_key?: string | null;
  entered?: number; passed?: number; failed?: number; waiting?: number; untracked?: number; arrived?: number;
  note?: string | null;
};
type GateLane = {
  lane: string; lane_label?: string | null; total?: number; stages?: GateStage[];
  discrepancy?: string | null; contacted_total?: number; retro_cut?: number;
};
type FunnelGates = { lanes?: GateLane[]; reading?: string; computed_at?: string; source?: string };

/** Payload of client_board_funnel_signals / _v2 (goal-run rise-panel-followthrough,
 *  phase 1, D-G item 1). Read-only consumer of rise_funnel_daily +
 *  rise_buyers_post_ledger; this run never writes to either. */
export interface FunnelSignals {
  computed_at: string;
  /** Documents the counting grain, so a future reader cannot mistake these for the
   *  daily view's per-day distincts (which do NOT sum across days). */
  grain?: string;
  /** First capture day on the view log for this seat, COMPUTED server-side. The organic
   *  line's honesty label prints this date; hardcoding it would let the panel and the
   *  weekly report claim two different start dates. */
  tracking_started_on?: string | null;
  profile_views: {
    window_days: number;
    named: number; engine: number; organic_icp: number; other: number;
    named_7d: number; engine_7d: number; organic_icp_7d: number; other_7d: number;
  };
  engagers: { window_days: number; new: number; organic_icp: number; engine: number };
  buyer_dms_30d: number;
  organic_openers_30d?: number;
  posts_buyers_30d: number;
  posts: { social_id: string; published_at: string; title: string; impressions: number | null;
           organic_icp_views_48h: number; named_views_48h: number; buyer_dms_48h: number }[];
}

/* ══════════════════════════ intent chips ══════════════════════════ */

/**
 * reply_intent, as the client reads it. The classifier ships three labels and a null for
 * anything it has not reached yet; a null renders as no chip at all rather than as a
 * guess. "Not now" is deliberately softer than the raw `negative`: the roster is a call
 * sheet, and a person who said no this month is still a person he may write to in March.
 */
const INTENT_LABEL: Record<string, string> = {
  positive: 'Interested',
  neutral: 'Replied',
  negative: 'Not now',
};
function IntentChip({ intent }: { intent?: string | null }) {
  const key = (intent || '').toLowerCase();
  const label = INTENT_LABEL[key];
  if (!label) return null;
  const positive = key === 'positive';
  return (
    <span style={{
      flex: 'none', fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '2px 10px',
      color: positive ? 'var(--cb-accent)' : 'var(--cb-ink-mute)',
      border: `1px solid ${positive ? 'var(--cb-accent)' : 'var(--cb-line-bold)'}`,
    }}>{label}</span>
  );
}

/* ══════════════════════════ the surface ══════════════════════════ */

export default function OutreachTopOfPanel({
  board, accent, log = null, signals = null,
}: {
  board: Board;
  accent: string;
  log?: OutreachLogEntry[] | null;
  signals?: FunnelSignals | null;
}) {
  const ot = board.outreach_truth as OutreachTruth | undefined;
  // No blob, no winner: a board that predates rise_outreach_truth_apply() keeps the
  // layout it already had. This surface never invents a number to fill itself.
  if (!ot || !ot.counted_at) return null;

  const stamp = countedStamp(ot.counted_at);
  const countedAtMs = parseIso(ot.counted_at)?.getTime() ?? 0;

  // ── the weekly hero, straight off replied_weekly ────────────────────────────────────
  // The week grid comes from the blob (Monday-based, UTC), never from the browser clock,
  // so the hero cannot claim a week the server has not counted. The LAST row is always
  // the week in progress; the hero is therefore the last FULL week, and the in-progress
  // week reads as the trailing bar with its own "still counting" label. That is the fix
  // for candidate A's unflagged hero-period mismatch: the big number and the roster below
  // it cover different windows, and both now say which.
  const weeks = [...(ot.replied_weekly || [])].sort((a, b) => (a.week_monday < b.week_monday ? -1 : 1));
  const inProgress = weeks.length > 0 ? weeks[weeks.length - 1] : null;
  const heroWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const priorWeek = weeks.length > 2 ? weeks[weeks.length - 3] : null;
  const heroValue = heroWeek ? heroWeek.people : null;
  const delta = heroWeek && priorWeek ? heroWeek.people - priorWeek.people : null;
  const sparkWeeks = weeks.slice(-7);
  const heroIdx = sparkWeeks.length > 1 ? sparkWeeks.length - 2 : -1;
  // How far into the in-progress week the count reached, measured from counted_at so it
  // matches the stamp beside it rather than the reader's clock.
  const daysIn = (() => {
    const wkStart = parseIso(inProgress?.week_monday)?.getTime();
    if (!wkStart || !countedAtMs) return null;
    const n = Math.floor((countedAtMs - wkStart) / DAY_MS) + 1;
    return n >= 1 && n <= 7 ? n : null;
  })();

  // ── booked calls ────────────────────────────────────────────────────────────────────
  const booked = Array.isArray(ot.booked) ? ot.booked : [];

  // ── the roster ──────────────────────────────────────────────────────────────────────
  // replied_7d is already blacklist-filtered server-side, and already carries the intent
  // of each person's MOST RECENT inbound message (not the best one in the thread).
  const roster = Array.isArray(ot.replied_7d) ? ot.replied_7d : [];
  const bookedNames = new Set(booked.map((b) => (b.name || '').toLowerCase().trim()).filter(Boolean));
  // Which roster names have a real trail in the send log already rendered further down.
  const trailIds = new Set(
    (log || []).map((e) => sendLogAnchorId(e.name)).filter(Boolean),
  );
  const intentsKnown = roster.filter((r) => !!r.reply_intent).length;

  const gates = (ot as unknown as { funnel_gates?: FunnelGates }).funnel_gates;
  const gateLanes = (gates?.lanes || []).filter((l) => (l.total || 0) > 0);

  return (
    <div data-surface="outreach-top-of-panel">

      {/* ═══ 1 — the weekly hero. Dark plate, one number, its delta, seven weeks. ═══ */}
      <Plate style={{ marginTop: 18 }} pad="28px 26px 24px">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <Eyebrow on="plate">People who wrote back</Eyebrow>
          <PlateMute style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>counted {stamp}</PlateMute>
        </div>

        {heroValue === null ? (
          <Footnote on="plate">The first full week of replies lands here once a week has closed.</Footnote>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              <a
                href="#outreach-roster"
                style={{ display: 'inline-flex', alignItems: 'baseline', textDecoration: 'none', borderBottom: `2px solid ${accent}`, paddingBottom: 2 }}
              >
                <Num size="hero" tone="plate" inline>{heroValue}</Num>
              </a>
              {delta !== null && (
                <Delta on="plate" dir={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>
                  {delta > 0 ? `+${delta}` : `${delta}`}
                </Delta>
              )}
            </div>
            <Footnote on="plate">
              Week of {dayMonth(heroWeek?.week_monday)}, the last full week.
              {priorWeek ? <> The week before that: {priorWeek.people}.</> : null}
            </Footnote>
          </>
        )}

        {sparkWeeks.length > 1 && (
          <>
            <Spark
              on="plate"
              values={sparkWeeks.map((w) => w.people)}
              topLabels={sparkWeeks.map((w, i) => (i === sparkWeeks.length - 1 ? `${w.people}*` : `${w.people}`))}
              labels={sparkWeeks.map((w) => dayMonth(w.week_monday))}
              highlight={heroIdx}
              style={{ marginTop: 22 }}
            />
            <Footnote on="plate">
              *Week of {dayMonth(inProgress?.week_monday)} is still counting{daysIn ? `, ${daysIn} of 7 days in` : ''}.
            </Footnote>
          </>
        )}

        <PlateRule />
        {/* Whole-program numbers. `accepted` is cumulative across the entire program, not
            a weekly figure, and says so: the weekly report's accepted count is windowed
            and the two must never be read as the same measure. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 16, marginTop: 16 }}>
          {[
            { n: ot.funnel?.contacted, l: 'people contacted, whole program' },
            { n: ot.funnel?.accepted, l: 'accepted the invite, whole program' },
            { n: ot.funnel?.replied_people, l: 'have written back, whole program' },
            { n: ot.funnel?.booked, l: 'booked a call, whole program' },
          ].map((s) => (
            <div key={s.l}>
              <Num size="big" tone="plate">{typeof s.n === 'number' ? s.n : '—'}</Num>
              <PlateMute as="div" style={{ fontSize: 12, fontWeight: 600, marginTop: 6, lineHeight: 1.35 }}>{s.l}</PlateMute>
            </div>
          ))}
        </div>
        <Footnote on="plate">All four counted {stamp}.</Footnote>
      </Plate>

      {/* ═══ 2 — booked calls, pinned above the roster ═══ */}
      <Card style={{ marginTop: 12, padding: '22px 26px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <Eyebrow>Booked calls</Eyebrow>
          <span style={{ fontFamily: 'var(--cb-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', letterSpacing: '0.04em' }}>
            {booked.length} to date
          </span>
        </div>
        <Footnote style={{ marginTop: 4 }}>Counted {stamp}. Includes calls booked off the link as well as on it.</Footnote>
        {booked.length === 0 ? (
          <div style={{ marginTop: 14, border: '1px dashed var(--cb-line-bold)', borderRadius: 25, background: 'var(--cb-paper-sunk)', padding: '30px 28px' }}>
            <b style={{ display: 'block', fontFamily: 'var(--cb-serif)', fontSize: 19, fontWeight: 600, color: 'var(--cb-ink)', marginBottom: 8 }}>None yet.</b>
            <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--cb-ink-mute)' }}>
              When someone books, the row lands here: who, company, when, with the pre-call brief and their store scan one tap away.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {booked.map((b, i) => (
              <div
                key={b.prospect_id || `${b.name || 'booked'}-${i}`}
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', borderRadius: 14, background: 'var(--cb-paper-raise, #fff)', border: '1px solid var(--cb-line)', borderLeft: `3px solid ${accent}`, padding: '14px 16px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{b.name || '(unnamed)'}</span>
                    {b.company && <span style={{ fontSize: 12.5, color: 'var(--cb-ink-soft)' }}>{b.company}</span>}
                  </div>
                  {b.booked_at && (
                    <div style={{ fontFamily: 'var(--cb-mono)', fontSize: 11.5, color: 'var(--cb-ink-mute)', marginTop: 3 }}>{stampUtc(b.booked_at)}</div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flex: 'none', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {b.scan_url && (
                    <a href={b.scan_url} target="_blank" rel="noreferrer" style={{ borderRadius: 10, padding: '7px 13px', fontFamily: 'var(--cb-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cb-ink)', border: '1px solid var(--cb-line-bold)' }}>Their scan</a>
                  )}
                  {b.brief_url && (
                    <a href={b.brief_url} target="_blank" rel="noreferrer" style={{ borderRadius: 10, padding: '7px 13px', fontFamily: 'var(--cb-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FFFFFF', background: accent, border: `1px solid ${accent}` }}>Pre-call brief</a>
                  )}
                  {/* A booking Mattan closed by hand carries no brief and no scan. The row
                      still renders; the link is never synthesized to fill the gap. */}
                  {!b.scan_url && !b.brief_url && <Chip>booked outside the link</Chip>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ═══ 3 — the call sheet: everyone who wrote back, by name ═══ */}
      {/* scrollMarginTop clears the desk sticky bar, so the hero's "see everyone" jump
          lands on the section rule instead of underneath the chrome. */}
      <div id="outreach-roster" style={{ scrollMarginTop: 76, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 30, paddingBottom: 12, borderBottom: '2px solid var(--cb-ink)' }}>
        <Eyebrow style={{ flex: '1 1 auto' }}>Wrote back, last 7 days</Eyebrow>
        <Num size="row" inline>{roster.length}</Num>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>most recent first</span>
      </div>
      <Card style={{ marginTop: 12, padding: '18px 26px 14px' }}>
        <Footnote style={{ marginTop: 0 }}>
          Counted {stamp}, trailing 7 days.{' '}
          {intentsKnown === roster.length && roster.length > 0
            ? 'Every reply here has been read and sorted.'
            : `${intentsKnown} of ${roster.length} replies have been read and sorted so far; the rest carry no label yet.`}{' '}
          Tap a name to see the messages that went out to them.
        </Footnote>
        {roster.length === 0 ? (
          <Footnote>Nobody has written back in the last 7 days. Names land here the moment one does.</Footnote>
        ) : (
          <div style={{ marginTop: 12 }}>
            {roster.map((p, i) => {
              const anchor = sendLogAnchorId(p.name);
              const hasTrail = !!anchor && trailIds.has(anchor);
              const profile = p.linkedin_profile_id ? `https://www.linkedin.com/in/${p.linkedin_profile_id}` : undefined;
              const alsoBooked = bookedNames.has((p.name || '').toLowerCase().trim());
              const positive = (p.reply_intent || '').toLowerCase() === 'positive';
              return (
                <a
                  key={`${p.linkedin_profile_id || p.name || 'row'}-${i}`}
                  href={profile || `#${anchor}`}
                  {...(profile ? { target: '_blank', rel: 'noreferrer' } : {})}
                  onClick={(ev) => openSendLogFor(ev, anchor)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
                    padding: '13px 0 13px 11px', marginLeft: -14, textDecoration: 'none',
                    borderTop: i > 0 ? '1px solid var(--cb-line)' : undefined,
                    borderLeft: `3px solid ${positive ? accent : 'transparent'}`,
                  }}
                >
                  <span style={{ flex: 'none', width: 22, fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 12.5, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>{pad2(i + 1)}</span>
                  <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{p.name || '(unnamed)'}</span>
                    {p.company && <span style={{ fontSize: 12.5, color: 'var(--cb-ink-soft)', marginLeft: 8 }}>{p.company}</span>}
                    {alsoBooked && <Chip style={{ marginLeft: 8, fontSize: 11.5, padding: '2px 9px' }}>also booked</Chip>}
                  </span>
                  <IntentChip intent={p.reply_intent} />
                  <span style={{ flex: 'none', fontFamily: 'var(--cb-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', minWidth: 76, textAlign: 'right' }}>
                    {stampUtc(p.last_reply_at).replace(' UTC', '')}
                  </span>
                  <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
                    {hasTrail ? 'see the messages' : 'open profile'}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </Card>

      {/* ═══ 4 — the filters, lane by lane. Mattan asked to see them. ═══ */}
      {gateLanes.length > 0 && (
        <Card style={{ marginTop: 12, padding: '4px 26px' }}>
          <Drill
            label="open it"
            summaryLeft={<>Where every name stands, list by list: <b>{gateLanes.length}</b> list{gateLanes.length === 1 ? '' : 's'}, each check and what it stopped</>}
          >
            <Footnote style={{ marginTop: 0 }}>
              Counted {countedStamp(gates?.computed_at || ot.counted_at)}. Reached = got as far as this check.
              Cleared = passed it. Stopped = this check is why they went no further.
              Not checked = this check never ran on them, so no verdict is claimed. Waiting = still in front of it today.
            </Footnote>
            {gateLanes.map((ln) => {
              const label = plainGate(ln.lane_label) || plainGate(ln.lane) || 'Outreach list';
              const disc = plainGate(ln.discrepancy);
              return (
                <div key={ln.lane} style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--cb-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 15.5, color: 'var(--cb-ink)' }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
                      {ln.total} looked at, {ln.contacted_total ?? 0} contacted
                    </span>
                  </div>
                  {(ln.stages || []).map((st) => {
                    const bits: string[] = [];
                    if (st.passed) bits.push(`${st.passed} cleared`);
                    if (st.failed) bits.push(`${st.failed} stopped here`);
                    if (st.untracked) bits.push(`${st.untracked} not checked`);
                    if (st.waiting) bits.push(`${st.waiting} waiting`);
                    if (st.arrived) bits.push(`${st.arrived} arrived`);
                    return (
                      <div key={st.stage} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--cb-ink-soft)' }}>
                          {plainGate(st.label_plain_english) || plainGate(st.stage)}
                        </span>
                        <span style={{ flex: 'none', fontFamily: 'var(--cb-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
                          {st.entered ?? 0} reached
                        </span>
                        {bits.length > 0 && (
                          <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{bits.join(' · ')}</span>
                        )}
                      </div>
                    );
                  })}
                  {disc && (
                    <div style={{ marginTop: 10, borderRadius: 12, background: 'var(--cb-paper-sunk)', padding: '11px 13px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--cb-ink-mute)' }}>
                      {disc}
                    </div>
                  )}
                </div>
              );
            })}
          </Drill>
        </Card>
      )}

      {/* ═══ 5 — who is looking. Live views, read fresh, never the blob. ═══ */}
      <OutreachSignalsTile signals={signals} accent={accent} />
    </div>
  );
}

/* ══════════════════════════ D-G: the funnel-instruments tile ══════════════════════════ */

/**
 * "Who is looking" — the profile-view three-way split and the buyers-post ledger, read
 * live from rise_funnel_daily / rise_buyers_post_ledger through
 * client_board_funnel_signals. Two honesty rules are structural here, not decorative:
 *
 *  - the split LEADS with the number that is already moving (views from people we have
 *    already written to). The organic line is a brand-new instrument and its zero is a
 *    start date, not a miss, so the row carries the tracking start date, read live from
 *    the log rather than typed in, so this line and the weekly report cannot disagree.
 *  - post engagement renders as COUNTS, never as a trend. The engager rows were
 *    backfilled and are all bunched on their harvest date, so a trend line drawn today
 *    would describe the backfill rather than the audience. A trend becomes readable from
 *    about 2 Sep, and the label says so.
 *
 * 🔴 Every people-count arriving here is a DISTINCT headcount computed off the source
 * tables. rise_funnel_daily's people columns are per-day distincts and DO NOT sum: on
 * 2026-08-26 the summed engager figure was 97 against a true headcount of 74.
 */
export function OutreachSignalsTile({ signals, accent }: { signals?: FunnelSignals | null; accent: string }) {
  if (!signals || !signals.profile_views) return null;
  const pv = signals.profile_views;
  const eg = signals.engagers;
  const posts = signals.posts || [];
  const stamp = countedStamp(signals.computed_at);

  // Read off the log, never typed in: the weekly report prints the same date from the
  // same read, so the two surfaces cannot claim two different start dates.
  const startedOn = dayMonth(signals.tracking_started_on);
  const rows: { n: number; label: string; note?: string; lead?: boolean }[] = [
    { n: pv.engine, label: 'people we have already written to', note: 'they came back to look, which is a warm signal, not a new lead', lead: true },
    { n: pv.other, label: 'recruiters, agencies and other sellers', note: 'counted so they never inflate the line above' },
    {
      n: pv.organic_icp,
      label: 'brand owners who found you on their own',
      note: startedOn
        ? `tracking started ${startedOn}, so a zero here is a new instrument rather than a miss`
        : 'a new line: a zero here is an instrument that has only just started, not a miss',
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 30, paddingBottom: 12, borderBottom: '2px solid var(--cb-ink)' }}>
        <Eyebrow style={{ flex: '1 1 auto' }}>Who is looking</Eyebrow>
        <Num size="row" inline>{pv.named}</Num>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>named views, last 30 days</span>
      </div>
      <Card style={{ marginTop: 12, padding: '20px 26px 16px' }}>
        <Footnote style={{ marginTop: 0 }}>
          Read {stamp}, trailing 30 days. LinkedIn only names a viewer who allows it, so this is a floor, not a total.
        </Footnote>
        <div style={{ marginTop: 8 }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', padding: '13px 0', borderTop: i > 0 ? '1px solid var(--cb-line)' : undefined }}>
              <span style={{ flex: 'none', minWidth: 46 }}>
                <Num size={r.lead ? 'big' : 'row'} tone={r.lead ? 'accent' : 'mute'} inline>{r.n}</Num>
              </span>
              <span style={{ flex: '1 1 240px', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cb-ink)' }}>{r.label}</span>
                {r.note && <div style={{ fontSize: 12.5, color: 'var(--cb-ink-mute)', marginTop: 3, lineHeight: 1.45 }}>{r.note}</div>}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cb-line)' }}>
          <Chip>{pv.named_7d} named viewer{pv.named_7d === 1 ? '' : 's'} in the last 7 days</Chip>
          <Chip>{eg.new} people engaged your posts</Chip>
          <Chip>{eg.organic_icp} of them brand owners we had not written to</Chip>
        </div>
        <Footnote>
          Everyone above is counted once, however many times they looked or reacted. Engagement is shown as counts,
          not as a trend: the back-history was collected in one pass{startedOn ? ` on ${startedOn}` : ''}, so a trend
          line drawn today would describe the collection date. It reads as a trend from about 2 Sep.
        </Footnote>
      </Card>

      {posts.length > 0 && (
        <Card style={{ marginTop: 12, padding: '4px 26px' }}>
          <Drill
            label="open it"
            summaryLeft={<>Posts written for buyers: <b>{signals.posts_buyers_30d}</b> in the last 30 days, and who came looking after each one</>}
          >
            <Footnote style={{ marginTop: 0 }}>
              A ledger, not a chart. The 30 days before this started carried {signals.buyer_dms_30d} buyer messages, so any lift shows up on the first row it happens.
            </Footnote>
            {posts.map((p) => (
              <div key={p.social_id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '11px 0', borderTop: '1px solid var(--cb-line)' }}>
                <span style={{ flex: 'none', fontFamily: 'var(--cb-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)', width: 52 }}>{dayMonth(p.published_at)}</span>
                <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13.5, color: 'var(--cb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
                  {typeof p.impressions === 'number' ? `${p.impressions} seen` : 'views not in yet'}
                </span>
                <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: p.organic_icp_views_48h > 0 ? accent : 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.organic_icp_views_48h} looked you up
                </span>
              </div>
            ))}
          </Drill>
        </Card>
      )}
    </>
  );
}
