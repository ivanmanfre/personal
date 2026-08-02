// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeskLeadMagnetsSurface from './DeskLeadMagnetsSurface';
import type { Board } from '../ClientBoardPage';

/** Test-only fixture. Only the fields DeskLeadMagnetsSurface actually reads
 *  (lead_magnets, lm_ideas, newsletter) are populated; the rest of Board is cast away. */
function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    company_name: 'Acme DTC',
    domain: 'acme.example',
    queue: [],
    lead_magnets: [
      // Live, captured is a real number — exercises the Num path.
      {
        id: 'lm-live-tracked',
        title: 'True Profit Per Order X-Ray',
        format: 'calculator',
        status: 'live',
        url: 'https://acme.example/profit-xray',
        cover_url: 'https://acme.example/assets/cover.jpg',
        captured: 142,
        promise: 'Seven numbers in, a written diagnosis of where profit leaks.',
      },
      // Live, captured UNDEFINED — must render "not tracked yet", never "0".
      {
        id: 'lm-live-untracked',
        title: 'Ad Account Report Card',
        format: 'report_card',
        status: 'live',
        url: 'https://acme.example/ad-report-card',
        // no cover_url on purpose: exercises the Blank cover fallback too.
      },
    ],
    // The drawn-up-next pipeline lives in lm_ideas, a field separate from lead_magnets —
    // on a real board every lead_magnets row is already 'live'. This is the exact data
    // shape that used to render "0 drawn up next" while real ideas existed (BLOCKER-3).
    lm_ideas: [
      {
        id: 'lmi-1',
        title: 'The Apparel Growth Benchmark',
        format: 'benchmark',
        status: 'idea',
        note: 'Six numbers, read against apparel peers.',
      },
    ],
    // newsletter intentionally absent — the nurture rail must be omitted entirely.
    ...overrides,
  } as unknown as Board;
}

const noop = async () => ({ ok: true });

describe('DeskLeadMagnetsSurface', () => {
  it('renders the shelf, drawn-up tiles, honest blanks, and omits the nurture rail when absent', () => {
    const board = makeBoard();
    const html = renderToStaticMarkup(
      <DeskLeadMagnetsSurface
        board={board}
        accent="#2F7D4F"
        mint="#8FE0AC"
        fontStack="Inter, sans-serif"
        live
        onEditPromo={noop}
      />
    );

    // (a) key blocks present
    expect(html).toContain('Lead magnets');
    expect(html).toContain('live on your site');
    expect(html).toContain('True Profit Per Order X-Ray');
    expect(html).toContain('Ad Account Report Card');
    expect(html).toContain('The Apparel Growth Benchmark');
    expect(html).toContain('Drawn up next');
    // prose stays OFF the dashed tiles (title + status chip carry them)
    expect(html).not.toContain('Six numbers, read against apparel peers.');
    // the headline extends with the drawn-up-next clause when ideas exist
    expect(html).toMatch(/live on your site<\/b>,\s*1 more drawn up\./);

    // (b) data-metric and data-viz appear
    expect(html).toContain('data-metric');
    expect(html).toContain('data-viz');

    // (c) a drill renders collapsed (<details> without `open`)
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*class="drill"/);
    expect(html).not.toMatch(/<details[^>]*\bopen\b[^>]*>/);

    // (d) absent-data variant: the untracked live entry renders the honest blank,
    // never a fabricated zero for that field.
    expect(html).toContain('opt-ins: not tracked yet');
    // Footer opt-ins stat is also blank (fixture has one tracked + one untracked entry,
    // so anyCaptured is true and the footer shows the real aggregate — 142 — instead).
    expect(html).toContain('142');

    // (e) the false-zero regression (BLOCKER-3): real ideas exist (1), so the
    // "drawn up next" stat must never read 0.
    const statMatch = html.match(/<b[^>]*>([^<]*)<\/b>\s*<i[^>]*>drawn up next<\/i>/);
    expect(statMatch).toBeTruthy();
    expect(statMatch![1]).toBe('1');
    expect(statMatch![1]).not.toBe('0');

    // Newsletter absent from the fixture: nurture rail must be omitted entirely.
    expect(html).not.toContain('Sends from');
  });

  it('omits the opt-ins stat number and shows the honest blank when NO entry has a captured count', () => {
    const board = makeBoard({
      lead_magnets: [
        {
          id: 'lm-live-untracked-only',
          title: 'Ad Account Report Card',
          format: 'report_card',
          status: 'live',
          url: 'https://acme.example/ad-report-card',
        },
      ],
      lm_ideas: [],
    } as unknown as Partial<Board>);

    const html = renderToStaticMarkup(
      <DeskLeadMagnetsSurface
        board={board}
        accent="#2F7D4F"
        mint="#8FE0AC"
        fontStack="Inter, sans-serif"
        live
        onEditPromo={noop}
      />
    );

    expect(html).toContain('opt-ins: not tracked yet');
    // No captured count anywhere in the fixture: never render a bare "0" stat for it.
    // (liveN=1 legitimately renders as "1" — a real count, not the captured field — so we
    // only assert the specific absent-field copy renders, above. lm_ideas is empty here on
    // purpose: ideasN=0 is a true, computed zero — not the false-zero bug case above.)
  });

  it('renders a one-line Newsletter pointer when board.newsletter is present (the full rail lives on the Newsletter tab)', () => {
    const board = makeBoard({
      newsletter: {
        name: 'RISE Weekly',
        cadence: 'weekly',
        from_domain: 'itsmattan@risedtc.com',
        nurture: [
          { step: 'Assessment completed', detail: 'Email captured and scored.' },
          { step: 'Welcome email, same hour', detail: 'Score breakdown and one fix.' },
        ],
      },
    } as unknown as Partial<Board>);

    const html = renderToStaticMarkup(
      <DeskLeadMagnetsSurface
        board={board}
        accent="#2F7D4F"
        mint="#8FE0AC"
        fontStack="Inter, sans-serif"
        live
        onEditPromo={noop}
      />
    );

    expect(html).toContain('RISE Weekly');
    expect(html).toContain('sequence on the Newsletter tab');
    // the rail itself must NOT duplicate here — it lives on the Newsletter tab
    expect(html).not.toContain('Assessment completed');
    expect(html).not.toContain('Welcome email, same hour');
  });
});
