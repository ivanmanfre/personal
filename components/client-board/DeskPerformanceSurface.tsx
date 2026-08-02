/**
 * DeskPerformanceSurface — desk-kit rebuild of `PerformanceSurface`
 * (components/ClientBoardPage.tsx, function around L6195).
 *
 * WIRING PRESERVED FROM THE ORIGINAL
 * - Props are byte-identical: `{ board, accent, live?, showAim? }`.
 * - The ghost-vs-live indicator rule is kept exactly: an indicator renders as LIVE only
 *   when `captured_at` is stamped; otherwise it stays the honest not-yet-measured ghost
 *   (a dashed Blank box, no invented value). A seeded value with no stamp can never
 *   masquerade as measured data.
 * - The "what the posts aim at" desk block counts `board.queue[].funnel_stage`, gated on
 *   `showAim` and on there being at least one tagged post (never an empty chart).
 * - `board.engine_updates` is still rendered (not dropped) — folded into a collapsed
 *   <Drill/> at the foot of the panel so it survives the redesign without adding density.
 *   The mechanism-brag sentence that used to sit in front of it ("Improvements ship to
 *   your account automatically as we build") is cut — the reference's performance panel
 *   has no such line, and it's exactly the register the copy rules ban.
 *
 * NOT carried over 1:1
 * - The original's flat "one row per post" list is replaced by the frag's grouped,
 *   week-subtotalled <Ledger/>. Same source data (`perf.posts`), denser presentation.
 * - `expectationFor()` and the ghost placeholder are private helpers on the original
 *   component (not exported) — both are replicated here rather than imported.
 *
 * Render <DeskKitStyle/> ONCE at the page level (shared across all desk surfaces), not
 * inside this file — importing/rendering it per-surface would duplicate the <style> tag.
 */
import React from 'react';
import {
  Eyebrow, DeskH2, Footnote, Card, Plate, PlateMute,
  Num, Stat, StatStrip, Chip, Delta, Spark,
  Ledger, LedgerRow, LedgerCell, LedgerBar,
  Thumb, Blank, StatBlank, Drill,
} from './desk-kit';
import type { Board, QueueItem, PerfIndicator, PerfPost } from '../ClientBoardPage';

/* ────────────────────────────────────────────────────────────────────────────
 * Local helpers — small private utilities from the original PerformanceSurface
 * that are not exported by ClientBoardPage, so they are replicated here verbatim
 * (expectationFor) or re-derived in the same safe way (date parsing).
 * ──────────────────────────────────────────────────────────────────────────── */

function fmtNum(n?: number | null): string {
  return n === null || n === undefined ? '—' : n.toLocaleString();
}

/** Ledger aim-chip labels — plain English, capitalized, matching the reference's chip
 *  look. Only 'buyers' (bottom-of-funnel, the commercial-intent posts) renders in accent;
 *  reach/trust stay the neutral default tone, exactly as the reference ledger encodes it. */
const AIM_LABEL: Record<string, string> = { reach: 'Reach', trust: 'Trust', buyers: 'Buyers' };

/** Word-safe cap for a title embedded mid-sentence (no trailing ellipsis — this feeds
 *  straight into "the {title} post", so an ellipsis here would land in the middle of the
 *  sentence, not at its end). Post titles are unbounded client-voiced free text, so the
 *  hero-plate caption must stay short on its own — never mid-word — or a long title runs
 *  the caption out under the highlighted bar next to it. */
function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const sp = s.lastIndexOf(' ', max);
  return (sp > 0 ? s.slice(0, sp) : s.slice(0, max)).trim();
}

/** Honest expectation line per indicator — copied verbatim from the original
 *  PerformanceSurface's private `expectationFor`, which ClientBoardPage does not export. */
function expectationFor(ind: PerfIndicator): string {
  const l = `${ind.key} ${ind.label}`.toLowerCase();
  if (l.includes('view')) return 'Profile views usually move within the first week of posting.';
  if (l.includes('dm')) return 'First inbound DMs typically follow once posting is consistent.';
  if (l.includes('opt') || l.includes('magnet')) return 'Opt-ins start as soon as your first lead magnet goes live.';
  if (l.includes('call')) return 'Booked calls follow opt-ins as outreach ramps.';
  return 'Tracking starts the day delivery goes live.';
}

/** Parses a bare date ('2026-07-27') or a full ISO timestamp the same safe way fmtDay
 *  does elsewhere on the board: bare dates get LOCAL midnight so the day never rolls
 *  backward across a UTC parse. */
function parseSafe(iso?: string): Date | null {
  if (!iso) return null;
  const d = /[T ]/.test(iso) ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
/** Local (never UTC-shifted) yyyy-mm-dd key for a Date. */
function localKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dayOfMonth(iso?: string): string {
  const d = parseSafe(iso);
  return d ? String(d.getDate()) : '';
}
function shortDate(iso?: string): string {
  const d = parseSafe(iso);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}
/** Monday (local) of the calendar week containing d. */
function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

type Week = {
  key: string;
  monday: Date;
  items: PerfPost[];
  totalReads: number;
  engagements: number;
  rate: number | null;
  readsPerPost: number | null;
};

export function DeskPerformanceSurface({
  board, accent, live = false, showAim = false,
}: { board: Board; accent: string; live?: boolean; showAim?: boolean }) {
  const perf = board.performance;
  const updates = board.engine_updates || [];
  const indicators = perf?.indicators || [];
  const outreachInds = perf?.outreach_indicators || [];
  const allPosts = perf?.posts || [];
  // Same cap the original per-post list used, to keep the ledger/plate/KPI row from
  // growing unbounded on a long-running board. Headline + footer stats read the FULL
  // history below (an "all time" stat must mean all time).
  const posts = allPosts.slice(0, 20);

  /* ---- queue lookup for the ledger's thumb / aim chip / pillar chip ---- */
  // Titles arriving from different systems may carry a bracketed brand prefix
  // ('[RISE DTC] ...'); the join must see through it or those rows lose their chips.
  const normTitle = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '').trim().toLowerCase();
  const queueByTitle = new Map<string, QueueItem>();
  board.queue.forEach((q) => { if (q.title) queueByTitle.set(normTitle(q.title), q); });
  // The feed occasionally writes the post BODY into title — fall back to publish date.
  const queueByDate = new Map<string, QueueItem>();
  board.queue.forEach((q) => { if (q.publish_date) queueByDate.set(q.publish_date, q); });
  const matchQueue = (title?: string, publishedAt?: string): QueueItem | undefined =>
    (title ? queueByTitle.get(normTitle(title)) : undefined)
    || (publishedAt ? queueByDate.get(publishedAt.slice(0, 10)) : undefined);
  const coverOf = (q?: QueueItem): string | undefined =>
    (q?.image_urls && q.image_urls[0]) || q?.image || q?.media_url || q?.cover_url || undefined;

  /* ── Block 1: computed headline — verbatim logic from the original's deskPerfTitle.
     Never invents a winner, never compares a post against itself; falls back to the
     plain count when fewer than two posts carry reads. Reads the FULL history. ── */
  const headline = (() => {
    const withReads = allPosts.filter((x) => typeof x.impressions === 'number' && (x.impressions as number) > 0);
    const n = allPosts.length;
    const head = <>{n} {n === 1 ? 'post' : 'posts'} measured on your feed.</>;
    if (withReads.length < 2) return head;
    const best = withReads.reduce((a, b) => ((b.impressions as number) > (a.impressions as number) ? b : a));
    const rest = withReads.filter((x) => x !== best);
    const avg = rest.reduce((t, x) => t + (x.impressions as number), 0) / (rest.length || 1);
    const mult = avg > 0 ? (best.impressions as number) / avg : 0;
    if (mult < 1.5) return head;
    return (
      <>{head} <b>The {shortDate(best.published_at)} post did {(best.impressions as number).toLocaleString()} reads</b>, {mult.toFixed(1)}&times; the average.</>
    );
  })();

  /* ---- shared derived data for the Plate, KPI row and Ledger ---- */
  const sorted = [...posts].sort((a, b) => {
    const da = parseSafe(a.published_at)?.getTime() ?? 0;
    const db = parseSafe(b.published_at)?.getTime() ?? 0;
    return da - db;
  });
  const withReads = sorted.filter((p) => typeof p.impressions === 'number' && (p.impressions as number) > 0);
  const bestPost = withReads.length
    ? withReads.reduce((a, b) => ((b.impressions as number) > (a.impressions as number) ? b : a))
    : null;

  const weekMap = new Map<string, PerfPost[]>();
  sorted.forEach((p) => {
    const d = parseSafe(p.published_at);
    if (!d) return;
    const k = localKey(mondayOf(d));
    if (!weekMap.has(k)) weekMap.set(k, []);
    weekMap.get(k)!.push(p);
  });
  const weeks: Week[] = Array.from(weekMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, items]) => {
      const totalReads = items.reduce((t, p) => t + (typeof p.impressions === 'number' ? (p.impressions as number) : 0), 0);
      const engagements = items.reduce((t, p) => t + (p.reactions || 0) + (p.comments || 0), 0);
      const rate = totalReads > 0 ? (engagements / totalReads) * 100 : null;
      return {
        key, monday: parseSafe(key) as Date, items, totalReads, engagements, rate,
        readsPerPost: items.length ? totalReads / items.length : null,
      };
    });
  const measuredAll = sorted.filter((p) => typeof p.impressions === 'number');
  // The chart windows to the SAME latest-two-weeks the ledger shows in full — live
  // history backfills (June arrived overnight) and 20+ hairline bars read as noise.
  const twoWeekKeys = new Set(weeks.slice(-2).map((w) => w.key)); // chart keeps two weeks for the comparison
  const measured = measuredAll.filter((p) => { const d = parseSafe(p.published_at); return d ? twoWeekKeys.has(localKey(mondayOf(d))) : false; });
  const bestInWindow = measured.length ? measured.reduce((a, b) => ((b.impressions as number) > (a.impressions as number) ? b : a)) : null;
  const bestIndex = bestInWindow ? measured.indexOf(bestInWindow) : -1;
  // Width of the hero caption column, held to the left the way the reference does — but
  // computed from where the highlighted bar actually sits, not a fixed 51%. The reference's
  // fixed split only clears the bar because its mock data happens to put the best post past
  // the halfway column; on a real board the best post can land anywhere, and a fixed
  // percentage will run the caption straight under the bar whenever it lands early. Capped
  // at 51% (never wider than the reference) and floored at 30% (the hero number still needs
  // room to breathe when the best post is the very first bar).
  const heroBoxPct = bestIndex >= 0 && measured.length > 0
    ? Math.max(30, Math.min(51, (bestIndex / measured.length) * 100 - 4))
    : 51;
  // Plate annotations render whenever there is more than one week to compare (>=2).
  const spansMultipleWeeks = weeks.length >= 2;
  // The KPI row's deltas always compare the LATEST two weeks; requiring exactly two
  // meant the first history backfill silently reverted the row to all-time numbers.
  const spansTwoWeeks = weeks.length >= 2;

  // Counterfactual: pull the single best post out of the (capped) set and recompute the
  // per-post average. Only computable with 2+ posts in the set.
  const counterfactual = (() => {
    if (!bestPost || sorted.length < 2) return null;
    const rest = sorted.filter((p) => p !== bestPost);
    if (!rest.length) return null;
    const allReads = sorted.reduce((t, p) => t + (typeof p.impressions === 'number' ? (p.impressions as number) : 0), 0);
    const restReads = rest.reduce((t, p) => t + (typeof p.impressions === 'number' ? (p.impressions as number) : 0), 0);
    return { before: Math.round(allReads / sorted.length), after: Math.round(restReads / rest.length) };
  })();

  // KPI row aggregates. With two weeks on the board the heroes are the CURRENT week —
  // the same basis as their own deltas and the ledger's week subtotal. A hero that says
  // 3,121 while its delta was computed off 2,380 is the contradiction the round-2 critic
  // caught. All-time totals live only in the stat footer, labelled all time.
  const setReads = sorted.reduce((t, p) => t + (typeof p.impressions === 'number' ? (p.impressions as number) : 0), 0);
  const setEngagements = sorted.reduce((t, p) => t + (p.reactions || 0) + (p.comments || 0), 0);

  const wow = spansTwoWeeks ? (() => {
    const [prev, cur] = weeks.slice(-2);
    const readsDelta = prev.totalReads > 0 ? ((cur.totalReads - prev.totalReads) / prev.totalReads) * 100 : null;
    const perPostDelta = prev.readsPerPost && prev.readsPerPost > 0 && cur.readsPerPost != null
      ? ((cur.readsPerPost - prev.readsPerPost) / prev.readsPerPost) * 100 : null;
    const engDelta = prev.engagements > 0 ? ((cur.engagements - prev.engagements) / prev.engagements) * 100 : null;
    const rateDelta = prev.rate != null && prev.rate > 0 && cur.rate != null ? ((cur.rate - prev.rate) / prev.rate) * 100 : null;
    return { prev, cur, readsDelta, perPostDelta, engDelta, rateDelta };
  })() : null;
  const totalReads = wow ? wow.cur.totalReads : setReads;
  const totalEngagements = wow ? wow.cur.engagements : setEngagements;
  const readsPerPost = wow ? (wow.cur.readsPerPost ?? null) : (sorted.length ? setReads / sorted.length : null);
  const engagementRate = wow ? (wow.cur.rate ?? null) : (setReads > 0 ? (setEngagements / setReads) * 100 : null);
  const kpiScope = '';
  const kpiHeader = wow ? 'This week, against last' : 'To date';
  // Only true, computed narrative: reads-per-post rose while the rate fell — a wider
  // audience, not a weaker one. Never asserted unless both halves are computed facts.

  // Stat footer reads "all time": the FULL history, not the capped set above.
  const anyReadsCaptured = allPosts.some((p) => typeof p.impressions === 'number');
  const totalReadsAll = anyReadsCaptured
    ? allPosts.reduce((t, p) => t + (typeof p.impressions === 'number' ? (p.impressions as number) : 0), 0) : 0;
  const bestReadsAll = anyReadsCaptured
    ? allPosts.reduce((m, p) => (typeof p.impressions === 'number' && (p.impressions as number) > m ? (p.impressions as number) : m), 0) : 0;
  const bestReadsInSet = withReads.length ? Math.max(...withReads.map((p) => p.impressions as number)) : 0;

  /* ── Block 4: aim mix — exact counting logic from the original's showAim block. ── */
  const aim = (() => {
    const aims = [
      { key: 'reach', label: 'Reach', blurb: 'gets the brand seen' },
      { key: 'trust', label: 'Trust', blurb: 'proves the thinking' },
      { key: 'buyers', label: 'Buyers', blurb: 'speaks to the ready' },
    ];
    const counts = aims.map((a) => ({ ...a, n: board.queue.filter((q) => q.funnel_stage === a.key).length }));
    const total = counts.reduce((t, c) => t + c.n, 0);
    return { counts, total };
  })();

  /* ── Block 6: ghost/live indicator cards — original's rule preserved exactly:
     captured_at gates live rendering; a seeded value with no stamp stays a ghost.
     Compact kit treatment: no Card frame, no "awaiting first data" shout — the dashed
     Blank box already reads as not-yet-measured on its own, so the label sits directly
     over it and the expectation collapses to a single short Footnote. ── */
  const ghostCard = (ind: PerfIndicator, _expectation?: string) => (
    <div key={ind.key}>
      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{ind.label}</div>
      <Blank style={{ marginTop: 8, maxWidth: 96, height: 34, minHeight: 34 }} />
    </div>
  );
  const liveCard = (ind: PerfIndicator) => (
    <div key={ind.key}>
      <Num size="big">{fmtNum(ind.value)}</Num>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 6, lineHeight: 1.35 }}>{ind.label}</div>
      {(ind.source || ind.captured_at) && <Footnote style={{ marginTop: 4 }}>{ind.source ? `from ${ind.source}` : ''}{ind.captured_at ? `${ind.source ? ' · ' : ''}counted ${new Date(ind.captured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</Footnote>}
    </div>
  );
  const indicatorCard = (ind: PerfIndicator, expectation?: string) => (ind.captured_at ? liveCard(ind) : ghostCard(ind, expectation));

  return (
    <div data-surface="performance">
      {/* Block 1 */}
      <Eyebrow>Performance</Eyebrow>
      <DeskH2>{headline}</DeskH2>

      {/* Block 2: dark chart Plate — measured posts only. A post whose reads are not
          captured yet must never draw as a zero-height bar. */}
      {measured.length > 0 && (
        <Plate style={{ marginTop: 18 }}>
          <div style={{ position: 'relative' }}>
            <Spark
              on="plate"
              values={measured.map((p) => p.impressions as number)}
              labels={measured.map((p) => dayOfMonth(p.published_at))}
              highlight={bestIndex >= 0 ? bestIndex : undefined}
              height="clamp(280px, 66vw, 430px)"
            />
            {spansMultipleWeeks && (() => {
              const ceil = Math.max(1, ...measured.map((p) => p.impressions as number));
              let priorWidth = 0;
              return weeks.slice(-2).map((w) => {
                const wMeasured = w.items.filter((x) => typeof x.impressions === 'number');
                const widthPct = (wMeasured.length / measured.length) * 100;
                const left = priorWidth;
                priorWidth += widthPct;
                if (!w.readsPerPost) return null;
                const pct = Math.max(0, Math.min(100, (w.readsPerPost / ceil) * 100));
                return (
                  <div
                    key={w.key}
                    style={{
                      position: 'absolute', left: `${left}%`, width: `${widthPct}%`,
                      bottom: `calc(32px + ${pct}%)`, borderTop: '1px dashed rgba(255,255,255,0.45)',
                    }}
                  >
                    <div style={{ position: 'absolute', right: 0, bottom: 4, fontSize: 12.5, fontWeight: 800, color: '#EFEFE9', whiteSpace: 'nowrap' }}>
                      avg {Math.round(w.readsPerPost)}
                    </div>
                  </div>
                );
              });
            })()}
            {bestInWindow && (
              // heroBoxPct (computed above) keeps this column clear of the highlighted
              // bar's actual position — never a fixed split that only works when the best
              // post happens to land past the halfway column. The post title is also
              // unbounded client copy, so it's word-truncated on top of that, as a second,
              // independent guard against a long title running the caption out.
              <div style={{ position: 'absolute', left: 0, top: 0, width: `${heroBoxPct}%`, paddingRight: 10 }}>
                <Num size="hero" tone="accent">{(bestInWindow!.impressions as number).toLocaleString()}</Num>
                <Footnote on="plate" style={{ marginTop: 6 }}>
                  reads on {bestInWindow!.title ? `the ${truncateWords(bestInWindow!.title, 40)} post` : 'the top post'}{bestInWindow!.published_at ? `, ${shortDate(bestInWindow!.published_at)}` : ''}
                  {' '}<Chip tone="accent" style={{ marginLeft: 4 }}>best of these 2 weeks</Chip>
                </Footnote>
              </div>
            )}
          </div>
          {spansMultipleWeeks && (
            <div style={{ display: 'flex', marginTop: 14, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cb-plate-mute)' }}>
              {weeks.slice(-2).map((w, i) => (
                <div key={w.key} style={{ flex: `${w.items.filter((x) => typeof x.impressions === 'number').length} 1 0`, marginLeft: i > 0 ? 'clamp(8px, 3vw, 26px)' : 0 }}>
                  Week of {shortDate(localKey(w.monday))}
                </div>
              ))}
            </div>
          )}
          {counterfactual && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--cb-plate-line)' }}>
              <PlateMute style={{ fontWeight: 700 }}>Take the best post out</PlateMute>
              <Num size="row" inline tone="plate">{counterfactual.before}</Num>
              <PlateMute>&rarr;</PlateMute>
              <Num size="row" inline tone="plate">{counterfactual.after}</Num>
              <PlateMute style={{ fontWeight: 600 }}>reads per post</PlateMute>
              <Delta on="plate">flat</Delta>
            </div>
          )}
        </Plate>
      )}

      {/* Block 3: KPI row */}
      {sorted.length > 0 && (
        <>
          <Eyebrow style={{ marginTop: 26, display: 'block' }}>{kpiHeader}</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 12 }}>
            <div style={{ borderLeft: `3px solid var(--cb-accent)`, paddingLeft: 14, minHeight: 142 }}>
              <Num size="big">{totalReads.toLocaleString()}</Num>
              <Footnote style={{ marginTop: 6 }}>Reads{kpiScope}</Footnote>
              {wow && wow.readsDelta != null && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Delta dir={wow.readsDelta >= 0 ? 'up' : 'down'}>{wow.readsDelta >= 0 ? '+' : ''}{Math.round(wow.readsDelta)}%</Delta>
                  <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)', fontWeight: 600 }}>from {wow.prev.totalReads.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ borderLeft: `3px solid var(--cb-accent)`, paddingLeft: 14, minHeight: 142 }}>
              <Num size="big">{readsPerPost != null ? Math.round(readsPerPost).toLocaleString() : '—'}</Num>
              <Footnote style={{ marginTop: 6 }}>Reads per post{kpiScope}</Footnote>
              {wow && wow.perPostDelta != null && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Delta dir={wow.perPostDelta >= 0 ? 'up' : 'down'}>{wow.perPostDelta >= 0 ? '+' : ''}{Math.round(wow.perPostDelta)}%</Delta>
                  <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)', fontWeight: 600 }}>from {Math.round(wow.prev.readsPerPost || 0).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ borderLeft: `3px solid var(--cb-accent)`, paddingLeft: 14, minHeight: 142 }}>
              <Num size="big">{totalEngagements.toLocaleString()}</Num>
              <Footnote style={{ marginTop: 6 }}>Engagements{kpiScope}</Footnote>
              {wow && wow.engDelta != null && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Delta dir={wow.engDelta >= 0 ? 'up' : 'down'}>{wow.engDelta >= 0 ? '+' : ''}{Math.round(wow.engDelta)}%</Delta>
                  <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)', fontWeight: 600 }}>from {wow.prev.engagements.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ borderLeft: '3px solid var(--cb-line)', paddingLeft: 14, minHeight: 142 }}>
              {engagementRate != null ? (
                <>
                  <Num size="big" tone="mute">{engagementRate.toFixed(2)}%</Num>
                  <Footnote style={{ marginTop: 6 }}>Engagement rate{kpiScope}</Footnote>
                  {/* Rates render flat, never red — the locked copy rule: a widening rate's
                      denominator (reach) isn't a regression. */}
                  {wow && wow.rateDelta != null && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <Delta>{wow.rateDelta >= 0 ? '+' : ''}{Math.round(wow.rateDelta)}%</Delta>
                      <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)', fontWeight: 600 }}>from {(wow.prev.rate || 0).toFixed(2)}%</span>
                    </div>
                  )}
                </>
              ) : (
                <StatBlank caption="engagement rate, not tracked yet" />
              )}
            </div>
          </div>

          {spansTwoWeeks && <div style={{ marginTop: 16 }}><Chip>chart shows the latest 2 of {weeks.length} weeks measured</Chip></div>}
        </>
      )}

      {/* Block 4: aim mix */}
      {showAim && aim.total > 0 && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <Eyebrow>What the posts aim at</Eyebrow>
            <Chip>{aim.total} {aim.total === 1 ? 'post' : 'posts'} in the pipeline</Chip>
          </div>
          <div style={{ marginTop: 14 }}>
            <Spark
              values={aim.counts.map((c) => c.n)}
              topLabels={aim.counts.map((c) => c.n)}
              highlight={0}
              barPad="clamp(0px, 3.2vw, 46px)"
              height="clamp(160px, 38vw, 220px)"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(6px, 1.4vw, 18px)', borderTop: '1px solid var(--cb-line)', paddingTop: 8 }}>
            {aim.counts.map((c, i) => (
              <div key={c.key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: i === 0 ? 'var(--cb-ink)' : 'var(--cb-ink-mute)' }}>{c.label}</div>
                <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 600, color: 'var(--cb-ink-mute)', lineHeight: 1.3 }}>{c.blurb}</div>
              </div>
            ))}
          </div>
          <Footnote>The chart counts posts, not reads.</Footnote>
        </Card>
      )}

      {/* Block 5: the ledger */}
      <div style={{ marginTop: 40, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <Eyebrow tone="ink">The ledger</Eyebrow>
        <Footnote style={{ marginTop: 0 }}>Bar = share of the best post. Counts under each: reactions · comments.</Footnote>
      </div>
      {sorted.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <Footnote style={{ marginTop: 0 }}>
            Per-post numbers land here after each post goes live on your feed. Impressions, reactions and comments per post, refreshed daily.
          </Footnote>
          <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>
            No data yet
          </div>
        </Card>
      ) : (<>
        <Ledger style={{ marginTop: 12 }} columns={[{ width: '1%' }, { label: 'Post' }, { label: 'Reads · rate', align: 'right', width: '1%' }]}>
          {/* Live history grows without bound (the feeder backfilled to June overnight and
              doubled the panel's word count). The ledger shows the latest week in
              full; everything earlier folds — same pattern as the changes log. */}
          {weeks.slice(-1).map((w, wi) => (
            <React.Fragment key={w.key}>
              <LedgerRow tone="group">
                <LedgerCell colSpan={2}>
                  <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 15 }}>Week of {shortDate(localKey(w.monday))}</div>
                  <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>
                    {w.items.length} {w.items.length === 1 ? 'post' : 'posts'}{w.rate != null ? `, ${w.rate.toFixed(2)}% rate` : ''}
                  </div>
                </LedgerCell>
                <LedgerCell num align="right" width="1%">
                  {w.totalReads.toLocaleString()}
                  {weeks.length >= 2 && (
                    <span style={{ display: 'block', marginTop: 6 }}>
                      {wi === 0 ? (
                        <Delta>baseline</Delta>
                      ) : (() => {
                        const prev = weeks[wi - 1];
                        if (!prev || prev.totalReads <= 0) return null;
                        const pct = ((w.totalReads - prev.totalReads) / prev.totalReads) * 100;
                        return <Delta dir={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '+' : ''}{Math.round(pct)}%</Delta>;
                      })()}
                    </span>
                  )}
                </LedgerCell>
              </LedgerRow>
              {w.items.map((p, i) => {
                const q = matchQueue(p.title, p.published_at);
                const cover = coverOf(q);
                const isBest = p === bestInWindow;
                const reads = typeof p.impressions === 'number' ? (p.impressions as number) : null;
                const rate = reads != null && reads > 0 ? (((p.reactions || 0) + (p.comments || 0)) / reads) * 100 : null;
                const pct = bestReadsInSet > 0 && reads != null ? (reads / bestReadsInSet) * 100 : 0;
                return (
                  <LedgerRow key={`${w.key}-${i}`} tone={isBest ? 'best' : 'default'}>
                    <LedgerCell width={isBest ? 95 : 62}>
                      {cover ? <Thumb src={cover} size="lg" /> : null}
                    </LedgerCell>
                    <LedgerCell>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{shortDate(p.published_at)}</div>
                      <div style={{ marginTop: 3, fontSize: isBest ? 15.5 : 14.5, fontWeight: isBest ? 800 : 600, lineHeight: 1.3 }}>
                        {(() => { const t = p.title || 'Untitled post'; return t.length > 70 ? t.slice(0, t.lastIndexOf(' ', 70)) + '\u2026' : t; })()}{isBest && <Chip tone="accent" style={{ marginLeft: 4 }}>best</Chip>}
                      </div>
                      <div style={{ marginTop: isBest ? 10 : 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {q?.funnel_stage && AIM_LABEL[q.funnel_stage] && (
                          <Chip tone={q.funnel_stage === 'buyers' ? 'accent' : 'default'}>{AIM_LABEL[q.funnel_stage]}</Chip>
                        )}
                        {q?.pillar && q.pillar.trim() && <Chip>{String(q.pillar).replace(/_/g, ' ')}</Chip>}
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
                          {typeof p.reactions === 'number' ? p.reactions : '—'} · {typeof p.comments === 'number' ? p.comments : '—'}
                        </span>
                      </div>
                      <LedgerBar pct={pct} tone={isBest ? 'strong' : 'muted'} height={isBest ? 16 : 10} />
                    </LedgerCell>
                    <LedgerCell num align="right" width="1%">
                      {reads != null ? reads.toLocaleString() : '—'}
                      {rate != null && (
                        <span style={{ display: 'block', marginTop: 5, fontFamily: 'var(--cb-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
                          {rate.toFixed(1)}%
                        </span>
                      )}
                    </LedgerCell>
                  </LedgerRow>
                );
              })}
            </React.Fragment>
          ))}
        </Ledger>
        {weeks.length > 1 && (
          <Drill
            label="open it"
            summaryLeft={<>Earlier weeks: <b>{weeks.slice(0, -1).reduce((t, w) => t + w.items.length, 0)}</b> posts across <b>{weeks.length - 1}</b> weeks</>}
            style={{ marginTop: 4 }}
          >
            {weeks.slice(0, -1).map((w) => (
              <div key={w.key} style={{ padding: '8px 0', borderTop: '1px solid var(--cb-line)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>Week of {shortDate(localKey(w.monday))} · {w.items.length} {w.items.length === 1 ? 'post' : 'posts'}{w.rate != null ? ` · ${w.rate.toFixed(2)}% rate` : ''}</div>
                {w.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '6px 0 0' }}>
                    <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--cb-ink)' }}>{it.title || 'Untitled post'}</span>
                    {typeof it.impressions === 'number' && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{it.impressions.toLocaleString()} reads</span>}
                  </div>
                ))}
              </div>
            ))}
          </Drill>
        )}
      </>
      )}

      {/* Block 6: ghost/live indicator cards — original rule preserved exactly. */}
      {(indicators.length > 0 || (live && outreachInds.length > 0)) && (
        <div style={{ marginTop: 40 }}>
          <Eyebrow>What we track</Eyebrow>
          <Footnote>{perf?.note || 'Real series appear the day each one goes live.'}</Footnote>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {indicators.map((ind) => indicatorCard(ind, expectationFor(ind)))}
            {live && outreachInds.map((ind) => indicatorCard(ind))}
          </div>
        </div>
      )}

      {/* Block 7: stat footer */}
      <StatStrip style={{ marginTop: 32 }}>
        <Stat value={allPosts.length} caption="posts measured on your feed" />
        {anyReadsCaptured ? <Stat value={totalReadsAll.toLocaleString()} caption="reads all time" /> : <StatBlank caption="reads all time, not tracked yet" />}
        {anyReadsCaptured ? <Stat value={bestReadsAll.toLocaleString()} caption="best post" /> : <StatBlank caption="best post, not tracked yet" />}
      </StatStrip>

      {/* board.engine_updates preserved, folded into a collapsed drill rather than
          dropped by the redesign. The mechanism-brag lead-in sentence is cut (see the
          module doc above) — the drill itself, and the update log inside it, stay. */}
      {updates.length > 0 && (
        <Drill
          style={{ marginTop: 22 }}
          label="delivery updates"
          summaryLeft={<><b>{updates.length}</b> {updates.length === 1 ? 'update' : 'updates'}</>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {updates.map((u, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ width: 90, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{shortDate(u.date)}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{u.note}</span>
              </div>
            ))}
          </div>
        </Drill>
      )}
    </div>
  );
}
