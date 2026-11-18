// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup, fireEvent} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import './__fixtures__/dom';
import ScanStoryReport, {StoryBody, useV2} from '../ScanStoryReport';
import {toStoryFixture, parseHero} from '../adapter';
import {validateEdition} from '../validate';
import {heroSentence, bookUrl, teamUrl} from './hero';
import {SHOW} from './BuyersSection';
import rich from '../../../dev/scanlab/v2-rich.json';

/** The round 1 reviewer's cases (2026-11-18), ported to assert the corrected behaviour. Invented fixtures only. */
const copy = () => JSON.parse(JSON.stringify(rich));
const load = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return {f, edition: edition!}; };
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('round 1 reviewer cases', () => {
 it('1. an unset VITE_SCAN_HERO keeps today\'s layout', () => {
  vi.unstubAllEnvs();
  expect(import.meta.env.VITE_SCAN_HERO).toBeUndefined();
  expect(useV2(toStoryFixture(copy()))).toBe(false);
  vi.stubEnv('VITE_SCAN_HERO', '1');
  expect(useV2(toStoryFixture(copy()))).toBe(true);
 });

 it('2. a malformed optional audience role renders the new layout instead of throwing', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  for (const role of [42, {text: 'CMO'}, null, ['a']]) {
   const row = copy(); row.report_json.content_system.audience.named[0].role = role;
   const {f, edition} = load(row);
   const html = renderToStaticMarkup(<StoryBody fixture={f} edition={edition}/>);
   expect(html).toContain('sv2-hero');
   expect(html).toContain('Buyers already engaging with you');
  }
 });

 it('2b. any throw inside the new layout gives today\'s layout, title and top bar included', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const {f, edition} = load(copy());
  (f.hero as any).count = null; // past the adapter: only a code bug could do this
  const {container} = render(<ScanStoryReport fixture={f} edition={edition}/>);
  expect(container.querySelector('.sv2-hero')).toBeNull();
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('.studio-topbar-cta')!.getAttribute('href')).toBe('https://calendly.com/im-ivanmanfredi/30min');
  expect(document.title).toBe(`Turn LinkedIn into booked calls | ${f.founder.firstName}`);
 });

 it('3. a hero lead with no signal, or an unknown signal or source, is no hero', () => {
  for (const change of [(l: any) => { delete l.how; }, (l: any) => { l.how = 'shared'; }, (l: any) => { delete l.source; }, (l: any) => { l.source = 'ads'; }]) {
   const h = copy().report_json.content_system.hero; change(h.lead);
   expect(parseHero(h)).toBeUndefined();
  }
  const h = copy().report_json.content_system.hero; delete h.rows[1].how;
  expect(parseHero(h)).toBeUndefined();
 });

 it('4. an impossible calendar date prints the sentence without a date', () => {
  for (const date of ['2026-02-31', '2026-13-01', '2026-11-00', '2025-02-29']) {
   const h = copy().report_json.content_system.hero; h.lead.date = date;
   const p = parseHero(h)!;
   expect(p).toBeDefined();
   expect(p.lead!.date).toBeUndefined();
   const s = heroSentence(p.lead!);
   expect(s).not.toMatch(/\d+ (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
   expect(s).toMatch(/commented on a post by .+\.$/);
  }
  const ok = copy().report_json.content_system.hero; ok.lead.date = '2024-02-29';
  expect(parseHero(ok)!.lead!.date).toBe('2024-02-29');
 });

 it('5. with JavaScript off the four folded steps carry their samples in the HTML', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const {f, edition} = load(copy());
  const html = renderToStaticMarkup(<StoryBody fixture={f} edition={edition}/>);
  const folds = html.match(/<details class="sv2-fold-details">/g) || [];
  expect(folds).toHaveLength(4);
  for (const id of ['content', 'resource', 'conversations', 'calls']) {
   const start = html.indexOf(`id="${id}-samples"`), end = html.indexOf('</details>', start);
   expect(start).toBeGreaterThan(0);
   expect(html.slice(start, end).replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(20);
  }
  expect(html).not.toMatch(/class="sv2-fold-body"[^>]*hidden/);
 });

 it('6. "Show more" is a native disclosure: every buyer in the HTML, toggles both ways, stays in place', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const {f, edition} = load(copy());
  const total = f.competitorEngagers!.people.length;
  // Round 2 finding 3: with scripts off (and for crawlers) every outside buyer is in the server markup.
  const html = renderToStaticMarkup(<StoryBody fixture={f} edition={edition}/>);
  for (const p of f.competitorEngagers!.uniquePeople!) expect(html).toContain(`href="${p.profileUrl}"`);
  expect(html).toMatch(/<details class="sv2-more-details"><summary class="sv2-show"/);
  const {container} = render(<ScanStoryReport fixture={f} edition={edition}/>);
  const details = container.querySelector<HTMLDetailsElement>('details.sv2-more-details')!;
  const summary = details.querySelector('summary')!;
  const shown = () => container.querySelectorAll('[data-part="outside"] .sv2-list > li').length - (details.open ? 0 : details.querySelectorAll('li').length);
  expect(details.open).toBe(false);
  expect(document.getElementById(summary.getAttribute('aria-controls')!)!.closest('details')).toBe(details);
  expect(shown()).toBe(5);
  expect(container.querySelectorAll('[data-part="outside"] .sv2-list > li')).toHaveLength(total);
  expect(summary.querySelector('.sv2-show-closed')!.textContent).toBe(SHOW.more(total - 5));
  expect(summary.querySelector('.sv2-show-open')!.textContent).toBe(SHOW.fewer);
  summary.focus();
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  expect(shown()).toBe(total);
  expect(summary.isConnected).toBe(true);
  expect(document.activeElement).toBe(summary);
  fireEvent.click(summary);
  expect(details.open).toBe(false);
  expect(shown()).toBe(5);
 });

 it('7. markup in names stays text and only LinkedIn links survive', () => {
  const h = copy().report_json.content_system.hero;
  h.lead.name = '<script>alert(1)</script>'; h.lead.profile_url = 'javascript:alert(1)'; h.lead.post_url = 'https://linkedin.com.evil.example/posts/x';
  const p = parseHero(h)!;
  expect(p.lead!.profileUrl).toBeUndefined();
  expect(p.lead!.postUrl).toBeUndefined();
  expect(bookUrl('x&evil=1', '#')).toContain('utm_campaign=x%26evil%3D1');
  expect(teamUrl('//evil.test')).toBe('/scan/%2F%2Fevil.test/team/');
 });
});
