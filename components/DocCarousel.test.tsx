// components/DocCarousel.test.tsx
// A carousel publishes as a LinkedIn DOCUMENT post: a multi-page PDF the reader swipes one
// page at a time. The board preview has to behave the same way, so these assert the contract
// the client relies on when reviewing a deck.
//
// Static assertions only (renderToStaticMarkup, the convention in this repo — there is no
// jsdom dependency). Covered: every page mounted, one visible, page-1 start, 4:5 frame,
// "n / total" counter, pager affordances present/clamped at page 1, keyboard reachability.
// NOT covered here: the click/arrow paging transitions, which need a live DOM.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocCarousel } from './ClientBoardPage';

const SLIDES = Array.from({ length: 6 }, (_, i) => `https://example.test/slide-${i + 1}.png`);
const html = renderToStaticMarkup(
  <DocCarousel slides={SLIDES} title="Case study deck" accent="#ffc71d" />,
);

describe('DocCarousel — LinkedIn document preview', () => {
  it('mounts every page of the deck, so all of it is reviewable', () => {
    for (let n = 1; n <= 6; n++) {
      expect(html).toContain(`slide-${n}.png`);
      expect(html).toContain(`Page ${n} of 6`);
    }
  });

  it('shows exactly one page, and starts on page 1', () => {
    // Pages 2..6 are mounted but display:none; page 1 is the only one shown.
    const hidden = html.match(/display:none/g) || [];
    expect(hidden).toHaveLength(5);
    const firstImg = html.slice(html.indexOf('slide-1.png'));
    expect(firstImg.slice(0, 400)).not.toContain('display:none');
  });

  it('frames the page at 4:5, the geometry that actually publishes', () => {
    expect(html).toMatch(/aspect-ratio:\s*4\s*\/\s*5/);
  });

  it('counts pages as "n / total"', () => {
    expect(html).toContain('1 / 6');
  });

  it('offers a next pager and no previous pager on page 1', () => {
    expect(html).toContain('aria-label="Next page"');
    expect(html).not.toContain('aria-label="Previous page"');
  });

  it('is keyboard reachable and announces its position', () => {
    expect(html).toContain('tabindex="0"');
    expect(html).toMatch(/aria-label="Document preview, page 1 of 6[^"]*arrow keys/);
  });

  it('carries one dot per page', () => {
    const dots = html.match(/aria-label="Page \d+"/g) || [];
    expect(dots).toHaveLength(6);
  });

  it('labels the deck with its title', () => {
    expect(html).toContain('Case study deck');
  });

  it('renders nothing paged when handed a single slide (cover-only decks stay simple)', () => {
    const one = renderToStaticMarkup(
      <DocCarousel slides={[SLIDES[0]]} title="One pager" accent="#ffc71d" />,
    );
    expect(one).toContain('1 / 1');
    expect(one).not.toContain('aria-label="Next page"');
    expect(one).not.toContain('aria-label="Previous page"');
  });
});
