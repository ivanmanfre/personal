// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import './__fixtures__/dom';
import ScanStoryReport from '../ScanStoryReport';
import {toStoryFixture} from '../adapter';
import {validateEdition} from '../validate';
import {profileLink} from '../profileLink';
import rich from '../../../dev/scanlab/v2-rich.json';

/** The round 4 reviewer's input (2026-11-18): an outside buyer whose link the new check accepts or rejects must stay
 *  on the new layout, shown by name, with a link only when the link passes. Invented people and hosts only. */
const copy = () => JSON.parse(JSON.stringify(rich));
const load = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return {fixture: f, edition: edition!}; };
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const SOLE = (url: unknown) => { const r = copy(), ce = r.report_json.content_system.competitor_engagers; ce.people = [{...ce.people[0], profile_url: url}]; return r; };
const CASES: [string, unknown, boolean][] = [
 ['country subdomain', 'https://uk.linkedin.com/in/fixture-valid', true],
 ['mixed-case scheme', 'HTTPS://www.linkedin.com/in/fixture-valid', true],
 ['missing', undefined, false],
 ['empty', '', false],
 ['another host', 'https://example.org/in/fixture-valid', false],
 ['traversal', 'https://www.linkedin.com/in/../redir/redirect?url=https%3A%2F%2Fattacker.example', false],
];

describe('round 4 finding: the sole outside buyer is never lost to the old layout\'s link filter', () => {
 it.each(CASES)('%s: the outside section shows the name, linked only when the link passes', (_label, url, linked) => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = SOLE(url), name = r.report_json.content_system.competitor_engagers.people[0].name;
  const props = load(r);
  expect(props.fixture.outsideBuyers?.people.map(p => p.name)).toEqual([name]);
  const d = dom(renderToStaticMarkup(<ScanStoryReport {...props}/>));
  const part = d.querySelector('[data-part="outside"]');
  expect(part, 'outside section').not.toBeNull();
  expect(part!.textContent).toContain(name);
  const a = part!.querySelector<HTMLAnchorElement>('a.sv2-name');
  if (linked) { expect(a?.getAttribute('href')).toBe(profileLink(url)!.url); expect(a?.getAttribute('href')).toMatch(/^https:\/\/(uk|www)\.linkedin\.com\/in\/fixture-valid\/$/); }
  else { expect(a).toBeNull(); expect(part!.querySelector('b.sv2-name')?.textContent).toBe(name); }
  expect(d.innerHTML).not.toMatch(/redir|attacker|example\.org/);
 });

 it.each(CASES)('%s: with the switch off the page is what the old filter gives (no new list read)', (_label, url) => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const r = SOLE(url), props = load(r);
  const html = renderToStaticMarkup(<ScanStoryReport {...props}/>);
  expect(html).not.toContain('data-part="outside"');
  const old = props.fixture.competitorEngagers;
  if (old) expect(old.people.length).toBe(1); else expect(html).not.toContain('sp-rivals-wrap');
 });

 it('a buyer with no valid post link still drops (the signal line needs the post)', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = copy(), ce = r.report_json.content_system.competitor_engagers;
  ce.people = [{...ce.people[0], post_url: 'https://example.org/posts/1'}];
  expect(load(r).fixture.outsideBuyers).toBeUndefined();
 });
});

describe('round 4 note: leaving print media restores the disclosures when afterprint never comes', () => {
 it('beforeprint, then print media ends without afterprint', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const listeners: ((e: {matches: boolean}) => void)[] = [];
  const orig = window.matchMedia;
  window.matchMedia = ((q: string) => ({matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener: (_t: string, cb: any) => { if (q === 'print') listeners.push(cb); }, removeEventListener() {}, dispatchEvent: () => false})) as unknown as typeof window.matchMedia;
  try {
   const {container} = render(<ScanStoryReport {...load(copy())}/>);
   const ds = [...container.querySelectorAll('details')], states = () => ds.map(d => d.open);
   expect(ds.length).toBeGreaterThan(1);
   const before = states();
   window.dispatchEvent(new Event('beforeprint'));
   expect(states().every(Boolean)).toBe(true);
   expect(listeners.length).toBeGreaterThan(0);
   listeners.forEach(cb => cb({matches: true}));
   expect(states().every(Boolean)).toBe(true);
   listeners.forEach(cb => cb({matches: false}));
   expect(states()).toEqual(before);
   window.dispatchEvent(new Event('afterprint'));
   expect(states()).toEqual(before);
  } finally { window.matchMedia = orig; }
 });
});
