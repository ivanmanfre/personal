import { describe, it, expect } from 'vitest';
import { leadTags, verticalOf } from './leadTags';
import type { OutreachProspect } from '../../../types/dashboard';

// Payloads copied verbatim from real outreach_prospects.enrichment_data rows
// (ARCH campaigns, read 2026-08-31) so the fixtures cannot drift from the shapes
// the sourcing pipeline actually writes.
const prospect = (enrichmentData: Record<string, any>): OutreachProspect =>
  ({ enrichmentData } as unknown as OutreachProspect);

const GUSTAV = {
  lane: 'engager_warm',
  source_kind: 'competitor_post_engager',
  triage_tier: 'A',
  anchor: 'Shahar David Hazan',
  game: 'TrainStation 3',
  audit_url: 'https://madebyarch.com/trainstation-3-audit/',
};

describe('verticalOf', () => {
  it('reads an explicit vertical first', () => {
    expect(verticalOf(prospect({ vertical: 'apps', lane: 'cold_games' }))).toBe('apps');
  });

  it('maps a non-game company_vertical onto the apps lane', () => {
    expect(verticalOf(prospect({ company_vertical: 'fintech' }))).toBe('apps');
    expect(verticalOf(prospect({ company_vertical: 'health_wellness' }))).toBe('apps');
  });

  it('falls back to the lane suffix', () => {
    expect(verticalOf(prospect({ lane: 'cold_apps' }))).toBe('apps');
    expect(verticalOf(prospect({ lane: 'warm_games' }))).toBe('games');
  });

  it('treats a named game as the games lane when the lane itself is vertical-blind', () => {
    expect(verticalOf(prospect(GUSTAV))).toBe('games');
  });

  it('reports unknown rather than defaulting, so a wrong reference is never implied', () => {
    expect(verticalOf(prospect({ lane: 'engager_warm', source_kind: 'competitor_post_engager' }))).toBe('unknown');
    expect(verticalOf(prospect({}))).toBe('unknown');
  });
});

describe('leadTags', () => {
  it('tags a real engager-harvested game lead end to end', () => {
    const tags = leadTags(prospect(GUSTAV));
    expect(tags.map((t) => t.label)).toEqual([
      'Games',
      'Tier A',
      'engager',
      '↗ Shahar David Hazan',
      'AUDIT · TrainStation 3',
    ]);
  });

  it('links the audit chip to the real page so it is one click from the list', () => {
    const audit = leadTags(prospect(GUSTAV)).find((t) => t.key === 'audit');
    expect(audit?.href).toBe('https://madebyarch.com/trainstation-3-audit/');
  });

  it('shows the EU-scale chip only on the EU offer lane', () => {
    const eu = leadTags(prospect({ lane: 'sponsor_team', eu_logic: 'true', company_vertical: 'fintech' }));
    expect(eu.map((t) => t.label)).toContain('EU scale');
    expect(eu.map((t) => t.label)).toContain('Apps');
    expect(leadTags(prospect({ lane: 'sponsor_team', eu_logic: 'false' })).map((t) => t.label)).not.toContain('EU scale');
  });

  it('labels YouTube-mined leads by how they were sourced', () => {
    const yt = leadTags(prospect({ source_kind: 'youtube_sponsor_mining', lane: 'sponsor_mined' }));
    expect(yt.map((t) => t.label)).toContain('YT sourced');
  });

  it('makes an unresolved vertical visible instead of silent', () => {
    const tags = leadTags(prospect({ lane: 'engager_warm', source_kind: 'competitor_post_engager', triage_tier: 'B' }));
    expect(tags[0].label).toBe('vertical?');
  });

  it('emits nothing for a row with no sourcing data rather than throwing', () => {
    expect(leadTags(prospect({})).map((t) => t.label)).toEqual(['vertical?']);
    expect(leadTags({ enrichmentData: null } as unknown as OutreachProspect).map((t) => t.label)).toEqual(['vertical?']);
  });

  it('parses enrichment_data that arrives as a JSON string', () => {
    const asString = { enrichmentData: JSON.stringify(GUSTAV) } as unknown as OutreachProspect;
    expect(verticalOf(asString)).toBe('games');
  });
});
