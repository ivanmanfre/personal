/**
 * OutreachTopOfPanel — one test per obligation carried into the winner implementation
 * (goal-run rise-panel-followthrough-2026-08-26, phase 1). The fixture below is a trimmed
 * copy of the LIVE risedtc-com blob read at 2026-08-26T04:01:52Z, so a shape change in
 * rise_outreach_truth_compute() shows up here rather than on Mattan's screen.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OutreachTopOfPanel, { plainGate, sendLogAnchorId, scrubVendor, laneName } from './OutreachTopOfPanel';
import type { FunnelSignals } from './OutreachTopOfPanel';
import type { Board, OutreachLogEntry } from '../ClientBoardPage';

const TRUTH = {
  counted_at: '2026-08-26T04:01:52Z',
  semantics_version: 'clientweekpacket-2026-08-25',
  funnel: { contacted: 863, accepted: 205, replied_people: 60, booked: 6 },
  booked: [
    { prospect_id: 'p1', name: 'Waldemar Schlemmer', company: 'NAD&Me', booked_at: '2026-08-25T22:58:06.806Z', brief_url: 'https://resources.risedtc.com/brief/?id=115629505025', scan_url: null },
    { prospect_id: 'p2', name: 'Stefan Hertzberg', company: 'Vivi Labs', booked_at: '2026-08-20T21:34:07.828Z', brief_url: null, scan_url: null },
  ],
  replied_7d: [
    { name: 'Gita V.', company: 'Neeshi Wellness', reply_intent: 'positive', last_reply_at: '2026-08-26T00:40:05.671Z', linkedin_profile_id: 'ACoAAAAK4B0BrhJkiht1M8dyaT5Ygvpu7WMBW4I' },
    { name: 'Grace Lin', company: 'Kaged', reply_intent: 'negative', last_reply_at: '2026-08-25T17:13:40.839Z', linkedin_profile_id: 'ACoAAB-EKG8B5kaQoeBMBBdT7PMUAqgbKmrds2Q' },
    { name: 'Maryam Hoteit', company: 'LOUCIL', reply_intent: 'neutral', last_reply_at: '2026-08-25T21:04:41.552Z', linkedin_profile_id: 'ACoAACqMaP8BjuJAG7oSFDC5zyjele-bQWEF5KU' },
    { name: 'Nobody Labelled', company: 'Pending Co', reply_intent: null, last_reply_at: '2026-08-24T09:00:00.000Z', linkedin_profile_id: 'ACoAAZZZ' },
  ],
  replied_weekly: [
    { week_monday: '2026-07-13', people: 0 },
    { week_monday: '2026-07-20', people: 4 },
    { week_monday: '2026-07-27', people: 6 },
    { week_monday: '2026-08-03', people: 7 },
    { week_monday: '2026-08-10', people: 15 },
    { week_monday: '2026-08-17', people: 26 },
    { week_monday: '2026-08-24', people: 9 },
  ],
  funnel_gates: {
    computed_at: '2026-08-26T04:01:52Z',
    reading: 'entered = reached this gate.',
    lanes: [{
      lane: 'cold',
      lane_label: 'Cold - DTC founders from Sales Navigator',
      total: 521,
      contacted_total: 138,
      stages: [
        { stage: 'harvested', label_plain_english: 'Pulled from Sales Navigator against the DTC search', entered: 521, passed: 521, failed: 0, waiting: 0, untracked: 0 },
        { stage: 'icp_fit', label_plain_english: 'Right size and right fit', entered: 415, passed: 362, failed: 53, waiting: 0, untracked: 0 },
      ],
      discrepancy: '221 rows are sitting at the queue line but only 71 are pickable right now; the other 150 are held: held on a ballot awaiting Ivan x134, already DM-ed, not a first touch x16. The picker never reads skip_reason and never requires the store or vendor checks to have finished, so 10 rows this funnel reports as cut and 8 it reports as never-checked are still sendable today.',
    }],
  },
};

const SIGNALS: FunnelSignals = {
  computed_at: '2026-08-26T07:51:01Z',
  first_capture_at: '2026-08-25T23:48:00.921Z',
  first_capture_day: '2026-08-25',
  profile_views: { window_days: 30, named: 20, engine: 17, organic_icp: 0, other: 3, named_7d: 4, engine_7d: 4, organic_icp_7d: 0, other_7d: 0 },
  engagers: { window_days: 30, new: 97, organic_icp: 2, engine: 24 },
  buyer_dms_30d: 0,
  organic_openers_30d: 14,
  posts_buyers_30d: 11,
  posts: [{ social_id: 'urn:li:ugcPost:1', published_at: '2026-08-24T14:00:40.496Z', title: 'A DTC brand came to us spending $6,000 a month on Meta', impressions: 285, organic_icp_views_48h: 0, named_views_48h: 4, buyer_dms_48h: 0 }],
};

const boardWith = (truth: unknown): Board => ({ outreach: { note: 'x' }, outreach_truth: truth } as unknown as Board);

const LOG: OutreachLogEntry[] = [
  { prospect_id: 'l1', name: 'Grace Lin', company: 'Kaged', lane: 'cold', reply_count: 1, replied: true, last_sent_at: '2026-08-20T00:00:00Z', last_reply_at: '2026-08-25T17:13:40.839Z', messages: [] },
];

const render = (extra: Partial<{ log: OutreachLogEntry[] | null; signals: FunnelSignals | null; truth: unknown }> = {}) =>
  renderToStaticMarkup(
    <OutreachTopOfPanel
      board={boardWith('truth' in extra ? extra.truth : TRUTH)}
      accent="#4f46e5"
      log={extra.log ?? null}
      signals={extra.signals ?? null}
    />,
  );

describe('OutreachTopOfPanel — the ten winner obligations', () => {

  it('O1 the hero is the last FULL week, with its delta, and both periods are named', () => {
    const html = render();
    // 26 is the week of 17 Aug (the last closed week), not the 9 of the week in progress
    expect(html).toMatch(/font-size:clamp\(34px[^>]*>26</);
    expect(html).toContain('+11');
    expect(html).toContain('Week of 17 Aug, the last full week');
    expect(html).toContain('The week before that: 15.');
    // the in-progress week is the trailing bar and says so, in days
    expect(html).toContain('Week of 24 Aug is still counting');
    expect(html).toContain('9*');
  });

  it('O2 the imported "about 25 wrote back" quote never renders', () => {
    const html = render();
    expect(html).not.toContain('about 25 wrote back');
    expect(html).not.toContain('weekly note');
  });

  it('O3 the roster is exactly replied_7d, which is blacklist-filtered server side', () => {
    const html = render();
    for (const p of TRUTH.replied_7d) expect(html).toContain(p.name);
    // nobody the blob withheld can appear: the component has no other people source
    expect(html).not.toContain('Blacklisted Person');
    expect(html).toContain('Wrote back, last 7 days');
  });

  it('O4 intent chips come off reply_intent, and a null intent gets no chip and is counted', () => {
    const html = render();
    expect(html).toContain('Interested');   // positive
    expect(html).toContain('Not now');      // negative
    expect(html).toContain('Replied');      // neutral
    // 3 of 4 labelled -> the roster says so rather than implying all four are sorted
    expect(html).toContain('3 of 4 replies have been read and sorted');
  });

  it('O5 cumulative accepted is labelled whole program, next to its counted_at', () => {
    const html = render();
    expect(html).toContain('accepted the invite, whole program');
    expect(html).toContain('>205<');
    expect(html).toContain('All four counted 26 Aug, 04:01 UTC.');
  });

  it('O6 a roster name opens the EXISTING send-log entry when one exists, the profile when not', () => {
    const html = render({ log: LOG });
    // Grace Lin has a trail on the page
    expect(sendLogAnchorId('Grace Lin')).toBe('sendlog-grace-lin');
    expect(html).toContain('see the messages');
    // Gita V. has none, so her row falls back to her profile
    expect(html).toContain('open profile');
    expect(html).toContain('https://www.linkedin.com/in/ACoAAAAK4B0BrhJkiht1M8dyaT5Ygvpu7WMBW4I');
    // and no second trail component ships: the roster renders rows, never message bodies
    expect(html).not.toContain('&rarr; sent');
  });

  it('O7 every week number comes off replied_weekly, never a client-side bucket', () => {
    const html = render();
    const closed = TRUTH.replied_weekly.slice(0, -1);
    for (const w of closed) expect(html).toContain(`>${w.people}<`);
    // the week in progress prints with its own marker, never as a settled figure
    expect(html).toContain('>9*<');
    expect(html).toContain('13 Jul');
    expect(html).toContain('24 Aug');
  });

  it('O8 funnel_gates renders, scrubbed of tool names, column names and self-damage', () => {
    const html = render();
    expect(html).toContain('Where every name stands, list by list');
    expect(html).toContain('521 looked at, 138 contacted');
    expect(html).toContain('53 stopped here');
    // the discrepancy string is ON the page
    expect(html).toContain('221 rows are sitting at the queue line');
    expect(html).toContain('waiting on a review from Ivan');
    // scrubbed: no tool name, no column name, no admission against our own sender
    expect(html).not.toMatch(/Sales\s*Nav/i);
    expect(html).not.toContain('skip_reason');
    expect(html).not.toContain('picker');
    expect(html).not.toContain('still sendable today');
  });

  it('O9 every rendered figure carries the blob counted_at', () => {
    const html = render();
    expect((html.match(/26 Aug, 04:01 UTC/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('Counted 26 Aug, 04:01 UTC, trailing 7 days.');
  });

  it('O10 no blob, no winner: the component renders nothing rather than a zero', () => {
    expect(render({ truth: undefined })).toBe('');
    expect(render({ truth: { funnel: { contacted: 1 } } })).toBe('');
  });

  it('booked rows never synthesize a link, and a hand-closed booking says so', () => {
    const html = render();
    expect(html).toContain('Waldemar Schlemmer');
    expect(html).toContain('https://resources.risedtc.com/brief/?id=115629505025');
    // Stefan booked off the tracked link: no brief, no scan, no invented URL
    expect(html).toContain('booked outside the link');
    expect(html).toContain('Includes calls booked off the link as well as on it.');
  });
});

describe('OutreachSignalsTile — D-G funnel instruments', () => {

  it('leads with the moving number and splits the views three ways', () => {
    const html = render({ signals: SIGNALS });
    expect(html).toContain('Who is looking');
    expect(html).toContain('people we have already written to');
    expect(html).toContain('recruiters, agencies and other sellers');
    expect(html).toContain('brand owners who found you on their own');
    // the three parts add back to the named total printed in the section rule
    expect(SIGNALS.profile_views.engine + SIGNALS.profile_views.other + SIGNALS.profile_views.organic_icp)
      .toBe(SIGNALS.profile_views.named);
    expect(html).toContain('>20<');
  });

  it('the organic line carries its start date, in the DOM', () => {
    expect(render({ signals: SIGNALS })).toContain('tracking started Aug 26');
  });

  it('engagement renders as counts, with the trend suppressed until early September', () => {
    const html = render({ signals: SIGNALS });
    expect(html).toContain('97 people engaged your posts');
    expect(html).toContain('2 of them brand owners we had not written to');
    expect(html).toContain('It reads as a trend from about 2 Sep.');
  });

  it('absent signals simply do not render the tile', () => {
    expect(render({ signals: null })).not.toContain('Who is looking');
  });
});

describe('scrubVendor — the three strings the ?skin= branch was leaking', () => {
  it('strips the tool name and the punctuation it leaves behind', () => {
    expect(scrubVendor('Pure cold: Sales Navigator')).toBe('Pure cold');
    expect(scrubVendor('Cold: Sales Navigator + Apollo pull')).toBe('Cold');
    expect(scrubVendor('RiseDTC — Cold (DTC Sales Nav)')).toBe('RiseDTC — Cold (DTC)');
  });
  it('never leaks the original when the scrub eats the whole name', () => {
    expect(laneName('Sales Navigator')).toBe('Outreach lane');
    expect(laneName('')).toBe('Outreach lane');
  });
});

describe('plainGate', () => {
  it('drops only the sentence that reports our own sender ignoring our own filters', () => {
    const out = plainGate(TRUTH.funnel_gates.lanes[0].discrepancy);
    expect(out).toContain('221 rows are sitting at the queue line');
    expect(out).not.toContain('never reads');
    expect(out).not.toContain('skip_reason');
  });
  it('is empty for empty input, never the string "null"', () => {
    expect(plainGate(null)).toBe('');
    expect(plainGate(undefined)).toBe('');
  });
});
