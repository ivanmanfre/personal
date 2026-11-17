// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import './__fixtures__/dom';
import {FoldedChapter} from './FoldedChapter';
import {FOLD} from './copy';
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

const make = (children = vi.fn(() => <p className="sp-exhibit">Sample post</p>)) => ({children, el: <FoldedChapter id="content" n={1} label="Content" title="Posts that sound like you." why="One sentence on why." preview={<span>Slide one</span>}>{children}</FoldedChapter>});

describe('FoldedChapter', () => {
 it('closed by default and the samples are not in the DOM', () => {
  const {children, el} = make();
  const {container} = render(el);
  expect(container.querySelector('.sp-exhibit')).toBeNull();
  expect(children).not.toHaveBeenCalled();
  expect(screen.getByText('Posts that sound like you.')).toBeTruthy();
  expect(screen.getByText('Slide one')).toBeTruthy();
  expect(container.querySelector('section')!.getAttribute('data-scan-section')).toBe('content');
 });
 it('opens on click, sets aria-expanded and mounts children once', () => {
  const {children, el} = make();
  const seen: unknown[] = [];
  const onFold = (e: Event) => seen.push((e as CustomEvent).detail);
  window.addEventListener('scan:fold', onFold);
  const {container} = render(el);
  const button = screen.getByRole('button', {name: new RegExp(FOLD.open)});
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeTruthy();
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('.sp-exhibit')).toBeTruthy();
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(button);
  expect(children).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([{id: 'content', open: true}, {id: 'content', open: true}]);
  window.removeEventListener('scan:fold', onFold);
 });
 it('a matching hash opens it on load', () => {
  window.history.replaceState(null, '', '/#content');
  const {children, el} = make();
  const {container} = render(el);
  expect(container.querySelector('.sp-exhibit')).toBeTruthy();
  expect(children).toHaveBeenCalledTimes(1);
 });
 it('a hash for another chapter leaves it closed', () => {
  window.history.replaceState(null, '', '/#calls');
  const {el} = make();
  const {container} = render(el);
  expect(container.querySelector('.sp-exhibit')).toBeNull();
 });
});
