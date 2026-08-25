// @vitest-environment jsdom
/**
 * DeskOutreachSurface smoke test — renders the surface with minimal fabricated fixtures
 * (test-only, per the shared brief) via renderToStaticMarkup and checks the honesty gates:
 * the weekly plate only compares two weeks when the log actually spans them, booked calls
 * only appears once a real booking lands, and every absent metric renders the kit's
 * "not tracked yet" blank rather than a fabricated zero.
 *
 * Run:  npx vitest run components/client-board/DeskOutreachSurface.smoke.test.tsx
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeskOutreachSurface from './DeskOutreachSurface';
import type { Board, OutreachLogEntry } from '../ClientBoardPage';

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

const thisMonday = mondayOf(new Date());
const lastMonday = addDays(thisMonday, -7);

const baseOutreach = {
  note: 'Who your engine reaches out to on your behalf.',
  icp: {
    // the live board's label is a segment name; the card title is authored copy, not this
    label: 'DTC brand founders and operators',
    bar: ['Founder, co-founder or CEO', 'Shopify DTC brand, e-commerce only', 'Actively running Meta ads'],
    note: 'A name that misses any check never gets a message.',
  },
  lanes: [
    { key: 'warm', name: 'Warm: your post engagers', arms: 'connect + 2 DMs', detail: 'Anyone who engages your posts.' },
    { key: 'orbit', name: 'Client engager', arms: 'connect + 2 DMs', detail: 'People engaging your clients’ posts, pulled from the orbit scans we run on each of your two client accounts every week.', scanned: 444, count: 4 },
    { key: 'cold', name: 'Pure cold: Sales Navigator', arms: 'connect + 2 DMs', count: 75 },
  ],
  candidates: {
    note: 'Real sourced people awaiting your bless.',
    groups: [
      { key: 'new', name: 'New founders', items: [{ name: 'Cole Haith', role: 'Founder & CEO', company: 'BeSomething Clothing', note: 'Shopify ✓' }] },
    ],
  },
  orbit_finds: {
    people: [{ name: 'Heather Chan', role: 'Co-founder', company: 'Moonbow', one_liner: 'A client’s orbit.' }],
  },
};

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    company_name: 'Test Co',
    queue: [],
    outreach: baseOutreach as any,
    ...overrides,
  } as Board;
}

function outbound(sentAt: Date, type: string, channel: string): OutreachLogEntry['messages'][number] {
  return { direction: 'outbound', channel, type, sent_at: sentAt.toISOString(), text: 'hey there' };
}
function inbound(sentAt: Date): OutreachLogEntry['messages'][number] {
  return { direction: 'inbound', channel: 'linkedin', type: 'dm', sent_at: sentAt.toISOString(), text: 'sounds good' };
}

describe('DeskOutreachSurface', () => {
  it('renders the core blocks with a two-week log and shows the last-vs-this-week comparison', () => {
    const log: OutreachLogEntry[] = [
      {
        prospect_id: 'p1', name: 'Jane Prospect', company: 'Acme DTC', lane: 'cold',
        reply_count: 1, replied: true, last_sent_at: addDays(thisMonday, 1).toISOString(), last_reply_at: addDays(thisMonday, 2).toISOString(),
        messages: [
          outbound(lastMonday, 'connection_note', 'linkedin'),
          outbound(addDays(lastMonday, 1), 'dm', 'linkedin'),
          outbound(addDays(lastMonday, 2), 'inmail', 'linkedin_inmail'),
          inbound(addDays(lastMonday, 3)),
          outbound(addDays(thisMonday, 1), 'connection_note', 'linkedin'),
          outbound(addDays(thisMonday, 1), 'dm', 'linkedin'),
          outbound(addDays(thisMonday, 1), 'inmail', 'linkedin_inmail'),
          inbound(addDays(thisMonday, 2)),
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={log} usage={{ inmail_used: 3, inmail_cap: 20, inmail_remaining: 17, dm_sent: 12, connect_sent: 20, connect_cap: 40 }} foldLeads={<div data-testid="fold">FOLD LEADS</div>} />
    );

    // (a) key blocks present
    expect(html).toContain('Outreach');
    expect(html).toContain('Week against week');
    expect(html).toContain('Everyone contacted so far');
    expect(html).toContain('Leads');
    expect(html).toContain('The bar');
    expect(html).toContain('Happening now');

    // (b) data-metric and data-viz appear
    expect(html).toContain('data-metric');
    expect(html).toContain('data-viz');

    // (c) a drill renders collapsed
    expect(html).toMatch(/<details class="drill"(?![^>]*open)[^>]*>/);
    expect(html).not.toMatch(/<details class="drill"[^>]*\bopen\b/);

    // two full weeks of history -> the muted last-week row renders alongside the strong
    // this-week row, for all four channel categories (invites/DMs/InMails/wrote back).
    expect(html).toContain('2 live weeks of data: direction, not a trend');
    // both rows carry explicit dated labels now (a Sunday 'this week' collided with the This-week tab)
    expect((html.match(/w\/ /g) || []).length).toBeGreaterThanOrEqual(8);
    expect((html.match(/w\/ /g) || []).length).toBeGreaterThanOrEqual(4);

    // foldLeads is folded in behind its own collapsed drill
    expect(html).toContain('FOLD LEADS');
  });

  it('renders only this-week counts (no last-week comparison) when the log covers just a few days', () => {
    const log: OutreachLogEntry[] = [
      {
        prospect_id: 'p2', name: 'Recent Prospect', company: 'New Co', lane: 'cold',
        reply_count: 0, replied: false, last_sent_at: addDays(new Date(), -1).toISOString(), last_reply_at: null,
        messages: [
          outbound(addDays(new Date(), -3), 'connection_note', 'linkedin'),
          outbound(addDays(new Date(), -2), 'dm', 'linkedin'),
          outbound(addDays(new Date(), -1), 'inmail', 'linkedin_inmail'),
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={log} />
    );

    expect(html).toMatch(/w\/ \d+ \w+, Mon-Fri/);
    // no two-week comparison chip, no muted "w/ <date>" rows
    expect(html).not.toContain('2 live weeks of data: direction, not a trend');
    // dated labels render on every row now; no-comparison means exactly one dated row per group (4), never two
    expect((html.match(/w\/ \d+ \w+/g) || []).length).toBe(4);
    expect(html).toContain("Less than 2 weeks of sends so far");
  });

  it('shows the honest not-started state on an empty log, never a fabricated zero', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={[]} />
    );

    expect(html).toContain('Sends have not started');
    expect(html).toContain('not tracked yet');
    // the accepted-invite step is always blank (not derivable from the log)
    expect(html).toContain('Accepted the invite');
    expect(html).toContain('Send log: nothing sent yet');
  });

  it('renders the booked-calls block with the honest empty state when no booking exists', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard({ precall_briefs: [] })} accent="#4f46e5" log={[]} />
    );
    // the block itself never disappears — the empty state is the block
    expect(html).toContain('Booked calls');
    expect(html).toContain('from your LinkedIn booking link');
    expect(html).toContain('None yet.');
    expect(html).toContain('When someone books, the row lands here');
    // …but no fabricated row: no buttons, no sample name
    expect(html).not.toContain('Pre-call brief');
    expect(html).not.toContain('Their scan');
  });

  it('renders the booked-calls empty state when precall_briefs is missing entirely', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={[]} />
    );
    expect(html).toContain('Booked calls');
    expect(html).toContain('None yet.');
  });

  it('never renders a full bar for a zero value in the weekly comparison', () => {
    // one prospect, one invite last week and none this week, no DMs/InMails/replies at all:
    // every group but invites is 0 vs 0, and invites is 0 this week vs 1 last week.
    const log: OutreachLogEntry[] = [
      {
        prospect_id: 'z1', name: 'Zero Case', company: null, lane: 'cold',
        reply_count: 0, replied: false, last_sent_at: lastMonday.toISOString(), last_reply_at: null,
        messages: [outbound(lastMonday, 'connection_note', 'linkedin')],
      },
    ];
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={log} />
    );
    // inside the weekly plate: exactly one non-zero width (last week's single invite, scaled
    // to its own group max), the other seven bars — including both all-zero groups — at 0%.
    const plate = html.slice(html.indexOf('Week against week'), html.indexOf('Everyone contacted so far'));
    const widths = (plate.match(/class="barfill"[^>]*?width:\s*([\d.]+)%/g) || [])
      .map((s) => parseFloat((s.match(/width:\s*([\d.]+)%/) as RegExpMatchArray)[1]));
    expect(widths.length).toBe(8);
    expect(widths.filter((w) => w === 0).length).toBe(7);
    expect(widths.filter((w) => w === 100).length).toBe(1);
    // and a zero-width fill carries no min-width stub
    expect(html).toMatch(/width:0%;min-width:0/);
  });

  it('wires the funnel accepts step from a stamped outreach indicator, and blanks it without one', () => {
    const stamped = renderToStaticMarkup(
      <DeskOutreachSurface
        board={makeBoard({
          performance: {
            outreach_indicators: [
              { key: 'accepts', label: 'Accepted connections', value: 31, source: 'warm and cold lanes', captured_at: '2026-08-01T02:05:46.773Z' },
              { key: 'calls_booked', label: 'Calls booked from outreach', value: 0, source: 'your calendar' },
            ],
          },
        } as any)}
        accent="#4f46e5"
        log={[]}
      />
    );
    expect(stamped).toContain('Accepted the invite');
    expect(stamped).toMatch(/>31</);
    expect(stamped).toContain('counted across the whole program');
    // an unstamped indicator (calls booked, value 0, no captured_at) stays an honest blank
    expect(stamped).toContain('not tracked yet');

    // same indicator with the stamp removed -> blank, never the number
    const unstamped = renderToStaticMarkup(
      <DeskOutreachSurface
        board={makeBoard({
          performance: { outreach_indicators: [{ key: 'accepts', label: 'Accepted connections', value: 31, source: 'warm and cold lanes' }] },
        } as any)}
        accent="#4f46e5"
        log={[]}
      />
    );
    expect(unstamped).toContain('Accepted the invite');
    expect(unstamped).not.toMatch(/>31</);
    expect(unstamped).not.toContain('counted across the whole program');
  });

  it('never renders vendor vocabulary in a lane name, and keeps the lane line short', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={[]} />
    );
    expect(html).not.toMatch(/sales\s*nav/i);
    expect(html).not.toMatch(/apollo/i);
    expect(html).not.toMatch(/linkedin recruiter/i);
    // "Pure cold: Sales Navigator" -> "Pure cold"
    expect(html).toContain('Pure cold<');
    // descriptions and cadence chips are back on the row, description clipped to one line
    expect(html).toContain('Anyone who engages your posts.');
    expect(html).toContain('connect + 2 DMs');
    expect(html).toMatch(/People engaging your clients[^<]{0,80}…/);
    expect(html).not.toContain('every week.');
  });

  it('names the month on the send-allowance counter so it cannot read as a week contradiction', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface
        board={makeBoard()} accent="#4f46e5" log={[]}
        usage={{ inmail_used: 0, inmail_cap: 20, inmail_remaining: 20, dm_sent: 1, connect_sent: 4, connect_cap: 40 }}
      />
    );
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()];
    expect(html).toContain(`Sent in ${month} so far`);
    expect(html).not.toContain('Sent this month');
    expect(html).toContain('<b>1</b> DM<'); // singular, not "1 DMs"
  });

  it('titles the bar card with the authored question, not the segment label', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={[]} />
    );
    expect(html).toContain('Who gets a message from your name');
    expect(html).not.toContain('DTC brand founders and operators');
  });

  it('renders the booked-calls section with both buttons when precall_briefs has rows', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface
        board={makeBoard({
          precall_briefs: [{
            id: 'b1', name: 'Sam Founder', company: 'Cool Brand', when_str: 'Tue 4 Aug, 10:00 AM',
            scan_url: 'https://example.com/scan', brief_url: 'https://example.com/brief',
          }],
        })}
        accent="#4f46e5"
        log={[]}
      />
    );
    expect(html).toContain('Booked calls');
    expect(html).toContain('Sam Founder');
    expect(html).toContain('Their scan');
    expect(html).toContain('Pre-call brief');
  });

  it('drops any numeric fit/score chip from the candidate list', () => {
    const html = renderToStaticMarkup(
      <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={[]} />
    );
    expect(html).toContain('Cole Haith');
    expect(html).toContain('Heather Chan');
    expect(html).not.toMatch(/ICP/i);
    expect(html).not.toContain('co3-icp');
  });

it('renders the desk Up-next card from a populated status: pace, meter, named queue, no scores', () => {
  const status = {
    is_live: true, any_active: true, dispatch_scheduled: true,
    campaigns: [], todays_sends: 7, daily_cap: 20, next_window_at: '2026-08-03T16:30:00Z',
    up_next: [
      { name: 'Ada Founder', company: 'Brand Co', domain: 'brand.co', icp_score: 8, lane: 'orbit' },
      { name: 'Ben Owner', company: null, domain: null, icp_score: 3, lane: 'cold' },
    ],
  } as never;
  const html = renderToStaticMarkup(
    <DeskOutreachSurface board={makeBoard({})} accent="#ffc71d" usage={null} log={null} status={status} foldLeads={null} />
  );
  expect(html).toContain('Up next');
  expect(html).toContain('Ada Founder');
  expect(html).toContain('of 20 sends today');
  // the inverted scorer's numbers never reach the client
  expect(html).not.toMatch(/icp/i);
  expect(html).not.toContain('>8<');
});

it('legacy feed (outbound-only messages): weekly wrote-back falls back to replied/last_reply_at and never renders the false 0', () => {
  // Today's RPC hard-filters messages to outbound-only, but still ships replied +
  // last_reply_at per entry. Two entries replied this week, one last week, one never.
  const log: OutreachLogEntry[] = [
    {
      prospect_id: 'l1', name: 'Replier One', company: 'Brand A', lane: 'cold',
      reply_count: 1, replied: true, last_sent_at: lastMonday.toISOString(), last_reply_at: addDays(thisMonday, 1).toISOString(),
      messages: [outbound(lastMonday, 'connection_note', 'linkedin'), outbound(addDays(thisMonday, 1), 'dm', 'linkedin')],
    },
    {
      prospect_id: 'l2', name: 'Replier Two', company: 'Brand B', lane: 'cold',
      reply_count: 2, replied: true, last_sent_at: addDays(lastMonday, 1).toISOString(), last_reply_at: addDays(thisMonday, 2).toISOString(),
      messages: [outbound(addDays(lastMonday, 1), 'dm', 'linkedin')],
    },
    {
      prospect_id: 'l3', name: 'Replier Last Week', company: 'Brand C', lane: 'cold',
      reply_count: 1, replied: true, last_sent_at: lastMonday.toISOString(), last_reply_at: addDays(lastMonday, 3).toISOString(),
      messages: [outbound(lastMonday, 'dm', 'linkedin')],
    },
    {
      prospect_id: 'l4', name: 'Silent', company: 'Brand D', lane: 'cold',
      reply_count: 0, replied: false, last_sent_at: addDays(thisMonday, 1).toISOString(), last_reply_at: null,
      messages: [outbound(addDays(thisMonday, 1), 'connection_note', 'linkedin')],
    },
  ];
  const html = renderToStaticMarkup(
    <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={log} />
  );
  // two people replied inside this week; the empty inbound array must NOT zero the headline
  expect(html).toContain('2 wrote back');
  expect(html).not.toContain('0 wrote back');
  expect(html).toContain('people, not messages');
  // no connected_at anywhere in the feed -> no Accepted row, no definition line
  expect(html).not.toContain('invites that turned into connections');
  expect(html).not.toContain('Accepted counts the week the accept landed');
  // no open-profile sends in either week -> no permanent zero row
  expect(html).not.toContain('Open profile messages');
});

it('post-patch feed: inbound-people count, the Accepted row with its definition line, and the paid/free InMail split', () => {
  // The staged RPC patch ships inbound message rows + connection_sent_at/connected_at.
  const log = [
    {
      prospect_id: 'q1', name: 'Paid InMail Target', company: 'Brand P', lane: 'orbit',
      reply_count: 2, replied: true, last_sent_at: addDays(thisMonday, 1).toISOString(), last_reply_at: addDays(thisMonday, 3).toISOString(),
      connection_sent_at: lastMonday.toISOString(), connected_at: addDays(thisMonday, 1).toISOString(),
      messages: [
        outbound(lastMonday, 'connection_note', 'linkedin'),
        // PAID InMail: type 'inmail'
        outbound(addDays(thisMonday, 1), 'inmail', 'linkedin_inmail'),
        inbound(addDays(thisMonday, 2)),
        inbound(addDays(thisMonday, 3)),
      ],
    },
    {
      prospect_id: 'q2', name: 'Open Profile Target', company: 'Brand Q', lane: 'cold',
      reply_count: 1, replied: true, last_sent_at: addDays(thisMonday, 1).toISOString(), last_reply_at: addDays(thisMonday, 2).toISOString(),
      connection_sent_at: addDays(lastMonday, 1).toISOString(), connected_at: addDays(lastMonday, 2).toISOString(),
      messages: [
        outbound(addDays(lastMonday, 1), 'connection_note', 'linkedin'),
        // FREE open-profile message: type 'dm' on the inmail channel
        outbound(addDays(thisMonday, 1), 'dm', 'linkedin_inmail'),
        inbound(addDays(thisMonday, 2)),
      ],
    },
    {
      prospect_id: 'q3', name: 'No Accept Yet', company: 'Brand R', lane: 'cold',
      reply_count: 0, replied: false, last_sent_at: lastMonday.toISOString(), last_reply_at: null,
      connection_sent_at: lastMonday.toISOString(), connected_at: null,
      messages: [outbound(lastMonday, 'connection_note', 'linkedin')],
    },
  ] as unknown as OutreachLogEntry[];
  const html = renderToStaticMarkup(
    <DeskOutreachSurface board={makeBoard()} accent="#4f46e5" log={log} />
  );
  // 3 inbound messages this week from 2 people -> the headline number is PEOPLE
  expect(html).toContain('2 wrote back');
  expect(html).not.toContain('3 wrote back');
  // one paid InMail + one open-profile message land in different buckets, never "2 InMails"
  expect(html).not.toContain('2 InMails');
  expect(html).toContain('1 InMail,');
  expect(html).toContain('1 open profile message');
  expect(html).toContain('Open profile messages');
  expect(html).toContain('free, no connection needed');
  expect(html).toContain('uses the monthly InMail allowance');
  // connected_at present -> the Accepted row renders, with its landed-definition line
  expect(html).toContain('invites that turned into connections');
  expect(html).toContain('Accepted counts the week the accept landed, not the week the invite went out');
});

it('board.outreach_truth present: booked count + list, funnel replied, and journey plate read from it, stamped with counted_at — precall_briefs ignored', () => {
  const html = renderToStaticMarkup(
    <DeskOutreachSurface
      board={makeBoard({
        // precall_briefs deliberately disagrees (1 row, different name) to prove
        // outreach_truth wins outright rather than merging or falling back.
        precall_briefs: [{ id: 'legacy1', name: 'Legacy Only Person', company: 'Old Co', when_str: 'Mon 1 Jan, 9:00 AM' }],
        outreach_truth: {
          counted_at: '2026-08-25T21:05:36Z',
          semantics_version: 'clientweekpacket-2026-08-25',
          booked: [
            { prospect_id: 'p1', name: 'Stefan Hertzberg', company: 'Vivi Labs', booked_at: '2026-08-20T21:34:07.828Z', brief_url: null, scan_url: null },
            { prospect_id: 'p2', name: 'Chas Waters', company: 'Cool Brand', booked_at: '2026-08-06T17:09:17.826Z', brief_url: 'https://example.com/brief', scan_url: 'https://example.com/scan' },
          ],
          replied_7d: [],
          replied_weekly: [],
          funnel: { contacted: 857, accepted: 203, replied_people: 19, booked: 2 },
        },
      } as any)}
      accent="#4f46e5"
      log={[]}
    />
  );
  // booked rows come from outreach_truth, not precall_briefs
  expect(html).toContain('Stefan Hertzberg');
  expect(html).toContain('Chas Waters');
  expect(html).not.toContain('Legacy Only Person');
  // a hand-closed booking with no brief/scan link renders the name, no fabricated link
  expect(html).toContain('Cool Brand');
  // booked count (funnel step + journey plate) reads outreach_truth.booked.length, not 1
  expect(html).toMatch(/>2</);
  // funnel replied step + "Replies in play" both read funnel.replied_people (19), not
  // entries.filter(e=>e.replied).length (0, since log is empty)
  expect(html).toContain('Wrote back');
  expect((html.match(/>19</g) || []).length).toBeGreaterThanOrEqual(2);
  // every number sourced from outreach_truth carries the counted_at stamp
  expect((html.match(/counted 25 Aug/g) || []).length).toBeGreaterThanOrEqual(3);
});

it('board.outreach_truth absent: falls back to precall_briefs for booked calls and entries[].replied for the funnel/journey replied count, no counted_at stamp', () => {
  const log: OutreachLogEntry[] = [
    {
      prospect_id: 'f1', name: 'Fallback Replier', company: 'Brand F', lane: 'cold',
      reply_count: 1, replied: true, last_sent_at: lastMonday.toISOString(), last_reply_at: addDays(thisMonday, 1).toISOString(),
      messages: [outbound(lastMonday, 'connection_note', 'linkedin')],
    },
  ];
  const html = renderToStaticMarkup(
    <DeskOutreachSurface
      board={makeBoard({
        precall_briefs: [{ id: 'legacy1', name: 'Legacy Booked Person', company: 'Old Co', when_str: 'Mon 1 Jan, 9:00 AM' }],
      })}
      accent="#4f46e5"
      log={log}
    />
  );
  expect(html).toContain('Legacy Booked Person');
  // 1 entry with replied:true -> funnel/journey replied count is 1, the old behaviour
  expect(html).toContain('Replies in play');
  expect(html).not.toContain('counted ');
});

});
