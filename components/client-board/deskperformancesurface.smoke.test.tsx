// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeskPerformanceSurface } from './DeskPerformanceSurface';
import type { Board } from '../ClientBoardPage';

/** Minimal required Board scaffold — every fixture below spreads this and overrides
 *  `performance` / `queue` / `engine_updates`. */
const BASE: Omit<Board, 'queue'> = {
  company_name: 'Test Co',
};

/** 8 posts across two real calendar weeks (Mon 20 Jul – Thu 30 Jul), values borrowed
 *  from the approved static reference (frag-performance.html) — test-only fabrication. */
const WEEK1 = [
  { title: "Don't run ads on broken tracking", published_at: '2026-07-21', impressions: 187, reactions: 6, comments: 3 },
  { title: "How to read your agency's incentive from its invoice", published_at: '2026-07-22', impressions: 176, reactions: 3, comments: 3 },
  { title: 'The RISE DTC AI Kit launch post', published_at: '2026-07-23', impressions: 201, reactions: 1, comments: 4 },
  { title: 'Run this margin math before you hire any agency', published_at: '2026-07-24', impressions: 163, reactions: 4, comments: 3 },
];
const WEEK2 = [
  { title: "Tearing Down a Top DTC Brand's Checkout Funnel", published_at: '2026-07-27', impressions: 1354, reactions: 11, comments: 16 },
  { title: 'Carousel: an apparel brand case study', published_at: '2026-07-28', impressions: 217, reactions: 4, comments: 2 },
  { title: 'Free calculator hub launch post', published_at: '2026-07-29', impressions: 132, reactions: 5, comments: 0 },
  { title: 'The Profit Gap: 50% growth, $6,000 kept', published_at: '2026-07-30', impressions: 149, reactions: 4, comments: 2 },
];

function boardA(): Board {
  return {
    ...BASE,
    queue: [
      { id: 'q1', kind: 'post', stage: 'published', title: "Don't run ads on broken tracking", pillar: 'Tracking', funnel_stage: 'buyers' },
      { id: 'q2', kind: 'post', stage: 'published', title: "Tearing Down a Top DTC Brand's Checkout Funnel", pillar: 'Teardowns', funnel_stage: 'reach', image_urls: ['https://example.com/cover.jpg'] },
      // Extra queue items purely to populate the aim mix (9 reach / 6 trust / 5 buyers, matching the reference).
      ...Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, kind: 'post' as const, stage: 'planned' as const, title: `reach-${i}`, funnel_stage: 'reach' })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, kind: 'post' as const, stage: 'planned' as const, title: `trust-${i}`, funnel_stage: 'trust' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, kind: 'post' as const, stage: 'planned' as const, title: `buyers-${i}`, funnel_stage: 'buyers' })),
    ],
    performance: {
      note: 'The leading indicators your retainer is measured on.',
      indicators: [
        { key: 'views', label: 'Profile views', value: 240, source: 'LinkedIn', captured_at: '2026-07-30' },
      ],
      posts: [...WEEK1, ...WEEK2],
      posts_updated_at: '2026-07-30',
    },
    engine_updates: [
      { date: '2026-07-25', note: 'Faster draft turnaround shipped.' },
      { date: '2026-07-18', note: 'New carousel template added.' },
    ],
  };
}

/** A single published post — asserts the honest floor: no best-vs-average clause, no
 *  week-over-week deltas anywhere (there is only one calendar week). */
function boardB(): Board {
  return {
    ...BASE,
    queue: [],
    performance: {
      posts: [{ title: 'Solo post', published_at: '2026-07-27', impressions: 500, reactions: 5, comments: 2 }],
    },
  };
}

/** Zero posts + one indicator carrying a seeded value but NO captured_at — the canary
 *  value (777) must never render: a seeded number with no stamp stays a ghost. */
function boardC(): Board {
  return {
    ...BASE,
    queue: [],
    performance: {
      indicators: [{ key: 'dm', label: 'Inbound DMs', value: 777 }],
      posts: [],
    },
  };
}

describe('DeskPerformanceSurface', () => {
  it('renders the full 8-post / 2-week board: headline, plate, KPI deltas, aim mix, ledger week subtotals, drill, footer', () => {
    const html = renderToStaticMarkup(
      <DeskPerformanceSurface board={boardA()} accent="#FFC71D" live={false} showAim />,
    );

    // (a) key blocks present
    expect(html).toContain('8 posts measured on your feed.');
    // best-vs-average clause: 27 Jul post (1354) vs the average of the other 7 (~175) is well over 1.5x
    expect(html).toMatch(/did 1,354 reads/);
    expect(html).toMatch(/the average/);
    expect(html).toContain('The ledger');
    expect(html).toContain('What the posts aim at');
    expect(html).toContain('posts measured on your feed');
    expect(html).toContain('reads all time');
    expect(html).toContain('best post');
    // week subtotal headers
    expect(html).toMatch(/Week of 20 Jul/);
    expect(html).toMatch(/Week of 27 Jul/);
    // week-over-week deltas render (exactly two calendar weeks)
    expect(html).toContain('chart shows the latest 2 of 2 weeks measured');
    expect(html).toMatch(/class="delta[^"]*"[^>]*>baseline/);
    expect((html.match(/class="delta/g) || []).length).toBeGreaterThan(1);

    // (b) data-metric and data-viz appear
    expect(html).toContain('data-metric');
    expect(html).toContain('data-viz');

    // (c) a drill renders collapsed
    expect(html).toMatch(/<details[^>]*class="drill/);
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    expect(html).toContain('delivery updates');
    // the mechanism-brag lead-in is cut; the drill itself and its update log survive
    expect(html).not.toContain('Improvements ship to your account automatically');
    expect(html).toContain('Faster draft turnaround shipped.');

    // (d) hero caption: the best post's title is unbounded client copy (48 chars here),
    // so it must be word-truncated in the plate caption — never spilling untruncated
    // text into the highlighted bar's column.
    expect(html).toContain('reads on the Tearing Down a Top DTC Brand&#x27;s Checkout post, 27 Jul');
    expect(html).not.toContain('Checkout Funnel post');

    // (f) REMOVED 2026-08-02: the with-vs-without-outlier counterfactual strip. The exact
    // copy that block carried must be gone from the rendered html. The KPI tile's
    // capitalised "Reads per post" caption survives; only the counterfactual ever
    // rendered the lowercase phrase.
    expect(html).not.toContain('Take the best post out');
    expect(html).not.toContain('reads per post');

    // (g) hover layer, chart: one focusable (tabindex=0) hit column per measured bar,
    // each carrying the cb-perfh-hit hover class...
    expect((html.match(/class="cb-perfh-hit"/g) || []).length).toBe(8);
    expect(html).toMatch(/class="cb-perfh-hit" tabindex="0"/);
    // ...whose reveal node contains that post's REAL fixture number (27 Jul post, 1,354),
    // rendered via the gate-visible <Num/> inside the tip
    expect(html).toMatch(/class="cb-perfh-tip"[\s\S]{0,500}?>1,354</);
    // tap/screen-reader parity: the same info rides the focusable element's aria-label
    expect(html).toContain('1,354 reads, 27 Jul');

    // (h) hover layer, ledger: every visible post row (4 in the latest week) carries the
    // row hover class; the title cell is focusable; the reveal holds the full untruncated
    // title plus the row's reads as a real number
    expect((html.match(/class="cb-perfh-lrow"/g) || []).length).toBe(4);
    expect(html).toMatch(/class="cb-perfh-rowfocus" tabindex="0"/);
    expect(html).toMatch(/class="cb-perfh-rtip"[\s\S]{0,300}?Tearing Down a Top DTC Brand&#x27;s Checkout Funnel/);
    expect(html).toMatch(/class="cb-perfh-rtip"[\s\S]{0,600}?>1,354</);
    // reveals never present themselves to the reader twice: visual tip is aria-hidden,
    // the aria-label on the focusable element is the accessible copy
    expect(html).toMatch(/class="cb-perfh-rtip" aria-hidden="true"/);
    expect(html).toMatch(/class="cb-perfh-tip" aria-hidden="true"/);
    // motion respects prefers-reduced-motion: transitions live only inside the media block
    expect(html).toContain('@media (prefers-reduced-motion: no-preference)');

    // (e) the ledger shows the LATEST week in full; the older week folds. The older
    // week's buyers-tagged post therefore lives inside the earlier-weeks drill (compact
    // title+reads rows, no chips by design), and the visible week still encodes aims.
    const reachChip = html.match(/<span class="chip"[^>]*style="([^"]*)"[^>]*>Reach<\/span>/);
    expect(reachChip).toBeTruthy();
    expect(html).toContain('Earlier weeks:');
  });

  it('renders a single post honestly: no best-vs-average clause, no delta chips', () => {
    const html = renderToStaticMarkup(
      <DeskPerformanceSurface board={boardB()} accent="#FFC71D" live={false} showAim />,
    );

    expect(html).toContain('1 post measured on your feed.');
    expect(html).not.toMatch(/the average/);
    expect(html).not.toMatch(/class="delta/);
    // no counterfactual on a single post either, but its one bar is still hoverable/tappable
    expect(html).not.toContain('Take the best post out');
    expect((html.match(/class="cb-perfh-hit"/g) || []).length).toBe(1);
    expect(html).toContain('Solo post: 500 reads, 27 Jul');
    // still a real, gate-visible surface
    expect(html).toContain('data-metric');
    expect(html).toContain('data-viz');
  });

  it('never renders a ghost indicator\'s seeded value, and shows honest blanks instead of a fabricated zero', () => {
    const html = renderToStaticMarkup(
      <DeskPerformanceSurface board={boardC()} accent="#FFC71D" live={false} showAim={false} />,
    );

    // Compact ghost treatment: the indicator's own label + a dashed Blank box + its
    // expectation line — never the raw seeded value, never a fabricated zero.
    expect(html).toContain('Inbound DMs');
    expect(html).toContain('cb-blank');
    // per-ghost expectation sentences were cut for density; the dashed blank carries it
    expect(html).not.toContain('First inbound DMs typically follow once posting is consistent.');
    expect(html).not.toContain('777');
    expect(html).toContain('reads all time, not tracked yet');
    expect(html).toContain('best post, not tracked yet');
    // 0 posts is a real fact, not a fabrication — it's fine for this one to render.
    expect(html).toContain('posts measured on your feed');
    // no posts, no marks: the hover layer renders zero hit columns and zero ledger rows
    expect(html).not.toMatch(/class="cb-perfh-hit"/);
    expect(html).not.toMatch(/class="cb-perfh-lrow"/);
  });
});
