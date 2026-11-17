// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup, screen} from '@testing-library/react';
import './__fixtures__/dom';
import ScanStoryReport from '../ScanStoryReport';
import {toStoryFixture} from '../adapter';
import {validateEdition} from '../validate';
import {OFFER, START_NOTE, TEAM} from './copy';
import fabio from '../../../dev/scanlab/v2-fabio.json';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const withPartner = (story: string | null) => ({...fabio, report_json: {...fabio.report_json, content_system: {...fabio.report_json.content_system, partner: {story}}}});
const team = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return render(<ScanStoryReport fixture={f} edition={edition!} view="team"/>); };

describe('PartnerView', () => {
 it('reads cold', () => {
  const {container} = team(fabio);
  expect(screen.getByText(TEAM.intro('Fabio Soprano'))).toBeTruthy();
  expect(screen.getByText(TEAM.eyebrow('Enclaverse'))).toBeTruthy();
  expect(container.textContent).not.toMatch(/Made for/);
  expect(container.querySelector('.sp-nav')).toBeNull();
  expect(container.querySelector('[data-scan-section="team"]')).toBeTruthy();
 });
 it('shows three buyer rows and the price', () => {
  const {container} = team(fabio);
  expect(container.querySelectorAll('.sv2-team-rows > li')).toHaveLength(3);
  expect(screen.getByText(OFFER.price)).toBeTruthy();
  expect(screen.getByText(/326 people checked\. 15 passed\./)).toBeTruthy();
  expect(screen.getByText(/From public likes and comments on LinkedIn/)).toBeTruthy();
 });
 it('how we start has three steps and no day count', () => {
  const {container} = team(fabio);
  const start = container.querySelector('.sv2-team-start')!;
  expect(start.querySelectorAll('ol > li')).toHaveLength(3);
  const text = start.textContent!.replace(START_NOTE, '');
  expect(text).not.toMatch(/\b\d+\s*(day|week)s?\b/);
 });
 it('one story when partnerStory is set, three when it is not', () => {
  const a = team(withPartner('kyle'));
  expect(a.container.querySelectorAll('.sv2-story')).toHaveLength(1);
  expect(a.container.querySelector('.studio-results')).toBeNull();
  cleanup();
  const b = team(withPartner(null));
  expect(b.container.querySelector('.studio-results')).toBeTruthy();
  expect(b.container.querySelectorAll('.sv2-story')).toHaveLength(0);
 });
 it('booking link carries utm_content=team', () => {
  const {container} = team(fabio);
  const a = container.querySelector('a[data-scan-click="book-team"]')!;
  expect(a.getAttribute('href')).toContain('utm_content=team');
  expect(screen.getByText(TEAM.back).closest('a')!.getAttribute('href')).toBe('/scan/fabio-soprano-c2/');
 });
 it('sets the short-version title', () => { team(fabio); expect(document.title).toBe('Enclaverse: the short version'); expect(/: the short version$/.test(document.title)).toBe(true); });
 it('falls back to the main page without a hero', () => {
  const row = {...fabio, report_json: {...fabio.report_json, content_system: {...fabio.report_json.content_system, hero: undefined}}};
  const {container} = team(row);
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('[data-scan-section="team"]')).toBeNull();
 });
 it('falls back to the main page with the switch off', () => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const {container} = team(fabio);
  expect(container.querySelector('[data-scan-section="team"]')).toBeNull();
 });
});
