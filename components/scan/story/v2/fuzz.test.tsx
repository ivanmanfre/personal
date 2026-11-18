// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import './__fixtures__/dom';
import ScanStoryReport from '../ScanStoryReport';
import {toStoryFixture} from '../adapter';
import {validateEdition} from '../validate';
import rich from '../../../dev/scanlab/v2-rich.json';
import ownOnly from '../../../dev/scanlab/v2-own-only.json';
import thin from '../../../dev/scanlab/v2-thin.json';

/** Round 1 finding 2 and its ruling: every optional field the new layout reads, fed six hostile values, must still
 *  render a page (new or today's layout) and inject nothing. Invented fixtures only. */
const HOSTILE: [string, unknown][] = [
 ['number', 42],
 ['null', null],
 ['empty string', ''],
 ['object', {text: 'CMO', length: 3}],
 ['5,000 characters', 'W'.repeat(5000)],
 ['markup', '<script>window.PWNED=1</script><img src=x onerror="window.PWNED=1"><a href="javascript:window.PWNED=1">x</a>'],
];
const HERO_ROW = ['name', 'role', 'headline', 'source', 'how', 'date', 'date_kind', 'author', 'profile_url', 'post_url', 'post_excerpt', 'reason'];
const PATHS: Record<string, string[]> = {
 rich: [
  'hero', 'hero.v', 'hero.tier', 'hero.lead', ...HERO_ROW.map(k => `hero.lead.${k}`), 'hero.rows', 'hero.rows.0', ...HERO_ROW.map(k => `hero.rows.1.${k}`),
  'hero.count', 'hero.count.buyers', 'hero.count.own', 'hero.count.outside', 'hero.count.window_days', 'hero.count.authors', 'hero.count.authors.0',
  'hero.checked', 'hero.checked.people', 'hero.checked.passed', 'firm', 'firm.band', 'firm.staff', 'partner', 'partner.story',
  'audience.named', 'audience.named.0', ...['name', 'role', 'headline', 'how', 'date', 'profile_url'].map(k => `audience.named.0.${k}`), 'audience.engager_icp_count', 'audience.existing_clients', 'audience.audited_at',
  'competitor_engagers.at', 'competitor_engagers.count', 'competitor_engagers.window_days', 'competitor_engagers.competitors', 'competitor_engagers.notes', 'competitor_engagers.notes.0.to', 'competitor_engagers.notes.0.note', 'competitor_engagers.notes.0.headline',
  ...['name', 'headline', 'company', 'reason', 'competitor', 'engaged', 'post_excerpt', 'posted_at', 'commented_at', 'source', 'profile_url', 'post_url'].map(k => `competitor_engagers.people.0.${k}`),
  'founder.name', 'founder.first_name', 'founder.avatar_url', 'og_image_url',
  ...['rationale', 'rationale.content', 'rationale.resource', 'rationale.conversations', 'rationale.calls', 'rationale.close', 'brand', 'keyword', 'message', 'coverImage', 'contentHeading'].map(k => `story_v1.${k}`),
 ],
 ownOnly: [...HERO_ROW.map(k => `hero.lead.${k}`), ...['name', 'role', 'how', 'date', 'profile_url'].map(k => `audience.named.1.${k}`)],
 thin: ['hero.profile', 'hero.profile.quote', 'hero.profile.fix', 'hero.tier'],
};
const ROWS: Record<string, unknown> = {rich, ownOnly, thin};

function setPath(obj: any, path: string, value: unknown) {
 const keys = path.split('.'), last = keys.pop()!;
 let o = obj;
 for (const k of keys) { if (o == null || typeof o !== 'object') return false; o = o[k]; }
 if (o == null || typeof o !== 'object') return false;
 o[last] = value;
 return true;
}
const injected = (root: ParentNode) => [...root.querySelectorAll('*')].flatMap(el => [
 ...(el.tagName === 'SCRIPT' ? ['<script>'] : []),
 ...[...el.attributes].filter(a => /^on/i.test(a.name) || (/^(href|src|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))).map(a => `${el.tagName} ${a.name}=${a.value.slice(0, 40)}`),
]);

beforeEach(() => { vi.stubEnv('VITE_SCAN_HERO', '1'); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); delete (window as any).PWNED; });

describe('fuzz: a malformed field never blanks the page and never injects', () => {
 for (const [name, paths] of Object.entries(PATHS)) for (const path of paths) for (const [label, value] of HOSTILE) {
  it(`${name}: ${path} = ${label}`, () => {
   const row = JSON.parse(JSON.stringify(ROWS[name]));
   const cs = row.report_json.content_system;
   expect(setPath(cs, path, value)).toBe(true);
   const fixture = toStoryFixture(row), {edition} = validateEdition(cs.story_v1, fixture, true);
   // A story the validator refuses never reaches either layout (the route shows its not-ready state): nothing to render.
   if (!edition) return;
   const {container} = render(<ScanStoryReport fixture={fixture} edition={edition}/>);
   const main = container.querySelector('main')!;
   expect(main).toBeTruthy();
   expect(main.querySelector('h1')).toBeTruthy();
   expect((main.textContent || '').length).toBeGreaterThan(500);
   expect(main.querySelector('[data-scan-section="close"], .sp-close')).toBeTruthy();
   expect(injected(container)).toEqual([]);
   expect((window as any).PWNED).toBeUndefined();
  });
 }
});
