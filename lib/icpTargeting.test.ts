// lib/icpTargeting.test.ts
import { describe, it, expect } from 'vitest';
import { deriveIcpTargeting, reasonFor, MIN_SAMPLE_LEADS, MAX_HEADLINE_CHARS, buyerDefinitionWords, LEGACY_BUYER_WORDS, deriveColdOutbound } from './icpTargeting';

// Written as an escape so this test file itself carries no em dash character in its source,
// while still feeding the real one through the sanitiser it exists to cover.
const EM = '\u2014';

const fullTargeting = {
  icp_line: 'DTC skincare founders running $100k to $1M a month',
  segments: [{ label: 'DTC skincare', note: 'their current buyer' }],
  pool_sources: ['engagers' as const, 'competitor_engagers' as const],
};

const namedThree = [
  { name: 'Ada Lovelace', headline: 'Founder, Analytical Co', source: 'engager' },
  { name: 'Grace Hopper', headline: 'CEO, Compiler Labs', source: 'engager' },
  { name: 'Karen Sparck Jones', headline: 'Founder, Retrieval Ltd', source: 'network' },
];

describe('deriveIcpTargeting', () => {
  it('returns null when icp_targeting is absent', () => {
    expect(deriveIcpTargeting(undefined, { named: namedThree })).toBeNull();
  });

  it('drops the lead exhibit but keeps the buyer line when fewer than MIN_SAMPLE_LEADS exist', () => {
    expect(MIN_SAMPLE_LEADS).toBe(3);
    const result = deriveIcpTargeting(fullTargeting, { named: namedThree.slice(0, 2) });
    expect(result).not.toBeNull();
    expect(result!.icpLine).toBe('DTC skincare founders running $100k to $1M a month');
    expect(result!.leads).toEqual([]);
  });

  it('drops the lead exhibit when the audience audit named nobody', () => {
    const result = deriveIcpTargeting(fullTargeting, { named: [] });
    expect(result).not.toBeNull();
    expect(result!.leads).toEqual([]);
    expect(result!.segments.length).toBeGreaterThan(0);
  });

  it('returns null when icp_line is blank', () => {
    const result = deriveIcpTargeting({ ...fullTargeting, icp_line: '   ' }, { named: namedThree });
    expect(result).toBeNull();
  });

  it('derives leads and pool labels when evidence is sufficient', () => {
    const result = deriveIcpTargeting(fullTargeting, { named: namedThree });
    expect(result).not.toBeNull();
    expect(result!.icpLine).toBe('DTC skincare founders running $100k to $1M a month');
    expect(result!.leads).toHaveLength(3);
    expect(result!.leads[0]).toEqual({
      name: 'Ada Lovelace',
      headline: 'Founder, Analytical Co',
      reason: 'Engaged your posts',
    });
    expect(result!.leads[2].reason).toBe('In your connections');
    expect(result!.poolLabels).toEqual([
      'People who engage your posts',
      'People who engage your competitors',
    ]);
  });

  it('drops a blank-named entry before capping at four, not after', () => {
    // The blank entry sits at raw index 3, inside the first four raw positions. A
    // slice-then-filter implementation would slice in the blank and then filter it
    // out, leaving only 3 leads. A filter-then-slice implementation drops the blank
    // first and fills the fourth slot from the next valid entry (Ida Rhodes).
    const many = [
      ...namedThree,
      { name: '  ', headline: 'x', source: 'engager' },
      { name: 'Ida Rhodes', headline: 'COO', source: 'engager' },
      { name: 'Jean Bartik', headline: 'Founder', source: 'engager' },
    ];
    const result = deriveIcpTargeting(fullTargeting, { named: many });
    expect(result!.leads).toHaveLength(4);
    expect(result!.leads.map((l) => l.name)).toEqual([
      'Ada Lovelace',
      'Grace Hopper',
      'Karen Sparck Jones',
      'Ida Rhodes',
    ]);
    expect(result!.leads.every((l) => l.name.trim().length > 0)).toBe(true);
  });

  it('labels the network pool without calling the people in it buyers', () => {
    const result = deriveIcpTargeting(
      { ...fullTargeting, pool_sources: ['network' as const] },
      { named: namedThree },
    );
    expect(result!.poolLabels).toEqual(['People already in your connections']);
    expect(result!.poolLabels.join(' ')).not.toMatch(/buyer/i);
  });
});

// The claim boundary on a lead row. "Engaged your posts" beside a real person's name is an
// assertion that they commented on the prospect's posts. It may only be printed when the
// data says so, never as a default.
describe('reasonFor', () => {
  it('labels the sources it recognises', () => {
    expect(reasonFor('engager')).toBe('Engaged your posts');
    expect(reasonFor('network')).toBe('In your connections');
  });

  it('claims no mechanism when source is unset', () => {
    expect(reasonFor(undefined)).toBe('In your audience');
    expect(reasonFor('')).toBe('In your audience');
    expect(reasonFor('   ')).toBe('In your audience');
  });

  it('claims no mechanism when source is unrecognised', () => {
    for (const s of ['engagers', 'competitor_engager', 'signals', 'imported', 'null']) {
      expect(reasonFor(s)).toBe('In your audience');
    }
  });

  it('never asserts engagement or connection for an unknown source', () => {
    for (const s of [undefined, '', 'who knows']) {
      expect(reasonFor(s)).not.toMatch(/engag|connection/i);
    }
  });

  it('carries the unset source through derivation onto the lead row', () => {
    const result = deriveIcpTargeting(fullTargeting, {
      named: [
        { name: 'Ada Lovelace', headline: 'Founder' },
        { name: 'Grace Hopper', headline: 'CEO', source: 'mystery' },
        { name: 'Karen Sparck Jones', headline: 'Founder', source: 'network' },
      ],
    });
    expect(result!.leads.map((l) => l.reason)).toEqual([
      'In your audience',
      'In your audience',
      'In your connections',
    ]);
  });
});

// Model-emitted copy reaches the page through this module, so the copy guarantees live here
// rather than in the component, where no test would cover them.
describe('deriveIcpTargeting copy guarantees', () => {
  it('replaces em dashes in the ICP line and in every headline', () => {
    const result = deriveIcpTargeting(
      { ...fullTargeting, icp_line: `DTC skincare founders ${EM} $100k to $1M a month` },
      {
        named: [
          { name: 'Ada Lovelace', headline: `Founder ${EM} Analytical Co`, source: 'engager' },
          { name: 'Grace Hopper', headline: `CEO${EM}Compiler Labs`, source: 'engager' },
          { name: 'Karen Sparck Jones', headline: 'Founder', source: 'network' },
        ],
      },
    );
    expect(result!.icpLine).toBe('DTC skincare founders, $100k to $1M a month');
    expect(result!.leads[0].headline).toBe('Founder, Analytical Co');
    expect(result!.leads[1].headline).toBe('CEO, Compiler Labs');
    const all = [result!.icpLine, ...result!.leads.map((l) => l.headline)].join(' ');
    expect(all).not.toContain(EM);
  });

  it('collapses runs of whitespace and newlines', () => {
    const result = deriveIcpTargeting(
      { ...fullTargeting, icp_line: '  DTC   skincare\n founders  ' },
      {
        named: [
          { name: ' Ada  Lovelace ', headline: 'Founder,\n\tAnalytical Co', source: 'engager' },
          ...namedThree.slice(1),
        ],
      },
    );
    expect(result!.icpLine).toBe('DTC skincare founders');
    expect(result!.leads[0].name).toBe('Ada Lovelace');
    expect(result!.leads[0].headline).toBe('Founder, Analytical Co');
  });

  it('trims an over-long headline to a display length, on a word boundary', () => {
    const long =
      'Founder and Chief Executive Officer at Analytical Company Limited, also advising ' +
      'seven other consumer brands on retention and lifecycle marketing strategy';
    const result = deriveIcpTargeting(fullTargeting, {
      named: [{ name: 'Ada Lovelace', headline: long, source: 'engager' }, ...namedThree.slice(1)],
    });
    const out = result!.leads[0].headline;
    expect(MAX_HEADLINE_CHARS).toBe(80);
    expect(out.length).toBeLessThanOrEqual(MAX_HEADLINE_CHARS + 1);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1)).not.toMatch(/\s$/);
    // Never cuts mid-word: every word kept is a whole word from the source.
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
  });

  it('leaves a headline at or under the display length untouched', () => {
    const exact = 'Founder, Analytical Co';
    const result = deriveIcpTargeting(fullTargeting, {
      named: [{ name: 'Ada Lovelace', headline: exact, source: 'engager' }, ...namedThree.slice(1)],
    });
    expect(result!.leads[0].headline).toBe(exact);
    expect(result!.leads[0].headline).not.toContain('…');
  });

  it('returns null when the ICP line is nothing but an em dash and whitespace', () => {
    const result = deriveIcpTargeting({ ...fullTargeting, icp_line: ` ${EM} ` }, { named: namedThree });
    expect(result).toBeNull();
  });
});

describe('reasonFor against production source values', () => {
  it('labels network_sample as a connection, the value live scans actually emit', () => {
    expect(reasonFor('network_sample')).toBe('In your connections');
  });

  it('still labels engager and legacy network correctly', () => {
    expect(reasonFor('engager')).toBe('Engaged your posts');
    expect(reasonFor('network')).toBe('In your connections');
  });

  it('falls back to the neutral label for anything unrecognised', () => {
    expect(reasonFor('competitor_engager')).toBe('In your audience');
    expect(reasonFor(undefined)).toBe('In your audience');
  });
});

// The page's buyer sentence defines what every counted number above it means, so a wrong
// or empty value must never widen into a guess.
describe('buyerDefinitionWords', () => {
  it('uses the audited definition when the audit named one', () => {
    expect(buyerDefinitionWords('a decision maker at a mobile game studio')).toBe(
      'a decision maker at a mobile game studio',
    );
  });

  it('falls back to the legacy DTC rubric when the audit named none', () => {
    for (const empty of [undefined, null, '', '   ']) {
      expect(buyerDefinitionWords(empty)).toBe(LEGACY_BUYER_WORDS);
    }
  });

  it('falls back rather than emit a bare separator', () => {
    // cleanText strips a lone em dash to nothing; without the fallback the page would read
    // "A buyer here means ." on any audit that wrote a placeholder.
    expect(buyerDefinitionWords('—')).toBe(LEGACY_BUYER_WORDS);
  });

  it('normalises em dashes the way the rest of the report does', () => {
    expect(buyerDefinitionWords('a founder — or a growth lead')).toBe(
      'a founder, or a growth lead',
    );
  });

  it('keeps the legacy sentence byte-identical to what the page shipped before', () => {
    expect(LEGACY_BUYER_WORDS).toBe(
      'a decision maker at a consumer brand: founder, CMO, or head of growth',
    );
  });
});

describe('deriveColdOutbound', () => {
  const full = {
    note: 'We build a fresh list of store owners who have never met you.',
    sources: [
      { label: 'Engagers of rival Klaviyo agencies', detail: 'They already want this result' },
      { label: 'Brands running Meta ads now', detail: 'Live spend means live budget' },
      { label: 'Shops hiring email or CRM staff', detail: 'Retention is a live priority' },
    ],
    filters: ['Other email agencies', 'Dormant stores'],
  };

  it('returns the lane when it is complete', () => {
    const d = deriveColdOutbound(full);
    expect(d?.sources.length).toBe(3);
    expect(d?.filters).toEqual(['Other email agencies', 'Dormant stores']);
  });

  it('returns null when absent', () => {
    expect(deriveColdOutbound(undefined)).toBeNull();
  });

  it('returns null without a note, because the lane needs its own sentence', () => {
    expect(deriveColdOutbound({ ...full, note: '   ' })).toBeNull();
  });

  it('returns null below the source floor', () => {
    expect(deriveColdOutbound({ ...full, sources: full.sources.slice(0, 1) })).toBeNull();
    expect(deriveColdOutbound({ ...full, sources: [] })).toBeNull();
  });

  // Order matters: filter the blanks first, then count. Counting first would let a list of
  // three entries where two are blank clear a floor that only one real source reached.
  it('drops blank-label sources before checking the floor', () => {
    const padded = { ...full, sources: [full.sources[0], { label: '  ', detail: 'x' }, { label: '', detail: 'y' }] };
    expect(deriveColdOutbound(padded)).toBeNull();
  });

  it('renders without filters rather than inventing one', () => {
    const d = deriveColdOutbound({ ...full, filters: [] });
    expect(d).not.toBeNull();
    expect(d?.filters).toEqual([]);
  });

  it('normalises em dashes out of every string', () => {
    const d = deriveColdOutbound({
      note: 'We build the list — you never touch it',
      sources: [
        { label: 'Rival agencies — their engagers', detail: 'a — b' },
        { label: 'Live ad spend', detail: 'c' },
      ],
      filters: ['peers — and lookalikes'],
    });
    const all = JSON.stringify(d);
    expect(all).not.toContain('—');
  });

  it('keeps a source that has no detail', () => {
    const d = deriveColdOutbound({ ...full, sources: [{ label: 'Rival engagers' }, { label: 'Live ad spend' }] });
    expect(d?.sources).toEqual([
      { label: 'Rival engagers', detail: '' },
      { label: 'Live ad spend', detail: '' },
    ]);
  });
});
