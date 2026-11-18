import {describe, it, expect} from 'vitest';
import {scanHeroOn} from '../../../../scripts/scan-hero-switch.mjs';
import {readFileSync} from 'node:fs';

// Round 1 finding 1: the app and the prerender read the same helper, and only exactly '1' is on.
describe('scanHeroOn', () => {
 it.each([[undefined, false], [null, false], ['0', false], ['1', true], ['true', false], [' 1', false], ['01', false], ['on', false], ['', false], [1, false]])('%j -> %s', (value, on) => {
  expect(scanHeroOn(value)).toBe(on);
 });
 it('the prerender gates the partner routes on it', () => {
  const src = readFileSync(new URL('../../../../scripts/prerender.mjs', import.meta.url), 'utf8');
  expect(src).toContain("import { scanHeroOn, teamSlugs } from './scan-hero-switch.mjs';");
  expect(src).toMatch(/!scanHeroOn\(process\.env\.VITE_SCAN_HERO\)/);
  expect(src).toContain('return teamSlugs(await res.json(), process.env.VITE_SCAN_HERO);');
  expect(src).not.toMatch(/VITE_SCAN_HERO\s*[!=]==/);
 });
 it('the app gates the layout on it', () => {
  const src = readFileSync(new URL('../ScanStoryReport.tsx', import.meta.url), 'utf8');
  expect(src).toMatch(/hasScanV2\(import\.meta\.env\.VITE_SCAN_HERO,/);
  expect(src).not.toMatch(/VITE_SCAN_HERO\s*[!=]==/);
 });
});
