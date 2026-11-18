// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest';
import {render, cleanup, fireEvent, screen} from '@testing-library/react';
import './v2/__fixtures__/dom';
import ScanStoryReport from './ScanStoryReport';
import {toStoryFixture} from './adapter';
import {validateEdition} from './validate';
import rich from '../../dev/scanlab/v2-rich.json';
import {CLOSE, OFFER, OFFER_SHORT} from './v2/copy';
import fewBuyers from '../../dev/scanlab/v2-few-buyers.json';
import thin from '../../dev/scanlab/v2-thin.json';
import ownOnly from '../../dev/scanlab/v2-own-only.json';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
// The new layout is on only when the build switch is exactly '1'.
beforeEach(() => { vi.stubEnv('VITE_SCAN_HERO', '1'); });

const load = (row: any, strip = false) => {
 const r = strip ? {...row, report_json: {...row.report_json, content_system: {...row.report_json.content_system, hero: undefined}}} : row;
 const fixture = toStoryFixture(r), {edition, errors} = validateEdition(r.report_json.content_system.story_v1, fixture, true);
 if (!edition) throw new Error(errors.join('; '));
 return {fixture, edition};
};
const page = (row: any, strip = false) => { const {fixture, edition} = load(row, strip); return render(<ScanStoryReport fixture={fixture} edition={edition}/>); };
const sections = (c: HTMLElement) => [...c.querySelectorAll('[data-scan-section]')].map(e => e.getAttribute('data-scan-section'));

describe('StudioPlanV2', () => {
 it('fast shape order', () => {
  const {container} = page(rich);
  expect(sections(container).slice(0, 3)).toEqual(['hero', 'offer', 'buyers']);
  expect(sections(container)).toEqual(['hero', 'offer', 'buyers', 'profile', 'diagnosis', 'content', 'resource', 'conversations', 'calls', 'stories', 'close']);
 });
 it('fast shape gets the compact offer, considered the full one', () => {
  const a = page(rich);
  expect(a.container.querySelector('[data-scan-section="offer"]')!.classList.contains('is-compact')).toBe(true);
  expect(screen.getByText(OFFER_SHORT.start.text)).toBeTruthy();
  expect(screen.getByText(OFFER.price)).toBeTruthy();
  cleanup();
  const b = page(fewBuyers);
  expect(b.container.querySelector('[data-scan-section="offer"]')!.classList.contains('is-compact')).toBe(false);
  expect(screen.getByText(OFFER.start.text)).toBeTruthy();
 });
 it('fast shape on the profile tier keeps the offer right under the hero', () => {
  const small = {...thin, report_json: {...thin.report_json, content_system: {...thin.report_json.content_system, firm: {staff: 4, band: 'small'}}}};
  const {container} = page(small);
  expect(sections(container).slice(0, 3)).toEqual(['hero', 'offer', 'profile']);
 });
 it('the close prints the approved line, never the saved rationale note', () => {
  const close = rich.report_json.content_system.story_v1.rationale.close;
  expect(close).toBeTruthy();
  const {container} = page(rich);
  const sec = container.querySelector('[data-scan-section="close"]')!;
  expect(sec.querySelector('p')!.textContent).toBe(CLOSE.body);
  expect(container.textContent).not.toContain(close);
 });
 it('the old layout still prints the saved rationale in its close', () => {
  const {container} = page(rich, true);
  expect(container.textContent).toContain(rich.report_json.content_system.story_v1.rationale.close);
 });
 it('the stories section is a link target for the partner page', () => {
  const {container} = page(rich);
  expect(container.querySelector('#stories[data-scan-section="stories"]')).toBeTruthy();
 });
 it('considered shape order', () => {
  const {container} = page(fewBuyers);
  expect(sections(container).slice(0, 2)).toEqual(['hero', 'offer']);
  expect(container.querySelector('a[href="/scan/wren-castellane-fx6/team/"]')).toBeTruthy();
 });
 it('considered shape shows one people story when partnerStory is set', () => {
  const row = {...fewBuyers, report_json: {...fewBuyers.report_json, content_system: {...fewBuyers.report_json.content_system, partner: {story: 'kyle'}}}};
  const {container} = page(row);
  expect(sections(container).slice(0, 4)).toEqual(['hero', 'offer', 'stories', 'buyers']);
 });
 it('profile tier puts the profile audit second', () => {
  const {container} = page(thin);
  expect(sections(container)[1]).toBe('profile');
 });
 it('no reach projection anywhere', () => { page(rich); expect(screen.queryByText(/named leads a month/)).toBeNull(); });
 it('the four chapters are folded natively, with their samples already in the HTML', () => {
  const {container} = page(rich);
  const folds = [...container.querySelectorAll<HTMLDetailsElement>('details.sv2-fold-details')];
  expect(folds).toHaveLength(4);
  expect(folds.every(d => !d.open)).toBe(true);
  // Round 1 finding 4: every sample is in the markup while folded, so the prerender and assistive tech have it.
  expect(container.querySelector('#content details .sp-exhibit')).toBeTruthy();
  fireEvent.click(container.querySelector('#content summary')!);
  expect(folds[0].open).toBe(true);
 });
 it('three booking placements', () => {
  const {container} = page(rich);
  const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href') || '');
  for (const p of ['header', 'after-buyers', 'close']) expect(hrefs.filter(h => h.includes(`utm_content=${p}`))).toHaveLength(1);
  for (const p of ['header', 'after-buyers', 'close']) expect(container.querySelector(`a[data-scan-click="book-${p}"]`)).toBeTruthy();
 });
 it('fast shape offers the short version under the close', () => {
  const {container} = page(rich);
  expect(container.querySelector('[data-scan-section="close"] a[href="/scan/marta-quillfeather-fx1/team/"]')).toBeTruthy();
 });
 it('own-engager hero leads with own buyers', () => {
  const {container} = page(ownOnly);
  expect(sections(container).slice(0, 2)).toEqual(['hero', 'offer']);
  expect(container.querySelector('[data-part="own"]')).toBeTruthy();
 });
 it('ScanStoryReport renders the old plan without a hero', () => {
  const {container} = page(rich, true);
  const h1 = container.querySelector('h1')!;
  expect(h1.querySelectorAll(':scope > span')).toHaveLength(3);
  expect(h1.textContent).toBe('Make your LinkedIninto a truerevenue line.');
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('.sv2-hero')).toBeNull();
 });
 // Round 1 finding 1: an unset switch turned the new layout on. Only exactly '1' does.
 it.each([[undefined, false], ['0', false], ['1', true], ['true', false], [' 1', false], ['1 ', false], ['01', false], ['on', false], ['', false]])('switch %j gives the new layout: %s', (value, on) => {
  vi.unstubAllEnvs();
  if (value !== undefined) vi.stubEnv('VITE_SCAN_HERO', value);
  expect(import.meta.env.VITE_SCAN_HERO).toBe(value);
  const {container} = page(rich);
  expect(!!container.querySelector('.sv2-hero')).toBe(on);
  expect(!!container.querySelector('.sp-audit')).toBe(!on);
 });
 it('the title names the first name and the count line', () => {
  page(rich);
  expect(document.title).toBe('Marta, 25 buyers within reach: 10 engage with your posts, 15 engaged with Tansyworth Media, Tansymoor Finance and Wicketcroft Apps in the last two weeks');
  expect(/^[^,]{1,40}, \d+ (buyers within reach|more buyers)/.test(document.title)).toBe(true);
 });
 it('a hero with no count line falls back to the plan title', () => { page(fewBuyers); expect(document.title).toBe('Wren, your LinkedIn plan for qualified calls'); });
});
