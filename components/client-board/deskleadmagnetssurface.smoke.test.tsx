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
      // Live, visitors + captured are real numbers — exercises the Num path. `gated`
      // is what licenses the opt-ins line: this page asks for an email.
      {
        id: 'lm-live-tracked',
        title: 'True Profit Per Order X-Ray',
        format: 'calculator',
        status: 'live',
        url: 'https://acme.example/profit-xray',
        cover_url: 'https://acme.example/assets/cover.jpg',
        visitors: 38,
        gated: true,
        captured: 142,
        promise: 'Seven numbers in, a written diagnosis of where profit leaks.',
      },
      // Live, visitors UNDEFINED — must render the blank, never "0".
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
    // never a fabricated zero for that field. Visitors ARE tracked upstream (lm_events
    // via lm-beacon) — the board data just doesn't carry counts yet — so the caption
    // must never claim "not tracked".
    expect(html).toContain('visitors: not shown here yet');
    expect(html).not.toContain('not tracked yet');
    // Visitors is the headline number on the tile; opt-ins ride alongside it only
    // because this entry is gated. Footer carries both aggregates.
    expect(html).toContain('>38<');
    expect(html).toContain('142');
    expect(html).toContain('visits across the pages');
    expect(html).toContain('opt-ins on gated pages');

    // Today's shape carries no posted/announce fields: no invented marks.
    expect(html).not.toContain('announced');
    expect(html).not.toContain('Page drafted');

    // (e) the false-zero regression (BLOCKER-3): real ideas exist (1), so the
    // "drawn up next" stat must never read 0.
    const statMatch = html.match(/<b[^>]*>([^<]*)<\/b>\s*<i[^>]*>drawn up next<\/i>/);
    expect(statMatch).toBeTruthy();
    expect(statMatch![1]).toBe('1');
    expect(statMatch![1]).not.toBe('0');

    // Newsletter absent from the fixture: nurture rail must be omitted entirely.
    expect(html).not.toContain('Sends from');
  });

  it('omits the visitor stat number and shows the honest blank when NO entry has a count', () => {
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

    expect(html).toContain('visitors: not shown here yet');
    expect(html).not.toContain('not tracked yet');
    // Nothing is gated in this fixture, so the opt-ins line must not appear at all —
    // an ungated page has no gate to have failed.
    expect(html).not.toContain('opt-ins');
    // No count anywhere in the fixture: never render a bare "0" stat for it.
    // (liveN=1 legitimately renders as "1" — a real count, not the captured field — so we
    // only assert the specific absent-field copy renders, above. lm_ideas is empty here on
    // purpose: ideasN=0 is a true, computed zero — not the false-zero bug case above.)
  });

  it('renders the staged corrected shape: announce dates, unannounced marks, drafted pipeline, optins counts', () => {
    // Field names per the staged proposal in phase1-evidence-1d §6:
    // status 'live'|'live_unannounced'|'drafted', posted_to_linkedin, posted_date,
    // posted_note, page_live, optins.
    const board = makeBoard({
      lead_magnets: [
        // Posted, gated entry with visitors AND an optins count — announce date shown,
        // visitors headline, opt-ins alongside, both in the aggregates.
        {
          id: 'lml-3',
          title: 'RISE DTC AI Kit',
          format: 'checklist',
          page_live: true,
          status: 'live',
          posted_to_linkedin: true,
          posted_date: '2026-07-23',
          visitors: 4,
          gated: true,
          optins: 19,
          url: 'https://acme.example/ai-kit',
        },
        // Live page, never announced on the feed — shows the plain mark, never claims
        // announced. Gated, so it carries an optins count too.
        {
          id: 'lml-2',
          title: 'True Profit Per Order X-Ray',
          format: 'calculator',
          page_live: true,
          status: 'live_unannounced',
          posted_to_linkedin: false,
          posted_note: 'Page live since 2026-07-17. Launch post never went out.',
          visitors: 3,
          gated: true,
          optins: 5,
          url: 'https://acme.example/profit-xray',
        },
        // UNGATED page with real visitors: shows the visitor count and NO opt-ins line.
        // This is the case the old shape got wrong — it rendered "0 opt-ins" on a page
        // that never asked for an email.
        {
          id: 'lml-6',
          title: 'The ChatGPT Shopping Checklist',
          format: 'checklist',
          page_live: true,
          status: 'live',
          posted_to_linkedin: true,
          posted_date: '2026-07-31',
          visitors: 2,
          url: 'https://acme.example/chatgpt',
        },
        // Drafted page — pipeline treatment, never a live shelf item.
        {
          id: 'lml-9',
          title: 'Return Rate Rescue',
          format: 'worksheet',
          status: 'drafted',
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

    // Posted entries show "announced DD Mon".
    expect(html).toContain('announced 23 Jul');
    expect(html).toContain('announced 31 Jul');
    // Unannounced entry shows the plain mark and never claims announced: exactly the
    // two posted marks above carry "announced <day>".
    expect(html).toContain('page live, not announced on the feed yet');
    expect(html.match(/announced \d{1,2} /g) || []).toHaveLength(2);

    // Drafted entry renders in the pipeline section (after the "Drawn up next" rule),
    // never as a live shelf item; headline counts only the 3 live pages.
    expect(html).toContain('Page drafted');
    expect(html.indexOf('Return Rate Rescue')).toBeGreaterThan(html.indexOf('Drawn up next'));
    expect(html).toMatch(/3 lead magnets are/);
    expect(html).not.toContain('Open Return Rate Rescue'); // no shelf card aria-label for it

    // Visitor counts render as the tile headline and sum into the footer aggregate.
    expect(html).toContain('>4<');
    expect(html).toContain('>3<');
    expect(html).toContain('>2<');
    expect(html).toContain('>9<'); // 4 + 3 + 2 visits across the three live pages
    // Opt-ins render only for the two gated entries and only they sum into that stat.
    expect(html).toContain('>19<');
    expect(html).toContain('>5<');
    expect(html).toContain('>24<'); // 19 + 5, the ungated page contributes nothing
    // Every live entry has a visitor count here, so no blank renders...
    expect(html).not.toContain('visitors: not shown here yet');
    expect(html).not.toContain('not tracked yet');
    // ...and the ungated page never shows a fabricated "0 opt-ins".
    expect(html).not.toContain('>0<');
    expect(html.match(/opt-ins/g) || []).toHaveLength(3); // 2 tiles + 1 footer stat
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
