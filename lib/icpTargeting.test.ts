// lib/icpTargeting.test.ts
import { describe, it, expect } from 'vitest';
import { deriveIcpTargeting, MIN_SAMPLE_LEADS } from './icpTargeting';

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

  it('returns null when fewer than MIN_SAMPLE_LEADS named people exist', () => {
    expect(MIN_SAMPLE_LEADS).toBe(3);
    const result = deriveIcpTargeting(fullTargeting, { named: namedThree.slice(0, 2) });
    expect(result).toBeNull();
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
});
