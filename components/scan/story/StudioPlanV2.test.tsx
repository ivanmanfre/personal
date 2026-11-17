// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup, fireEvent, screen} from '@testing-library/react';
import './v2/__fixtures__/dom';
import ScanStoryReport from './ScanStoryReport';
import {toStoryFixture} from './adapter';
import {validateEdition} from './validate';
import fabio from '../../dev/scanlab/v2-fabio.json';
import willie from '../../dev/scanlab/v2-willie.json';
import shawn from '../../dev/scanlab/v2-shawn.json';
import lars from '../../dev/scanlab/v2-lars.json';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

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
  const {container} = page(fabio);
  expect(sections(container).slice(0, 3)).toEqual(['hero', 'buyers', 'offer']);
  expect(sections(container)).toEqual(['hero', 'buyers', 'offer', 'profile', 'diagnosis', 'content', 'resource', 'conversations', 'calls', 'stories', 'close']);
 });
 it('considered shape order', () => {
  const {container} = page(willie);
  expect(sections(container).slice(0, 2)).toEqual(['hero', 'offer']);
  expect(container.querySelector('a[href="/scan/willie-chiu-b8/team/"]')).toBeTruthy();
 });
 it('considered shape shows one people story when partnerStory is set', () => {
  const row = {...willie, report_json: {...willie.report_json, content_system: {...willie.report_json.content_system, partner: {story: 'kyle'}}}};
  const {container} = page(row);
  expect(sections(container).slice(0, 4)).toEqual(['hero', 'offer', 'stories', 'buyers']);
 });
 it('profile tier puts the profile audit second', () => {
  const {container} = page(shawn);
  expect(sections(container)[1]).toBe('profile');
 });
 it('no reach projection anywhere', () => { page(fabio); expect(screen.queryByText(/named leads a month/)).toBeNull(); });
 it('the four chapters are folded', () => {
  const {container} = page(fabio);
  expect(container.querySelector('.sp-exhibit')).toBeNull();
  fireEvent.click(container.querySelector('#content .sv2-fold-toggle')!);
  expect(container.querySelector('#content .sp-exhibit')).toBeTruthy();
 });
 it('three booking placements', () => {
  const {container} = page(fabio);
  const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href') || '');
  for (const p of ['header', 'after-buyers', 'close']) expect(hrefs.filter(h => h.includes(`utm_content=${p}`))).toHaveLength(1);
  for (const p of ['header', 'after-buyers', 'close']) expect(container.querySelector(`a[data-scan-click="book-${p}"]`)).toBeTruthy();
 });
 it('fast shape offers the short version under the close', () => {
  const {container} = page(fabio);
  expect(container.querySelector('[data-scan-section="close"] a[href="/scan/fabio-soprano-c2/team/"]')).toBeTruthy();
 });
 it('own-engager hero leads with own buyers', () => {
  const {container} = page(lars);
  expect(sections(container).slice(0, 2)).toEqual(['hero', 'offer']);
  expect(container.querySelector('[data-part="own"]')).toBeTruthy();
 });
 it('ScanStoryReport renders the old plan without a hero', () => {
  const {container} = page(fabio, true);
  const h1 = container.querySelector('h1')!;
  expect(h1.querySelectorAll(':scope > span')).toHaveLength(3);
  expect(h1.textContent).toBe('Make your LinkedIninto a truerevenue line.');
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('.sv2-hero')).toBeNull();
 });
 it('the build flag wins', () => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const {container} = page(fabio);
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('.sv2-hero')).toBeNull();
 });
 it('the title names the first name and the count line', () => {
  page(fabio);
  expect(document.title).toBe('Fabio, 25 buyers within reach: 10 engage with your posts, 15 engaged with The Influencer Marketing Factory, Acceleration Partners and The Goat Agency in the last two weeks');
  expect(/^[^,]{1,40}, \d+ (buyers within reach|more buyers)/.test(document.title)).toBe(true);
 });
 it('a hero with no count line falls back to the plan title', () => { page(willie); expect(document.title).toBe('Willie, your LinkedIn plan for qualified calls'); });
});
