// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeskNewsletterSurface from './DeskNewsletterSurface';
import type { Board } from '../ClientBoardPage';

/** Test-only fixture. Only `board.newsletter` is populated; the rest of Board is cast away. */
function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    company_name: 'Acme DTC',
    domain: 'acme.example',
    queue: [],
    newsletter: {
      name: 'RISE Weekly',
      sender: 'itsmattan@acme.example',
      from_domain: 'acme.example',
      cadence: 'Weekly',
      issues: [],
      // Real detail strings from the live board — a comma-boundary case, a
      // no-punctuation case (falls back to word boundary), and a short case that must
      // pass through untouched.
      nurture: [
        { step: 'Lead completes an assessment', detail: 'Email captured, scored across five DTC levers, routed to the matching track.' },
        { step: 'Welcome email, same hour', detail: 'Plain-text memo with the full score breakdown and one specific fix.' },
        { step: 'Weekly memo', detail: 'One operational idea every week, same voice, no promotion.' },
        { step: 'Call ask', detail: 'After three straight opens or two clicks in a week: one sentence and a calendar link.' },
      ],
    },
    ...overrides,
  } as unknown as Board;
}

describe('DeskNewsletterSurface', () => {
  it('renders the hero step count in accent tone (not dim-on-dark)', () => {
    const html = renderToStaticMarkup(<DeskNewsletterSurface board={makeBoard()} accent="#FFC71D" fontStack="Inter, sans-serif" />);
    // The hero <Num tone="accent"> resolves to var(--cb-accent) inline, not the plate ink.
    const heroMatch = html.match(/font-size:\s*clamp\(34px, 9\.4vw, 54px\)[^"]*color:\s*var\(--cb-accent\)/);
    expect(heroMatch).toBeTruthy();
  });

  it('never truncates a step detail mid-word, and never leaves a dangling half-clause', () => {
    const html = renderToStaticMarkup(<DeskNewsletterSurface board={makeBoard()} accent="#FFC71D" fontStack="Inter, sans-serif" />);

    // Comma-boundary case: cuts cleanly at "...five DTC levers" (drops the trailing
    // comma itself), never mid-word into "levers," or beyond.
    expect(html).toContain('Email captured, scored across five DTC levers…');
    expect(html).not.toContain('Email captured, scored across five DTC levers,…');

    // No-punctuation-in-window case: falls back to the last whole word ("specific"),
    // never slicing into "specif…" or similar.
    expect(html).toContain('Plain-text memo with the full score breakdown and one specific…');

    // Short detail (under the cap): passes through untouched, no ellipsis added.
    expect(html).toContain('One operational idea every week, same voice, no promotion.');
    expect(html).not.toContain('One operational idea every week, same voice, no promotion.…');

    // Colon/no-comma case: falls back to a whole-word cut, never mid-word.
    expect(html).toContain('After three straight opens or two clicks in a week: one sentence…');
  });

  it('renders the honest "no issues out yet" blank when issues is empty', () => {
    const html = renderToStaticMarkup(<DeskNewsletterSurface board={makeBoard()} accent="#FFC71D" fontStack="Inter, sans-serif" />);
    expect(html).toContain('no issues out yet');
    expect(html).toContain('drafted and ready');
    expect(html).toContain('subscribers: not tracked yet');
  });

  it('renders the issues ledger and headline when issues are present', () => {
    const board = makeBoard({
      newsletter: {
        name: 'RISE Weekly',
        from_domain: 'acme.example',
        issues: [{ date: '27 Jul', subject: 'What actually moved the needle' }],
        nurture: [{ step: 'Lead completes an assessment', detail: 'Email captured and scored.' }],
      },
    } as unknown as Partial<Board>);
    const html = renderToStaticMarkup(<DeskNewsletterSurface board={board} accent="#FFC71D" fontStack="Inter, sans-serif" />);
    expect(html).toContain('1 issue out');
    expect(html).toContain('What actually moved the needle');
  });

  it('returns null when board.newsletter is absent', () => {
    const html = renderToStaticMarkup(
      <DeskNewsletterSurface board={makeBoard({ newsletter: undefined } as unknown as Partial<Board>)} accent="#FFC71D" fontStack="Inter, sans-serif" />
    );
    expect(html).toBe('');
  });

  it('night (?night) v4: v2 stepper look with v3 words: status said once, four plain steps, plain empty state', () => {
    window.history.replaceState({}, '', '/?night');
    try {
      const html = renderToStaticMarkup(<DeskNewsletterSurface board={makeBoard()} accent="#FFC71D" fontStack="Inter, sans-serif" />);
      const text = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
      expect(html).toContain('data-surface="newsletter"');
      expect(html).toContain('data-newsletter-night');
      expect(text.replace(/\s+/g, ' ')).toContain('RISE Weekly is written . The first issue goes out once we pick a send day.');
      // the four steps as plain sentences, in order, inside v2's lit stepper (one-shot fill)
      expect(html).toContain('Someone downloads a lead magnet and we get their email.');
      expect(html).toContain('The same hour, they get a welcome email with their score and one fix.');
      expect(html).toContain('Every week they get one practical idea from you.');
      expect(html).toContain('After three opens in a row or two clicks in one week, they get one line asking them to book a call.');
      expect(html).toContain('class="nln-node"');
      expect(html).toContain('class="nln-seg"');
      expect(html).not.toMatch(/infinite/);
      expect(html).not.toContain('class="pk-ticker');
      // the status and the cadence are not repeated
      expect(text).not.toContain('drafted and ready');
      expect(text).not.toContain('day and time locked');
      expect(text).not.toContain('Issue history lands here');
      expect(html).toContain('Sends from acme.example. Subscribers are not counted here yet.');
      expect(html).toContain('No issues sent yet.');
      // v2's caps eyebrow carries v3's heading words
      expect(html).toContain('class="pk-cap pk-capline">What a new reader gets');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});
