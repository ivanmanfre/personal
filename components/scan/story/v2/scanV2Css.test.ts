import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// jsdom has no layout, so the phone clip in the close section is pinned here by its rules.
// The cause: the phone rule in scan-studio.css gives .sp-close a `1fr` track (minimum = widest unbreakable child) and
// .scan-studio clips overflow, so one long line widened the column past the screen and was cut off.
const css = readFileSync(join(__dirname, 'scan-v2.css'), 'utf8');

describe('scan-v2.css, close section on phones', () => {
 it('sizes the close track from zero on the V2 page', () => {
  expect(css).toMatch(/@media\(max-width:900px\)\{\.scan-studio\.scan-journey \.story-plan-v2 \.sp-close\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  expect(css).toMatch(/\.story-plan-v2 \.sp-close>div\{min-width:0\}/);
 });
 it('never sizes the share link to its one-line width', () => {
  const rules = css.match(/\.sv2-close-share\{[^}]*\}/g) || [];
  expect(rules.length).toBeGreaterThan(0);
  for (const r of rules) expect(r).not.toMatch(/max-content|nowrap/);
 });
 it('every V2 grid track can shrink to zero', () => {
  const tracks = css.match(/grid-template-columns:[^;}]+/g) || [];
  for (const t of tracks) expect(t.replace(/minmax\(0,[^)]+\)/g, '')).not.toMatch(/\b\d*\.?\d+fr\b/);
 });
});
