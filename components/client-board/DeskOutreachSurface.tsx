/**
 * DeskOutreachSurface — the merged "Outreach & leads" tab for the desk client-board skin.
 *
 * Ports `OutreachSurface` (components/ClientBoardPage.tsx, ~line 5689) onto the desk kit,
 * matching frag-outreach.html's block order and density:
 *   1. Headline + the dark this-week-vs-last plate, split by channel (invites/accepted/DMs/
 *      InMails/open-profile/wrote-back), computed client-side from the live send log.
 *   2. The to-date funnel plate (people contacted -> accepted [not tracked] -> wrote back ->
 *      calls booked).
 *   3. The send allowance, collapsed into a Drill (the frag demoted it).
 *   4. Leads eyebrow: replies-in-play -> calls-booked journey graphic.
 *   5. Booked calls (only when board.precall_briefs has rows).
 *   6. "The bar" - the qualifying gates, driven by board.outreach.icp.
 *   7. "Happening now" - the live lanes, from board.outreach.lanes + status.
 *   8. The candidate list, collapsed (names/companies only, no fit/score chip - the
 *      underlying scorer is known-inverted).
 *   9. The send log, collapsed, per-lead outbound trail.
 *  10. foldLeads, folded into a collapsed Drill (the old leads surface: detail modal +
 *      captured-leads table).
 *
 * Props are byte-for-byte the original OutreachSurface signature. No callback, no prop,
 * no data fetch is touched — this file is presentation only.
 */
import { useState } from 'react';
import React from 'react';
import {
  Plate, Eyebrow, Num, BarRow, Funnel, JourneyPlate, Drill, Blank, Chip, DeskH2, Footnote,
  Cols, Card, PlateMute, PlateRule,
} from './desk-kit';
import type { FunnelStep } from './desk-kit';
import OutreachTopOfPanel, {
  sendLogAnchorId, countedStamp, scrubVendor, laneName,
  liveLanes, positiveReplierLog, hasReplyIntents,
} from './OutreachTopOfPanel';
import type { FunnelSignals } from './OutreachTopOfPanel';
import { inkOn, caText } from '../ClientBoardPage';
import type { Board, OutreachUsage, OutreachLogEntry, OutreachLogMessage, OutreachStatus } from '../ClientBoardPage';

/** A lane is dead (retired / no ratified sequence) when its status says retired or its
 *  name is the retired Network Activation lane. Ported verbatim from OutreachSurface's
 *  local isDeadLane so a dead source never resurfaces on this tab either. */
function isDeadLane(name?: string, status?: string, arms?: string): boolean {
  const hay = `${name || ''} ${status || ''} ${arms || ''}`.toLowerCase();
  return /retired|no ratified sequence|network activation/.test(hay);
}

/* ── Display-level vendor scrub ────────────────────────────────────────────────────────
 * scrubVendor/laneName now live in OutreachTopOfPanel so BOTH layout branches share one
 * ban list (the ?skin= branch was leaking "Sales Navigator" into three places it renders).
 * The scrub never mutates the data, and the dead-lane test above deliberately still reads
 * the RAW strings: a lane retired under a vendor name must still be recognised as dead.
 */


/** Collapsible block (Ivan 2026-09-02: "nothing is collapsible, everything just goes below").
 *  Native details with class "fold" (drills are asserted closed by default; folds may open). */
function Fold({ id, title, count, note, open, children }: { id?: string; title: React.ReactNode; count?: React.ReactNode; note?: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  return (
    <details id={id} className="fold" open={open} style={{ border: '1px solid var(--cb-line)', borderRadius: 16, background: 'var(--cb-paper-raise, #fff)', padding: '0 22px', scrollMarginTop: 76 }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '15px 0' }}>
        <Eyebrow style={{ flex: '1 1 auto' }}>{title}</Eyebrow>
        {count !== undefined && <Num size="row" inline>{count}</Num>}
        {note && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{note}</span>}
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>open / close</span>
      </summary>
      <div style={{ paddingBottom: 16 }}>{children}</div>
    </details>
  );
}

/** A lane status only earns a chip when it is a plain client-readable state. Anything
 *  carrying internal or vendor vocabulary is dropped rather than translated. */
const UNSAFE_STATUS_RE = /campaign|seat|scorer|icp|dm\s?[123]|sequence|webhook|api|cred|error|retired|paused|draft|\bid\b/i;
function safeStatus(status?: string): string {
  const s = scrubVendor(status);
  if (!s || UNSAFE_STATUS_RE.test(s) || s.length > 22) return '';
  return s;
}

/** Truncate a lane description to one short line, cut on a word boundary. Anything longer
 *  belongs in a drill, not on the row (the tab has no density headroom). */
function clipDetail(s: string, max = 90): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

/**
 * Bar width for one value inside a comparison group. A ZERO IS ZERO WIDTH: the numeral next
 * to the bar carries the truth, and a full track for a 0 (the shipped bug) read as the
 * strongest row on the plate. An all-zero group renders two empty tracks, never two full ones.
 */
function barPct(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/* ── Local date helpers (frag-locked copy: "20 Jul", no weekday token) ────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Month-to-date counters reset on the 1st, so early in a month they read smaller than the
 *  week beside them. Naming the month is what stops the two numbers reading as a contradiction. */
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
function shortDate(d: Date): string { return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function shortDateTime(d: Date): string { return `${shortDate(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Same "counted <date>" convention DeskPerformanceSurface stamps on its live indicator
 *  cards (en-GB, day + short month, no year — the board is a this-year surface). Used
 *  wherever a number is sourced from board.outreach_truth, so a stale recompute is always
 *  visible as a dated number rather than an unstamped one. */
function fmtCounted(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Channel/type -> send-kind classifier. Reads the `type`/`channel` columns OutreachLogMessage
 * carries:
 *   - message_type 'connection_note' | 'connection_request'  -> the invite (with note)
 *   - message_type 'inmail'                                  -> PAID InMail (uses the allowance)
 *   - anything else on an inmail channel                     -> FREE open-profile message
 *   - channel 'email' OR message_type 'email'                -> email (outside this LinkedIn
 *                                                                split; excluded from the plate)
 *   - anything else outbound                                 -> a DM
 * The old OR-branch (`t === 'inmail' || ch.includes('inmail')`) folded the free open-profile
 * lane into the paid InMail bar (verified row-level 2026-08-02: "24 InMails" was really
 * 15 paid + 9 free, separable by message_type with zero all-time exceptions). A client reads
 * "InMails" as the paid, allowance-consuming channel, so the two are never summed again.
 */
type SendKind = 'invite' | 'dm' | 'inmail' | 'openprofile' | 'email';
function classifyMessage(m: OutreachLogMessage): SendKind {
  const t = (m.type || '').toLowerCase();
  const ch = (m.channel || '').toLowerCase();
  if (t === 'connection_note' || t === 'connection_request') return 'invite';
  if (t === 'inmail') return 'inmail';
  if (ch.includes('inmail')) return 'openprofile';
  if (ch === 'email' || t === 'email') return 'email';
  return 'dm';
}

/** The staged RPC patch adds per-entry `connection_sent_at`/`connected_at` and inbound rows in
 *  `messages`. Neither field exists on the shipped OutreachLogEntry type; this local extension
 *  lets the surface light up automatically when the patched feed arrives, and render honestly
 *  (no fake rows) until it does. */
type LogEntryExt = OutreachLogEntry & { connection_sent_at?: string | null; connected_at?: string | null };

/** n === 1 ? '' : 's' — the headline sentence prints real counts, so it has to survive a 1. */
const plural = (n: number) => (n === 1 ? '' : 's');

function countInWindow(msgs: OutreachLogMessage[], start: Date, end: Date, kind?: SendKind): number {
  let n = 0;
  for (const m of msgs) {
    if (!m.sent_at) continue;
    const t = Date.parse(m.sent_at);
    if (Number.isNaN(t) || t < start.getTime() || t >= end.getTime()) continue;
    if (kind && classifyMessage(m) !== kind) continue;
    n++;
  }
  return n;
}

export default function DeskOutreachSurface({
  board, accent, usage = null, log = null, status = null, foldLeads = null, signals = null,
}: {
  board: Board;
  accent: string;
  usage?: OutreachUsage | null;
  log?: OutreachLogEntry[] | null;
  status?: OutreachStatus | null;
  foldLeads?: React.ReactNode;
  /** Live funnel-instrument reads (client_board_funnel_signals). Progressive
   *  enhancement: absent simply means the "who is looking" tile does not render. */
  signals?: FunnelSignals | null;
}) {
  const o = board.outreach;
  // Ivan 2026-09-02: the embedded review page can go full-screen on the same tab.
  const [reviewFull, setReviewFull] = useState(false);

  if (!o) {
    return (
      <div className="pb-16" data-surface="desk-outreach">
        <Eyebrow>Outreach</Eyebrow>
        <Card style={{ marginTop: 12 }}>
          <Blank style={{ maxWidth: 220 }} />
          <Footnote>Your outreach program lands here once it is set up.</Footnote>
        </Card>
      </div>
    );
  }

  // Retired lanes are filtered by name; switched-off lanes are filtered by their LIVE
  // campaign state (see liveLanes). Two different questions, two different sources, and
  // neither one names a lane in code.
  const lanes = liveLanes((o.lanes || []).filter((ln) => !isDeadLane(ln.name, ln.status, ln.arms)), status);
  const entries = log || [];

  // ── Flatten the live send log once: every real outbound/inbound message, across every
  // prospect, with its parent entry attached (unsent drafts carry no sent_at, so they are
  // excluded here exactly as the original's `sent` filter did). ──────────────────────────
  const allOutbound: { m: OutreachLogMessage; e: OutreachLogEntry }[] = [];
  const allInbound: { m: OutreachLogMessage; e: OutreachLogEntry }[] = [];
  for (const e of entries) {
    for (const m of e.messages || []) {
      if (!m.sent_at) continue;
      if (m.direction === 'outbound') allOutbound.push({ m, e });
      else if (m.direction === 'inbound') allInbound.push({ m, e });
    }
  }
  const outboundMsgs = allOutbound.map((x) => x.m);
  const inboundMsgs = allInbound.map((x) => x.m);
  const hasSends = outboundMsgs.length > 0;

  const now = new Date();
  const thisWeekStart = mondayOf(now);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);
  // The week before last. Ivan, 2026-08-26: "prob not a good way to show data against a
  // current in process week tbh always will look lower." He is right — a full week beside a
  // two-day week is a comparison that can only ever read as a fall. The plate now compares
  // the two CLOSED weeks (like against like) and prints the open week separately, labelled
  // with how far into it we are, exactly as the hero above already does.
  const priorWeekStart = addDays(thisWeekStart, -14);
  /** How many of the five send days of the open week have started, counting today. Sunday
   *  belongs to the week that opened six days earlier, so its send days are all done. */
  const sendDaysIn = (() => {
    const d = now.getDay();
    return d === 0 ? 5 : Math.min(d, 5);
  })();
  /** The same moment of last week, so a partial week is only ever compared with the same
   *  slice of the week before it. Straight arithmetic on the week start, no clock drift. */
  const samePointLastWeek = new Date(lastWeekStart.getTime() + (now.getTime() - thisWeekStart.getTime()));

  // ── board.outreach_truth: the server-computed booked/replied/funnel truth (goal-run
  // rise-panel-truth-2026-08-25, extended 2026-08-26). When present it is the ONLY source
  // for anything about replies, accepts, bookings or the funnel; the live send log stays
  // the source for what WE sent. Absent (a board that predates the write) -> every
  // fallback below is the pre-blob behaviour, unchanged. Every number sourced from it
  // carries its counted_at; every number computed here from the send log carries the time
  // that log was read. No rendered count on this tab is left unstamped. ─────────────────
  const ot = board.outreach_truth;
  const otBooked = ot && Array.isArray(ot.booked) ? ot.booked : null;
  const countedAt = ot?.counted_at ? fmtCounted(ot.counted_at) : '';
  const countedFull = ot?.counted_at ? countedStamp(ot.counted_at) : '';
  /** People who wrote back in the week starting `mondayLocal`, read off the blob's own
   *  Monday-based UTC week grid. This REPLACES the old client-side last_reply_at
   *  bucketing, which produced a different weekly figure than the client's weekly report
   *  did (predecessor Fork 3). Returns null when the blob has no row for that week, and
   *  the row then renders as a blank rather than as a zero. */
  const weeklyFromBlob = (mondayLocal: Date): number | null => {
    if (!ot || !Array.isArray(ot.replied_weekly)) return null;
    const key = `${mondayLocal.getFullYear()}-${pad2(mondayLocal.getMonth() + 1)}-${pad2(mondayLocal.getDate())}`;
    const row = ot.replied_weekly.find((w) => w.week_monday === key);
    return row ? row.people : null;
  };

  let earliestMs = Infinity;
  for (const m of outboundMsgs) {
    const t = Date.parse(m.sent_at as string);
    if (!Number.isNaN(t)) earliestMs = Math.min(earliestMs, t);
  }
  // Honesty gate: only show the closed-week comparison when the log's earliest send
  // actually reaches back that far. Two closed weeks of history -> the pair. One closed
  // week -> that week alone. Less than that -> the open week's counts alone.
  const twoWeekCoverage = hasSends && earliestMs <= lastWeekStart.getTime();
  const priorWeekCoverage = hasSends && earliestMs <= priorWeekStart.getTime();

  // ── Weekly "wrote back": PEOPLE, not messages, in two tiers. The shipped RPC hard-filters
  // `messages` to outbound-only, so counting inbound rows from it renders a FALSE 0 (verified
  // 2026-08-02: the true week-of-27-Jul figure was 8 people / 17 messages while the plate said
  // 0). Tier 1 (post-patch feed): distinct people with >=1 inbound message in the window.
  // Tier 2 (today's feed): entries with `replied` whose `last_reply_at` falls in the window —
  // reproduces the verified 8 / 4 on live data. An empty inboundMsgs array is a feed-shape
  // artifact, never evidence of silence, so it NEVER gates the fallback off. ─────────────────
  const hasInboundFeed = allInbound.length > 0;
  const peopleWroteBack = (start: Date, end: Date): number => {
    if (hasInboundFeed) {
      const ids = new Set<string>();
      for (const { m, e } of allInbound) {
        const t = Date.parse(m.sent_at as string);
        if (!Number.isNaN(t) && t >= start.getTime() && t < end.getTime()) ids.add(e.prospect_id);
      }
      return ids.size;
    }
    let n = 0;
    for (const e of entries) {
      if (!e.replied || !e.last_reply_at) continue;
      const t = Date.parse(e.last_reply_at);
      if (!Number.isNaN(t) && t >= start.getTime() && t < end.getTime()) n++;
    }
    return n;
  };

  // ── Weekly accepts, "landed" definition: an accept counts in the week it ARRIVED, never the
  // week its invite went out (the two definitions genuinely diverge in the data and must never
  // collapse). `connected_at` only exists once the staged RPC patch ships; until any entry
  // carries the key, no row renders — the funnel's program-to-date accepts stays the only
  // accept figure on the tab. ────────────────────────────────────────────────────────────────
  const entriesExt = entries as LogEntryExt[];
  const hasAcceptField = entriesExt.some((e) => 'connected_at' in e);
  const acceptsLanded = (start: Date, end: Date): number => {
    let n = 0;
    for (const e of entriesExt) {
      if (!e.connected_at) continue;
      const t = Date.parse(e.connected_at);
      if (!Number.isNaN(t) && t >= start.getTime() && t < end.getTime()) n++;
    }
    return n;
  };

  /** Every channel figure for one window. `wroteBack` prefers the blob's own week grid and
   *  only falls back to the log when the blob has no row for that Monday. */
  const windowCounts = (start: Date, end: Date) => ({
    invites: countInWindow(outboundMsgs, start, end, 'invite'),
    accepted: acceptsLanded(start, end),
    dms: countInWindow(outboundMsgs, start, end, 'dm'),
    inmails: countInWindow(outboundMsgs, start, end, 'inmail'),
    openprofile: countInWindow(outboundMsgs, start, end, 'openprofile'),
    wroteBack: weeklyFromBlob(start) ?? peopleWroteBack(start, end),
  });
  // The two closed weeks, which is what the plate compares. The open week is computed
  // separately and never sits in the same comparison.
  const priorWeek = windowCounts(priorWeekStart, lastWeekStart);
  const lastWeek = windowCounts(lastWeekStart, thisWeekStart);
  const thisWeek = windowCounts(thisWeekStart, nextWeekStart);
  /** The same slice of last week, for the open week's comparator. Sends only: an accept
   *  lands off invites sent days earlier, so a mid-week accept comparison is not like for
   *  like, and "wrote back" is only counted whole-week by the server. Both of those print
   *  their so-far number with no comparator rather than a misleading one. */
  const samePoint: Partial<Record<keyof typeof thisWeek, number>> = {
    invites: countInWindow(outboundMsgs, lastWeekStart, samePointLastWeek, 'invite'),
    dms: countInWindow(outboundMsgs, lastWeekStart, samePointLastWeek, 'dm'),
    inmails: countInWindow(outboundMsgs, lastWeekStart, samePointLastWeek, 'inmail'),
    openprofile: countInWindow(outboundMsgs, lastWeekStart, samePointLastWeek, 'openprofile'),
  };
  /** True when the "Wrote back" figures came off the blob rather than off the log, so the
   *  row can carry the blob's counted_at instead of the log's read time. */
  const wroteBackFromBlob = weeklyFromBlob(lastWeekStart) !== null;

  // The open-profile row only earns its place once the lane has actually sent in either week —
  // never a permanent zero row. The Accepted row only exists once the feed carries the field.
  const showOpenProfile = thisWeek.openprofile > 0 || lastWeek.openprofile > 0 || priorWeek.openprofile > 0;
  const CATS: { key: keyof typeof thisWeek; label: string; note?: string }[] = [
    { key: 'invites', label: 'Connection invites' },
    ...(hasAcceptField ? [{ key: 'accepted' as const, label: 'Accepted', note: '· invites that turned into connections' }] : []),
    { key: 'dms', label: 'DMs', note: '· follow-ups included' },
    { key: 'inmails', label: 'InMails', note: '· uses the monthly InMail allowance' },
    ...(showOpenProfile ? [{ key: 'openprofile' as const, label: 'Open profile messages', note: '· free, no connection needed' }] : []),
    { key: 'wroteBack', label: 'Wrote back', note: '· people, not messages' },
  ];

  // ── To-date funnel: people contacted (real) -> accepted (not in the log, honest blank) ->
  // wrote back (real, entry-level so it matches the Leads journey number below) -> calls
  // booked (real once board.precall_briefs has rows, blank until then). ────────────────────
  // The send-log contacted figure. Used for the funnel ONLY when the blob is absent: the
  // blob's `contacted` counts the whole program from the prospect table, the log's counts
  // the people this feed happens to carry, and mixing the two would put a percentage on
  // the page whose numerator and denominator came from different populations.
  const contactedFromLog = entries.filter((e) => (e.messages || []).some((m) => m.direction === 'outbound' && m.sent_at)).length;
  const contactedCount = ot?.funnel && typeof ot.funnel.contacted === 'number' ? ot.funnel.contacted : contactedFromLog;
  // The send-log feed can be empty for a seat whose messages the log RPC does not carry (ARCH,
  // 2026-09-02: 63 people contacted, log empty, and the tab said nothing had gone out). The
  // program has sends when EITHER source says so; the headline never denies the counted blob.
  const programHasSends = hasSends || contactedCount > 0;
  const repliedCount = ot && ot.funnel && typeof ot.funnel.replied_people === 'number'
    ? ot.funnel.replied_people
    : entries.filter((e) => e.replied).length;
  const callsBookedCount = ot?.funnel && typeof ot.funnel.booked === 'number'
    ? ot.funnel.booked
    : otBooked ? otBooked.length : (board.precall_briefs || []).length;
  const wroteBackPct = barPct(repliedCount, contactedCount);

  // Normalized booked-calls rows: outreach_truth.booked (name/company/booked_at/brief_url/
  // scan_url, and it can carry a hand-closed booking precall_briefs never sees) when present,
  // else the original precall_briefs shape, unchanged.
  type BookedRow = { id: string; name: string; company?: string | null; when_str?: string; booked_note?: string; brief_url?: string | null; scan_url?: string | null };
  const bookedRows: BookedRow[] = otBooked
    ? otBooked.map((b, i) => ({
        id: b.prospect_id || `${b.name || 'booked'}-${i}`,
        name: b.name || '(unnamed)',
        company: b.company,
        when_str: b.booked_at ? shortDateTime(new Date(b.booked_at)) : undefined,
        brief_url: b.brief_url,
        scan_url: b.scan_url,
      }))
    : (board.precall_briefs || []).map((b) => ({
        id: b.id, name: b.name, company: b.company || b.domain, when_str: b.when_str, booked_note: b.booked_note, brief_url: b.brief_url, scan_url: b.scan_url,
      }));

  // Accepts ARE tracked — not in the send log (an accept is not a message), but in the
  // blob's funnel (whole program, counted server-side) and, on boards without the blob, in
  // performance.outreach_indicators. Only an indicator with a captured_at stamp is a real
  // reading: a value with no stamp is an unfilled slot and still renders the honest blank.
  // Either way the figure is CUMULATIVE, which is why the label says "whole program" — the
  // weekly report's accepted figure is windowed and the two must never be read as one.
  const acceptsInd = (board.performance?.outreach_indicators || []).find(
    (ind) => /accept/i.test(`${ind.key || ''} ${ind.label || ''}`) && !!ind.captured_at && typeof ind.value === 'number',
  );
  const acceptsValue = ot?.funnel && typeof ot.funnel.accepted === 'number'
    ? ot.funnel.accepted
    : acceptsInd ? (acceptsInd.value as number) : null;
  /** The stamp that belongs to the accepted figure, whichever source produced it. */
  const acceptsStamp = ot?.funnel && typeof ot.funnel.accepted === 'number'
    ? countedAt
    : acceptsInd?.captured_at ? fmtCounted(acceptsInd.captured_at) : '';

  const funnelSteps: FunnelStep[] = [
    { value: contactedCount, label: 'People contacted', note: '· first touch only, one per person, whole program', pct: barPct(contactedCount, contactedCount) },
    acceptsValue !== null
      ? { value: acceptsValue, label: 'Accepted the invite', note: `· whole program to date${acceptsStamp ? `, counted ${acceptsStamp}` : ''}`, pct: barPct(acceptsValue, contactedCount) }
      : { label: 'Accepted the invite', blank: true },
    {
      value: repliedCount, label: 'Wrote back', pct: wroteBackPct, highlight: true,
      note: '· people, whole program',
      delta: contactedCount > 0 ? `→ ${Math.round(wroteBackPct)}% of contacted` : undefined,
    },
    callsBookedCount > 0
      ? { value: callsBookedCount, label: 'Calls booked', note: '· whole program', pct: barPct(callsBookedCount, callsBookedCount) }
      : { label: 'Calls booked', blank: true },
  ];

  // ── Candidate list: named board.outreach.candidates + orbit_finds, merged. No numeric
  // fit/score field exists on either source in the live Board type, and none is ever added
  // here on purpose - the underlying ICP scorer is known-inverted, so a number would be
  // worse than nothing. ───────────────────────────────────────────────────────────────────
  type CandidateRow = { name: string; role?: string; company?: string; domain?: string; note?: string; linkedinUrl?: string };
  const candidateRows: CandidateRow[] = [];
  (o.candidates?.groups || []).forEach((g) => (g.items || []).forEach((it) => candidateRows.push({
    name: it.name, role: it.role, company: it.company, domain: it.domain, note: it.note, linkedinUrl: it.linkedin_url,
  })));
  (o.orbit_finds?.people || []).forEach((p) => candidateRows.push({
    name: p.name, role: p.role, company: p.company, domain: p.domain, note: p.one_liner || p.caveat, linkedinUrl: p.linkedin_url,
  }));
  const icpBar = o.icp?.bar || [];

  // ── Send-log Drill counts: real "today" + all-time totals, from the same flattened log. ──
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = addDays(todayStart, 1);
  const sentToday = countInWindow(outboundMsgs, todayStart, tomorrowStart);
  // Same two tiers as the weekly figure: inbound rows when the feed ships them, otherwise
  // replied entries by last_reply_at — never a false 0 off the outbound-only feed.
  const repliesToday = hasInboundFeed
    ? countInWindow(inboundMsgs, todayStart, tomorrowStart)
    : peopleWroteBack(todayStart, tomorrowStart);

  // ── The trail, narrowed to the people who said yes (Ivan, 2026-08-26). The full log was
  // 871 people deep and answered a question nobody asked. Boards whose blob carries no
  // reply intents keep the whole log, so this can never blank a surface. ─────────────────
  const intentFiltered = hasReplyIntents(ot);
  const trailEntries = positiveReplierLog(entries, ot);

  return (
    <div className="pb-16" data-surface="desk-outreach">

      <Eyebrow>Outreach</Eyebrow>
      {/* The headline names its own window. The sends in it are the calendar week to date;
          "wrote back" is the same week off the blob's week grid. Two different sources,
          one stated period, and the stamp under it says when each was read. */}
      <DeskH2>
        {hasSends ? (
          <>Week of {shortDate(thisWeekStart)}, {sendDaysIn} of 5 send days in: {thisWeek.invites} invite{plural(thisWeek.invites)}, {thisWeek.dms} DM{plural(thisWeek.dms)}, {thisWeek.inmails} InMail{plural(thisWeek.inmails)}{thisWeek.openprofile > 0 ? <>, {thisWeek.openprofile} open profile message{plural(thisWeek.openprofile)}</> : null}. <b>{thisWeek.wroteBack} wrote back.</b></>
        ) : programHasSends ? (
          <>{contactedCount} people contacted so far. <b>{repliedCount} wrote back{callsBookedCount > 0 ? `, ${callsBookedCount} booked a call` : ''}.</b></>
        ) : (
          <>Sends have not started yet. <b>Nothing has gone out under your name.</b></>
        )}
      </DeskH2>
      {hasSends && (
        <Footnote>
          Sends read from your live send record at {shortDateTime(now)}.
          {wroteBackFromBlob ? <> Replies counted {countedFull}.</> : null}
        </Footnote>
      )}

      {/* The review page, embedded (Ivan 2026-09-02). The leads waiting on the client live on
          their own shared page; it renders in place so the client reviews without leaving the
          tab. Same origin, so that page's own Submit button works inside the frame. */}
      {o.candidates?.list_url && (() => {
        const btn: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cb-ink)', background: 'transparent', border: '1px solid var(--cb-line-bold)', borderRadius: 999, padding: '6px 13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
        const link: React.CSSProperties = { ...btn, textDecoration: 'none', display: 'inline-block' };
        const head = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Eyebrow tone="ink">Your review page</Eyebrow>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>tap a company to skip it, then copy</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setReviewFull((v) => !v)} style={btn}>{reviewFull ? 'close' : 'expand'}</button>
              <a href={o.candidates.list_url} target="_blank" rel="noreferrer" style={link}>new tab</a>
            </span>
          </div>
        );
        const frame = (h: string) => (
          <iframe src={o.candidates!.list_url} title="Review page" allow="clipboard-write" loading="lazy" style={{ display: 'block', width: '100%', height: h, border: '1px solid var(--cb-line)', borderRadius: 14, marginTop: 12, background: '#0b1030' }} />
        );
        return reviewFull ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--cb-paper, #f6f6f3)', padding: '14px 18px 18px', display: 'flex', flexDirection: 'column' }}>
            {head}
            <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
              <iframe src={o.candidates.list_url} title="Review page" allow="clipboard-write" style={{ flex: '1 1 auto', width: '100%', height: '100%', border: '1px solid var(--cb-line)', borderRadius: 14, marginTop: 12, background: '#0b1030' }} />
            </div>
          </div>
        ) : (
          <Card style={{ marginTop: 16, padding: '16px 26px 20px' }}>
            {head}
            {frame('min(1200px, 88vh)')}
          </Card>
        );
      })()}

      {/* THE TOP OF THE PANEL (ballot winner, Ivan 2026-08-26: layout A with C's hero
          graft). Renders only when board.outreach_truth exists; the blocks below stay as
          they were for any board without it. Shared verbatim with the ?skin= branch. */}
      <OutreachTopOfPanel board={board} accent={accent} log={log} signals={signals} />

      {/* 0 — up next: today's pace against the cap and the real named send queue.
          Desk-kit port of the original UpNextBlock (that one carries 9-10.5px type and
          fails the floor; the data contract is identical). ICP scores never render. */}
      {status && (status.is_live || status.dispatch_scheduled) && (
        <Card style={{ marginTop: 16, padding: '18px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <Eyebrow tone="ink">Up next</Eyebrow>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>what goes out, and when</span>
            {status.next_window_at && (
              <Chip style={{ marginLeft: 'auto' }}>next send {new Date(status.next_window_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT</Chip>
            )}
          </div>
          {(() => {
            const nextIsToday = !!status.next_window_at && new Date(status.next_window_at).toLocaleDateString('sv-SE', { timeZone: 'America/Los_Angeles' }) === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Los_Angeles' });
            const sendDay = status.todays_sends > 0 || nextIsToday;
            return sendDay ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
                  <Num size="big" inline>{status.todays_sends}</Num>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>of {status.daily_cap} sends today</span>
                </div>
                <div className="bar" style={{ marginTop: 9, height: 9, borderRadius: 999, background: 'var(--cb-paper-sunk)', overflow: 'hidden' }} data-viz>
                  <div style={{ height: '100%', width: `${barPct(status.todays_sends, status.daily_cap)}%`, borderRadius: 999, background: 'var(--cb-accent)' }} />
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
                <Num size="big" inline>{status.daily_cap}</Num>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>go out on a send day, none today</span>
              </div>
            );
          })()}
          {(status.up_next || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              {(status.up_next || []).slice(0, 5).map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderTop: '1px solid var(--cb-line)', flexWrap: 'wrap' }}>
                  <span style={{ flex: 'none', width: 20, fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{u.name}</span>
                  {u.company && <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: 12.5, color: 'var(--cb-ink-mute)' }}>{u.company}</span>}
                  {u.lane && <Chip style={{ flex: 'none', marginLeft: 'auto' }}>{scrubVendor(u.lane) === 'orbit' ? 'client orbit' : scrubVendor(u.lane)}</Chip>}
                </div>
              ))}
              {(status.up_next || []).length > 5 && (
                <Footnote style={{ marginTop: 7 }}>+{(status.up_next || []).length - 5} more in the queue</Footnote>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 1 — this week against last, split by channel. Only once something has gone out:
          an empty plate saying so was a paragraph for nothing (Ivan, 2026-09-02). */}
      {hasSends && (
      <Plate style={{ marginTop: 18 }} pad="26px 26px 22px">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <Eyebrow on="plate">Week against week</Eyebrow>
          <PlateMute style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>{shortDate(now)}</PlateMute>
        </div>

        {!hasSends ? (
          <div style={{ marginTop: 18 }}>
            <Blank on="plate" style={{ maxWidth: 200 }} />
            <Footnote on="plate">Sends have not started. Nothing has gone out yet, so there is nothing to compare week to week.</Footnote>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            {CATS.map((cat, i) => {
              // Both bars in a group are scaled against that group's own max, so the two
              // CLOSED weeks stay comparable and a 0 draws NOTHING. A group where both weeks
              // are 0 (max 0) renders two empty tracks — the numerals carry it. The open
              // week is deliberately outside this scale: it has no bar at all, because a
              // part-week bar beside a full-week bar is the exact false read Ivan flagged.
              const groupMax = priorWeekCoverage
                ? Math.max(lastWeek[cat.key], priorWeek[cat.key])
                : lastWeek[cat.key];
              const soFar = thisWeek[cat.key];
              const vs = samePoint[cat.key];
              return (
              <div key={cat.key} style={{ marginTop: i > 0 ? 15 : 0 }}>
                {i > 0 && <PlateRule gap={0} />}
                <div style={{ marginTop: i > 0 ? 14 : 0, fontSize: 13.5, fontWeight: 700, color: 'var(--cb-plate-ink)' }}>
                  {cat.label}{cat.note && <PlateMute style={{ fontWeight: 600 }}> {cat.note}</PlateMute>}
                </div>
                {priorWeekCoverage && (
                  <BarRow
                    on="plate"
                    label={`w/ ${shortDate(priorWeekStart)}`}
                    value={<Num size="row" inline tone="plate-mute">{priorWeek[cat.key]}</Num>}
                    pct={barPct(priorWeek[cat.key], groupMax)}
                  />
                )}
                {twoWeekCoverage && (
                  <BarRow
                    on="plate"
                    tone="strong"
                    label={`w/ ${shortDate(lastWeekStart)}`}
                    value={<Num size="big" inline tone="plate">{lastWeek[cat.key]}</Num>}
                    pct={barPct(lastWeek[cat.key], groupMax)}
                  />
                )}
                {/* The week in progress: a number, how far in it is, and the same slice of
                    last week where that slice is a like-for-like read. No bar, no pace, no
                    projection. */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, flexWrap: 'wrap', marginTop: 9 }}>
                  <PlateMute style={{ flex: 'none', width: 114, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    w/ {shortDate(thisWeekStart)}, so far
                  </PlateMute>
                  <span style={{ flex: 'none', width: 56, textAlign: 'right' }}>
                    <Num size="row" inline tone="plate">{soFar}</Num>
                  </span>
                  <PlateMute style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {sendDaysIn} of 5 send days in
                    {typeof vs === 'number' ? `, against ${vs} by this point last week` : ''}
                  </PlateMute>
                </div>
              </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 17 }}>
          {priorWeekCoverage ? (
            <Chip tone="plate">2 closed weeks side by side: direction, not a trend</Chip>
          ) : twoWeekCoverage ? (
            <Chip tone="plate">1 closed week of sends so far: the week in progress sits below it</Chip>
          ) : hasSends ? (
            <Chip tone="plate">Less than a full week of sends so far: the counts stand alone</Chip>
          ) : null}
        </div>
        {/* Every bar on this plate carries the moment its source was read: the send rows
            come off the live send record, the "Wrote back" rows come off the counted blob.
            Two sources, two stamps, never one silent number. */}
        {hasSends && (
          <Footnote on="plate">
            Invites, DMs, InMails and open profile messages read from your live send record at {shortDateTime(now)}.
            {wroteBackFromBlob ? <> Wrote back counted {countedFull}.</> : null}
          </Footnote>
        )}
      </Plate>
      )}

      {/* 2 — everyone contacted so far, whole program. Every step here is cumulative and
          says so, because the weekly report counts accepts inside a window and the two
          figures are supposed to differ. */}
      {!(ot && ot.counted_at) && (
      <Plate style={{ marginTop: 22 }} pad="26px 26px 22px">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <Eyebrow on="plate">Everyone contacted so far</Eyebrow>
          <PlateMute style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>
            {ot ? `counted ${countedFull}` : `as of ${shortDateTime(now)}`}
          </PlateMute>
        </div>
        <div style={{ marginTop: 18 }}>
          <Funnel steps={funnelSteps} on="plate" />
        </div>
        <Footnote on="plate">Whole-program totals, read from your live send record at {shortDateTime(now)}.</Footnote>
      </Plate>
      )}

      {/* 3 — the send allowance, collapsed (the frag demoted it off the top of the tab). */}
      {usage && (
        <Card style={{ marginTop: 12, padding: '4px 26px' }}>
          {/* The month counters reset on the 1st, so early in a month they sit UNDER the week
              total printed above them. Naming the month is what keeps the smaller number from
              reading as a contradiction of the weekly plate. */}
          <Drill
            label="open it"
            summaryLeft={<>Sent in {MONTHS_FULL[now.getMonth()]} so far: <b>{usage.connect_sent}</b> invite{usage.connect_sent === 1 ? '' : 's'}, <b>{usage.dm_sent}</b> DM{usage.dm_sent === 1 ? '' : 's'}</>}
          >
            <Cols n={3} gap={20}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <Num size="big" inline>{usage.connect_sent}</Num>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>invites sent &middot; cap {usage.connect_cap}</span>
                </div>
                <div className="bar" style={{ marginTop: 9, height: 12, borderRadius: 999, background: 'var(--cb-paper-sunk)', overflow: 'hidden' }}>
                  <div className="barfill" style={{ height: '100%', width: `${barPct(usage.connect_sent, usage.connect_cap)}%`, borderRadius: 999, background: 'var(--cb-accent)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <Num size="big" inline>{usage.dm_sent}</Num>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>DMs sent &middot; no cap set</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <Num size="big" inline>{usage.inmail_used}</Num>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>InMails sent &middot; cap {usage.inmail_cap}</span>
                </div>
                <div className="bar" style={{ marginTop: 9, height: 12, borderRadius: 999, background: 'var(--cb-paper-sunk)', overflow: 'hidden' }}>
                  <div className="barfill" style={{ height: '100%', width: `${barPct(usage.inmail_used, usage.inmail_cap)}%`, borderRadius: 999, background: 'var(--cb-accent)' }} />
                </div>
              </div>
            </Cols>
            <Footnote>The caps are ours, set low on purpose. These counters cover {MONTHS_FULL[now.getMonth()]} only and start again on the 1st.</Footnote>
          </Drill>
        </Card>
      )}

      {/* 4 + 5 — Leads journey and Booked calls. Both are FALLBACKS now: when
          board.outreach_truth exists, OutreachTopOfPanel above renders the same two facts
          at the top of the panel, with names and stamps, and repeating them here would put
          the same number on the page twice. Boards without the blob keep these blocks
          exactly as they shipped. */}
      {!ot && (<>
      <Eyebrow style={{ marginTop: 28 }}>Leads</Eyebrow>
      <Plate style={{ marginTop: 12 }} pad="28px 26px 24px">
        <JourneyPlate
          left={{ value: repliedCount, label: 'Replies in play', sub: `as of ${shortDateTime(now)}` }}
          right={callsBookedCount > 0 ? { value: callsBookedCount, label: 'Calls booked' } : { label: 'Calls booked', blank: true }}
        />
        <Footnote on="plate">Read from your live send record at {shortDateTime(now)}.</Footnote>
      </Plate>

      <Card style={{ marginTop: 12, padding: '22px 26px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <Eyebrow>Booked calls</Eyebrow>
            <span style={{ fontFamily: 'var(--cb-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', letterSpacing: '0.04em' }}>from your LinkedIn booking link</span>
          </div>
          {bookedRows.length === 0 ? (
            <div style={{
              marginTop: 14, border: '1px dashed var(--cb-line-bold)', borderRadius: 25,
              background: 'var(--cb-paper-sunk)', padding: '30px 28px',
            }}>
              <b style={{ display: 'block', fontFamily: 'var(--cb-serif)', fontSize: 19, fontWeight: 600, color: 'var(--cb-ink)', marginBottom: 8 }}>None yet.</b>
              <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--cb-ink-mute)' }}>
                Bookings land here with the pre-call brief.
              </div>
            </div>
          ) : (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bookedRows.map((b) => (
              <div key={b.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', borderRadius: 14, background: 'var(--cb-paper-raise, #fff)', border: '1px solid var(--cb-line)', padding: '14px 16px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{b.name}</span>
                    {b.company && <span style={{ fontSize: 12, color: 'var(--cb-ink-soft)' }}>{b.company}</span>}
                  </div>
                  {b.when_str && <div style={{ fontFamily: 'var(--cb-mono)', fontSize: 11.5, color: 'var(--cb-ink-mute)', marginTop: 2 }}>{b.when_str}</div>}
                  {b.booked_note && <div style={{ fontSize: 11.5, color: 'var(--cb-ink-mute)', marginTop: 2 }}>{b.booked_note}</div>}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flex: 'none', alignItems: 'center', gap: 8 }}>
                  {b.scan_url && (
                    <a href={b.scan_url} target="_blank" rel="noreferrer" style={{ borderRadius: 10, padding: '7px 13px', fontFamily: 'var(--cb-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cb-ink)', border: '1px solid var(--cb-line-bold)' }}>Their scan</a>
                  )}
                  {b.brief_url && (
                    <a href={b.brief_url} target="_blank" rel="noreferrer" style={{ borderRadius: 10, padding: '7px 13px', fontFamily: 'var(--cb-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: inkOn(accent), background: accent, border: '1px solid var(--cb-line-bold)' }}>Pre-call brief</a>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
      </Card>
      </>)}

      {/* 6 — The bar: who qualifies, driven entirely by board.outreach.icp. */}
      {o.icp && icpBar.length > 0 && (
        <>
          <div style={{ marginTop: 16 }}>
          <Fold title="The bar" note="who gets a message from your name, and who never does">
            {/* Authored, approved card title — NOT o.icp.label. The live label is a segment
                name ("DTC brand founders and operators"); the client's question is whose
                inbox his name shows up in, and the checks below answer exactly that. */}
            <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 19, lineHeight: 1.3, color: 'var(--cb-ink)' }}>
              Who gets a message from your name
            </div>
            <div style={{ marginTop: 15 }}>
              {icpBar.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderTop: '1px solid var(--cb-line)' }}>
                  <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, background: 'var(--cb-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.4 7.4 5.6 10.6 11.6 3.8" fill="none" stroke={inkOn(accent)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ flex: 'none', fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0, color: 'var(--cb-ink)' }}>{b}</span>
                </div>
              ))}
            </div>
            {/* Ivan 2026-09-02: the bar mixed who qualifies with who is banned. icp.out carries
                the exclusions as their own list under their own heading. */}
            {Array.isArray(o.icp.out) && o.icp.out.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 17, lineHeight: 1.3, color: 'var(--cb-ink)', marginTop: 22 }}>
                  Who stays off the list
                </div>
                <div style={{ marginTop: 10 }}>
                  {o.icp.out.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderTop: '1px solid var(--cb-line)' }}>
                      <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, border: '1px solid var(--cb-line-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cb-ink-mute)', fontSize: 13, fontWeight: 800 }} aria-hidden>&times;</span>
                      <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0, color: 'var(--cb-ink)' }}>{b}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {o.icp.note && <Footnote>{o.icp.note}</Footnote>}
          </Fold>
          </div>
        </>
      )}

      {/* 7-9 — Happening now: the live lanes, the candidate list, the send log. All three
          share one card, matching the frag's density. The send-log Drill inside always
          renders (honest-empty until sends go live), so this card is never itself empty. */}
      <Eyebrow style={{ marginTop: 28 }}>Happening now</Eyebrow>
      <Card style={{ marginTop: 12, padding: '4px 26px' }}>
            {lanes.map((ln, i) => {
              // Every string on this row goes through the vendor scrub on its way to the
              // screen; the description is clipped to one short line so it costs the tab a
              // line, not a paragraph.
              const detail = clipDetail(scrubVendor(ln.detail));
              const arms = scrubVendor(ln.arms);
              const status = safeStatus(ln.status);
              return (
              <div key={ln.key || ln.name} style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '16px 0', borderTop: i > 0 ? '1px solid var(--cb-line)' : undefined }}>
                <div style={{ flex: '1 1 230px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 16, color: 'var(--cb-ink)' }}>
                    {ln.href ? <a href={ln.href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--cb-line-bold)' }}>{laneName(ln.name)}</a> : laneName(ln.name)}
                  </div>
                  {detail && <div style={{ fontSize: 14, color: 'var(--cb-ink-soft)', marginTop: 3 }}>{detail}</div>}
                </div>
                {arms && <Chip>{arms}</Chip>}
                {status && <Chip tone="accent">{status}</Chip>}
                <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  {typeof ln.scanned === 'number' ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Num size="row" inline tone="mute">{ln.scanned}</Num>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>found</span>
                      <span style={{ color: 'var(--cb-ink-mute)', fontWeight: 800 }}>&rarr;</span>
                      <Num size="row" inline>{typeof ln.count === 'number' ? ln.count : (ln.fits ?? 0)}</Num>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>in outreach</span>
                    </div>
                  ) : typeof ln.count === 'number' ? (
                    <>
                      <Num size="row" inline>{ln.count}</Num>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 4 }}>waiting in the queue</div>
                    </>
                  ) : (
                    <>
                      <Blank style={{ display: 'inline-flex', width: 46, height: 28, minHeight: 28 }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 4 }}>lane count: not tracked yet</div>
                    </>
                  )}
                </div>
              </div>
              );
            })}

            {/* 8 — the current list. When the full list lives on its own shared review
                page (candidates.list_url), the row links straight there and carries that
                page's own count: the in-blob excerpt goes stale between cycles, and a
                stale count on this line is exactly the drift the review page exists to
                prevent. No list_url -> the in-blob Drill renders unchanged. */}
            {/* The review page itself is embedded at the top of the tab (2026-09-02), so no
                stale 'current list: N names' line under the lanes. */}
            {!o.candidates?.list_url && candidateRows.length > 0 && (
              // The count, on one line, with no roster behind it. Ivan cut the name-by-name
              // dump on 2026-08-26: the panel's job is who is talking to him, and 81 names he
              // has not met yet is a directory, not an answer. The number survives so the
              // supply figure is still on the page.
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '13px 0', borderTop: '1px solid var(--cb-line)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cb-ink-soft)' }}>
                  The current list: <b>{candidateRows.length}</b> name{candidateRows.length === 1 ? '' : 's'} sourced and cleared, waiting their turn
                </span>
              </div>
            )}

            {/* 9 — send log Drill: real per-lead outbound trail, honest empty. Only on boards
                without a counted blob: with one, "Leads in play" above already lists everyone. */}
            {!(ot && ot.counted_at) && (
            <Drill
              label="open it"
              summaryLeft={
                !hasSends ? (programHasSends ? <>Send log: <b>{contactedCount}</b> people contacted so far</> : <>Send log: nothing sent yet</>)
                : intentFiltered ? <>The people who said yes: <b>{trailEntries.length}</b>, and every message that went to them</>
                : <>Today&rsquo;s log: <b>{sentToday}</b> messages out &middot; <b>{repliesToday}</b> replies in</>
              }
            >
              {!hasSends ? (
                <Footnote>
                  Every message that goes out under your name lands here with its date and whether they replied.
                </Footnote>
              ) : intentFiltered && trailEntries.length === 0 ? (
                <Footnote style={{ marginTop: 0 }}>
                  Nobody has come back interested in the last 7 days. The moment someone does, their name and
                  every message that went to them land here. {sentToday} message{sentToday === 1 ? '' : 's'} went
                  out today, read from your live send record at {shortDateTime(now)}.
                </Footnote>
              ) : (
                <div>
                  <Footnote style={{ marginTop: 0 }}>
                    {intentFiltered
                      ? <>Everyone whose latest reply reads as interested, counted {countedFull} over the trailing 7 days. {sentToday} message{sentToday === 1 ? '' : 's'} went out today and {repliesToday} came back, read from your live send record at {shortDateTime(now)}.</>
                      : <>Today&rsquo;s two counts read from your live send record at {shortDateTime(now)}, on this device&rsquo;s clock.</>}
                  </Footnote>
                  {trailEntries.map((e) => {
                    const sent = (e.messages || []).filter((m) => m.direction === 'outbound');
                    return (
                      // id: the target a roster name click opens. This IS the trail the
                      // panel already had; the roster reuses it rather than shipping a
                      // second one (mission instruction, critic F7).
                      <details key={e.prospect_id} id={sendLogAnchorId(e.name) || undefined} className="drill" style={{ marginTop: 8, borderRadius: 12, background: 'var(--cb-paper-sunk)', border: '1px solid var(--cb-line)' }}>
                        <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-ink)' }}>{e.name || '(unnamed)'}</span>
                          {e.company && <span style={{ fontSize: 12, color: 'var(--cb-ink-soft)' }}>{e.company}</span>}
                          {scrubVendor(e.lane || '') && <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--cb-ink-mute)', border: '1px solid var(--cb-line)', borderRadius: 999, padding: '1px 6px' }}>{scrubVendor(e.lane || '')}</span>}
                          {e.replied && <Chip tone="accent">replied</Chip>}
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{sent.length} sent</span>
                        </summary>
                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {sent.map((m, i) => (
                            <div key={i} style={{ borderRadius: 10, background: 'var(--cb-paper-raise, #fff)', border: '1px solid var(--cb-line)', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: caText(accent) }}>&rarr; sent</span>
                                <span style={{ fontFamily: 'var(--cb-mono)', fontSize: 11.5, color: 'var(--cb-ink-mute)' }}>
                                  {[m.type, m.channel].filter(Boolean).join(' · ')}{m.sent_at ? ` · ${shortDate(new Date(m.sent_at))}` : ''}
                                </span>
                              </div>
                              {m.text && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cb-ink-soft)', whiteSpace: 'pre-line' }}>{m.text}</div>}
                            </div>
                          ))}
                          {e.replied && (
                            <div style={{ fontFamily: 'var(--cb-mono)', fontSize: 11.5, color: caText(accent) }}>
                              Replied{e.last_reply_at ? ` · ${shortDate(new Date(e.last_reply_at))}` : ''}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </Drill>
            )}
      </Card>

      {/* 10 — the full leads view, folded in behind one more Drill so this tab carries every
          write path the old Leads tab had (detail modal, captured-leads table) without
          duplicating the drawn blocks above. */}
      {/* The folded full-leads view was cut 2026-09-02 (Ivan: empty, stalled). The prop stays
          so callers compile; nothing renders from it. */}
      {foldLeads ? null : null}
    </div>
  );
}
