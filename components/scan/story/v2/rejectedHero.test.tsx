// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import './__fixtures__/dom';
import ScanStoryReport, {StoryBody, useV2} from '../ScanStoryReport';
import {toStoryFixture} from '../adapter';
import {validateEdition} from '../validate';
import {BRAND_LINE} from './copy';
import fewBuyers from '../../../dev/scanlab/v2-few-buyers.json';
import norwegian from '../../../dev/scanlab/v2-norwegian.json';
import ownOnly from '../../../dev/scanlab/v2-own-only.json';
import rich from '../../../dev/scanlab/v2-rich.json';
import thin from '../../../dev/scanlab/v2-thin.json';
import zeroOwn from '../../../dev/scanlab/v2-zero-own.json';

/** Round 2 finding 2 and ruling R-REJECT: a hero that is present but fails the checks gets the new layout's plainest
 *  first screen (no count, no zero-state line, no named buyer, no date); an absent or null hero keeps today's layout.
 *  Invented fixtures only. The first-screen geometry at 1440x900 and 390x844 is measured in a browser (see the PR notes). */
const ROWS: Record<string, any> = {'few-buyers': fewBuyers, norwegian, 'own-only': ownOnly, rich, thin, 'zero-own': zeroOwn};
const REJECT: Record<string, (cs: any) => void> = {
 'lead.how missing': cs => { if (cs.hero.lead) delete cs.hero.lead.how; else cs.hero.v = 2; },
 'unknown lead.source': cs => { if (cs.hero.lead) cs.hero.lead.source = 'ads'; else cs.hero.tier = 'ads'; },
 'version 2': cs => { cs.hero.v = 2; },
 'counts that do not add up': cs => { cs.hero.count.buyers = cs.hero.count.own + cs.hero.count.outside + 1; },
 'a string': cs => { cs.hero = 'hero'; },
 'a number': cs => { cs.hero = 0; },
 'an empty object': cs => { cs.hero = {}; },
 'an array': cs => { cs.hero = []; },
};
const STANDALONE_01 = /(?<![\w.,+$/])[01](?![\w.,%+/])/;
const ZERO_LINE = /No buyer matches|no buyer matches/;
const DATE = /\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;
const copy = (name: string) => JSON.parse(JSON.stringify(ROWS[name]));
const load = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return {f, edition: edition!}; };
/** Every person name the scan holds: hero rows, own engagers, outside buyers, drafted-note recipients. */
const people = (cs: any): string[] => [
 ...(cs.hero?.rows ?? []).map((r: any) => r?.name), cs.hero?.lead?.name,
 ...(cs.audience?.named ?? []).map((n: any) => n?.name),
 ...(cs.competitor_engagers?.people ?? []).map((p: any) => p?.name),
].filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 2);

beforeEach(() => { vi.stubEnv('VITE_SCAN_HERO', '1'); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('R-REJECT: a rejected hero gets the plainest first screen of the new layout', () => {
 it('reviewer input 1: few-buyers with hero.lead.how deleted shows no count and no oversized 1', () => {
  const row = copy('few-buyers'); delete row.report_json.content_system.hero.lead.how;
  const {f, edition} = load(row);
  expect(f.hero).toBeUndefined();
  expect(f.heroRejected).toBeDefined();
  const {container} = render(<ScanStoryReport fixture={f} edition={edition}/>);
  expect(container.querySelector('.sp-audit, .audit-number')).toBeNull();
  const hero = container.querySelector('.sv2-hero')!;
  expect(hero).toBeTruthy();
  expect(hero.textContent).not.toMatch(/\d/);
  expect(container.querySelector('.sv2-count, .sv2-sheet')).toBeNull();
 });

 it('reviewer input 2: zero-own with an unknown source never prints the zero-state line', () => {
  const row = copy('zero-own'); row.report_json.content_system.hero.lead.source = 'ads';
  const {f, edition} = load(row);
  const {container} = render(<ScanStoryReport fixture={f} edition={edition}/>);
  expect(container.querySelector('.sv2-hero')).toBeTruthy();
  expect(container.textContent).not.toMatch(ZERO_LINE);
  expect(container.querySelector('.sp-audit')).toBeNull();
 });

 for (const name of Object.keys(ROWS)) for (const [kind, change] of Object.entries(REJECT)) {
  it(`${name}, hero ${kind}: no count, zero line, named buyer or date on the first screen`, () => {
   const row = copy(name), cs = row.report_json.content_system;
   change(cs);
   const {f, edition} = load(row);
   expect(f.hero).toBeUndefined();
   expect(useV2(f)).toBe(true);
   const {container} = render(<ScanStoryReport fixture={f} edition={edition}/>);
   const hero = container.querySelector('.sv2-hero')!;
   expect(hero).toBeTruthy();
   const text = hero.textContent || '';
   // The plain tier prints no number at all; the profile tier quotes the prospect's own headline, never a count.
   expect(text).not.toMatch(f.heroRejected!.profile ? STANDALONE_01 : /\d/);
   expect(text).not.toMatch(DATE);
   expect(container.textContent).not.toMatch(ZERO_LINE);
   for (const n of people(ROWS[name].report_json.content_system)) expect(text).not.toContain(n);
   expect(container.querySelector('.sv2-count, .sv2-sheet, .sp-audit, .audit-number')).toBeNull();
   // The lowest tier: the profile tier when the profile audit quotes the headline, else the page's own headline.
   const h1 = hero.querySelector('h1')!.textContent;
   if (f.heroRejected!.profile) expect(h1).toMatch(/^Your headline says “/);
   else expect(h1).toBe(BRAND_LINE);
   // The offer sits directly under the hero, except on the profile tier where the profile audit comes first.
   const order = [...container.querySelectorAll('[data-scan-section]')].map(e => e.getAttribute('data-scan-section'));
   expect(order[0]).toBe('hero');
   expect(order.slice(1, 3)).toContain('offer');
   expect(document.title).not.toMatch(/\d/);
  });
 }

 it('the plain tier for a scan with no profile audit headline: brand line as h1, offer link, no aside', () => {
  const row = copy('rich'), cs = row.report_json.content_system;
  cs.profile_audit.findings = cs.profile_audit.findings.filter((x: any) => x.area !== 'headline');
  cs.hero.v = 2;
  const {f, edition} = load(row);
  expect(f.heroRejected).toEqual({});
  const html = renderToStaticMarkup(<StoryBody fixture={f} edition={edition}/>);
  expect(html).toContain(`<h1>${BRAND_LINE}</h1>`);
  expect(html).toContain('data-tier="plain"');
  expect(html).toContain('href="#offer"');
  expect(html).not.toContain('sv2-brand-line');
  expect(html).not.toContain('sv2-sheet');
 });

 it('the partner page of a rejected hero shows no people block and no count', () => {
  const row = copy('rich'); row.report_json.content_system.hero.v = 2;
  const {f, edition} = load(row);
  const {container} = render(<ScanStoryReport fixture={f} edition={edition} view="team"/>);
  expect(container.querySelector('[data-scan-section="team"]')).toBeTruthy();
  expect(container.querySelector('#team-numbers, .sv2-team-line')).toBeNull();
 });
});

describe('R-REJECT: what stays today\'s layout', () => {
 const strip = (row: any) => { const r = JSON.parse(JSON.stringify(row)); delete r.report_json.content_system.hero; return r; };
 for (const name of Object.keys(ROWS)) {
  it(`${name}: hero absent or null with the switch on is today's layout, same markup`, () => {
   const absent = load(strip(ROWS[name]));
   const nul = copy(name); nul.report_json.content_system.hero = null;
   const n = load(nul);
   expect(n.f.heroRejected).toBeUndefined();
   expect(useV2(n.f)).toBe(false);
   vi.stubEnv('VITE_SCAN_HERO', '0');
   const today = renderToStaticMarkup(<StoryBody fixture={absent.f} edition={absent.edition}/>);
   vi.stubEnv('VITE_SCAN_HERO', '1');
   expect(renderToStaticMarkup(<StoryBody fixture={absent.f} edition={absent.edition}/>)).toBe(today);
   expect(renderToStaticMarkup(<StoryBody fixture={n.f} edition={n.edition}/>)).toBe(today);
   expect(today).toContain('sp-audit');
  });
  for (const value of [undefined, '0', 'true', ' 1']) {
   it(`${name}: switch ${JSON.stringify(value)} with a rejected hero is today's layout, same markup`, () => {
    const today = (() => { vi.stubEnv('VITE_SCAN_HERO', '0'); const a = load(strip(ROWS[name])); return renderToStaticMarkup(<StoryBody fixture={a.f} edition={a.edition}/>); })();
    if (value === undefined) vi.unstubAllEnvs(); else vi.stubEnv('VITE_SCAN_HERO', value);
    for (const change of Object.values(REJECT)) {
     const row = copy(name); change(row.report_json.content_system);
     const {f, edition} = load(row);
     expect(useV2(f)).toBe(false);
     expect(renderToStaticMarkup(<StoryBody fixture={f} edition={edition}/>)).toBe(today);
    }
   });
  }
 }
});
