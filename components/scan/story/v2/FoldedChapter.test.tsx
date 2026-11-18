// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup, fireEvent} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import './__fixtures__/dom';
import {FoldedChapter} from './FoldedChapter';
import {FOLD} from './copy';
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

const make = (children = vi.fn(() => <p className="sp-exhibit">Sample post</p>)) => ({children, el: <FoldedChapter id="content" n={1} label="Content" title="Posts that sound like you." why="One sentence on why." preview={<span>Slide one</span>}>{children}</FoldedChapter>});
const parts = (c: HTMLElement) => ({details: c.querySelector('details')!, summary: c.querySelector('summary')!});

describe('FoldedChapter', () => {
 it('closed by default, a native details element, with the samples in the markup', () => {
  const {el} = make();
  const {container} = render(el);
  const {details, summary} = parts(container);
  expect(details.open).toBe(false);
  expect(summary.parentElement).toBe(details);
  expect(details.firstElementChild).toBe(summary);
  expect(container.querySelector('details .sp-exhibit')).toBeTruthy();
  expect(summary.querySelector('h2')!.textContent).toBe('Posts that sound like you.');
  expect(summary.textContent).toContain('Slide one');
  expect(container.querySelector('section')!.getAttribute('data-scan-section')).toBe('content');
  expect(document.getElementById(summary.getAttribute('aria-controls')!)).toBeTruthy();
 });
 // Round 1 finding 4: with JavaScript off the baked HTML must hold the samples and open on its own.
 it('server markup holds the samples inside a closed details, no hidden attribute, no script needed', () => {
  const {el} = make();
  const html = renderToStaticMarkup(el);
  expect(html).toMatch(/^<section[^>]*><details class="sv2-fold-details"><summary class="sv2-fold-card"/);
  expect(html).toContain('<p class="sp-exhibit">Sample post</p>');
  expect(html).not.toMatch(/\shidden(=|\s|>)/);
  expect(html).toContain(FOLD.open);
  expect(html).toContain(FOLD.close);
 });
 it('the summary opens and closes it, and reports one fold event per user open', () => {
  const {el, children} = make();
  const seen: unknown[] = [];
  const onFold = (e: Event) => seen.push((e as CustomEvent).detail);
  window.addEventListener('scan:fold', onFold);
  const {container} = render(el);
  const {details, summary} = parts(container);
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  fireEvent.click(summary);
  expect(details.open).toBe(false);
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  expect(seen).toEqual([{id: 'content', open: true}, {id: 'content', open: true}]);
  expect(container.querySelectorAll('.sp-exhibit')).toHaveLength(1);
  expect(children).toHaveBeenCalled();
  window.removeEventListener('scan:fold', onFold);
 });
 it('a matching hash opens it on load', () => {
  window.history.replaceState(null, '', '/#content');
  const {el} = make();
  const {container} = render(el);
  expect(parts(container).details.open).toBe(true);
 });
 it('a hash for another chapter leaves it closed', () => {
  window.history.replaceState(null, '', '/#calls');
  const {el} = make();
  const {container} = render(el);
  expect(parts(container).details.open).toBe(false);
 });
});
