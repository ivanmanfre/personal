// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest';
import {render, cleanup, screen} from '@testing-library/react';
import './__fixtures__/dom';
import ScanStoryReport from '../ScanStoryReport';
import {toStoryFixture} from '../adapter';
import {validateEdition} from '../validate';
import {OFFER, START_NOTE, TEAM} from './copy';
import rich from '../../../dev/scanlab/v2-rich.json';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
// The new layout is on only when the build switch is exactly '1'.
beforeEach(() => { vi.stubEnv('VITE_SCAN_HERO', '1'); });

const withPartner = (story: string | null) => ({...rich, report_json: {...rich.report_json, content_system: {...rich.report_json.content_system, partner: {story}}}});
const team = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return render(<ScanStoryReport fixture={f} edition={edition!} view="team"/>); };

describe('PartnerView', () => {
 it('reads cold', () => {
  const {container} = team(rich);
  expect(screen.getByText(TEAM.intro('Marta Quillfeather'))).toBeTruthy();
  expect(screen.getByText(TEAM.eyebrow('Lanternfold'))).toBeTruthy();
  expect(container.textContent).not.toMatch(/Made for/);
  expect(container.querySelector('.sp-nav')).toBeNull();
  expect(container.querySelector('[data-scan-section="team"]')).toBeTruthy();
 });
 it('shows three buyer rows and the price', () => {
  const {container} = team(rich);
  expect(container.querySelectorAll('.sv2-team-rows > li')).toHaveLength(3);
  expect(screen.getByText(OFFER.price)).toBeTruthy();
  expect(screen.getByText(/326 people checked\. 15 passed\./)).toBeTruthy();
  expect(screen.getByText(/From public likes and comments on LinkedIn/)).toBeTruthy();
 });
 it('how we start has three steps and no day count', () => {
  const {container} = team(rich);
  const start = container.querySelector('.sv2-team-start')!;
  expect(start.querySelectorAll('ol > li')).toHaveLength(3);
  const text = start.textContent!.replace(START_NOTE, '');
  expect(text).not.toMatch(/\b\d+\s*(day|week)s?\b/);
 });
 it('one story: the named one when set, else the first, with a link to the others', () => {
  const a = team(withPartner('mattan'));
  expect(a.container.querySelectorAll('.sv2-story')).toHaveLength(1);
  expect(a.container.querySelector('.sv2-story b')!.textContent).toBe('Mattan Danino');
  expect(a.container.querySelector('.studio-results')).toBeNull();
  cleanup();
  const b = team(withPartner(null));
  expect(b.container.querySelectorAll('.sv2-story')).toHaveLength(1);
  expect(b.container.querySelector('.sv2-story b')!.textContent).toBe('Kyle Hunt');
  expect(b.container.querySelector('.studio-results')).toBeNull();
  expect(screen.getByText(TEAM.moreStories).closest('a')!.getAttribute('href')).toBe('/scan/marta-quillfeather-fx1/#stories');
 });
 it('booking link carries utm_content=team', () => {
  const {container} = team(rich);
  const a = container.querySelector('a[data-scan-click="book-team"]')!;
  expect(a.getAttribute('href')).toContain('utm_content=team');
  expect(screen.getByText(TEAM.back).closest('a')!.getAttribute('href')).toBe('/scan/marta-quillfeather-fx1/');
 });
 it('sets the short-version title', () => { team(rich); expect(document.title).toBe('Lanternfold: the short version'); expect(/: the short version$/.test(document.title)).toBe(true); });
 it('falls back to the main page without a hero', () => {
  const row = {...rich, report_json: {...rich.report_json, content_system: {...rich.report_json.content_system, hero: undefined}}};
  const {container} = team(row);
  expect(container.querySelector('.sp-audit')).toBeTruthy();
  expect(container.querySelector('[data-scan-section="team"]')).toBeNull();
 });
 it('falls back to the main page with the switch off', () => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const {container} = team(rich);
  expect(container.querySelector('[data-scan-section="team"]')).toBeNull();
 });
});
