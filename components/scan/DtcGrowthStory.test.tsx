// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { DtcInsightStory, canShowStory } from './DtcInsightStory';

// Tvati, 14 October 2026: every finding reused one top-of-page screenshot and the cited ads had no image.
const AD = 'https://www.facebook.com/ads/library/?id=2187403562155683', PET = 'https://tvati.com/products/tvati-pet', SEEN = '2026-10-14T20:05:39Z';
const tests = [
  { title: 'Compare ad messages', observation: 'Two ads lead differently.', test: 'Run both ads side by side.', measure: 'Purchases per 100 clicks.', evidence: [{ kind: 'ad', source_url: AD, quote: 'Vet-approved joint and mobility support' }, { kind: 'store', source_url: PET, quote: 'No tablets, chews or powders.' }] },
  { title: 'Recommend one pack', observation: 'Size comes before packs.', test: 'Preselect one pack.', measure: 'Revenue per visitor.', evidence: [{ kind: 'store', source_url: PET, quote: 'WHAT SIZE IS YOUR PET?' }] },
];
const mark = { x: .5, y: .48, w: .4, h: .04 };
const story = () => structuredClone({ status: 'present', tests, journeys: [{ ad_url: AD, destinations: [PET], observed_at: SEEN }], presentation: { version: 'rise-standard-2026-10-14', domain: 'tvati.com', headline: tests[0].title, intro: 'We reviewed your store pages and public ads.', review: { approved: true, checked_at: SEEN }, sections: [
  { test_index: 0, headline: tests[0].title, body: tests[0].observation, action: tests[0].test, lane: 'paid', ad: { url: AD, quote: tests[0].evidence[0].quote, destinations: [PET], observed_at: SEEN },
    captures: [{ kind: 'ad', url: 'https://x.supabase.co/ad.png', source_url: AD, captured_at: SEEN, quote: 'Vet-approved joint and mobility support' }, { kind: 'page', url: 'https://x.supabase.co/p1.png', source_url: PET, captured_at: SEEN, quote: 'No tablets, chews or powders.', mark }] },
  { test_index: 1, headline: tests[1].title, body: tests[1].observation, action: tests[1].test, lane: 'store', captures: [{ kind: 'page', url: 'https://x.supabase.co/p2.png', source_url: PET, captured_at: SEEN, quote: 'WHAT SIZE IS YOUR PET?', mark }] },
] } }) as any;
const page = (data: any) => <DtcInsightStory companyName="Tvati" domain="tvati.com" data={data} ads={{}} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" />;

describe('per-finding evidence images', () => {
  it('introduces the brand and honest finding count, keeping tactical titles in the findings', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(page(story()));
    expect(container.querySelector('h1')!.textContent).toBe('Tvati');
    expect(container.querySelector('.ris-hero')!.textContent).toContain('2 findings');
    expect(container.querySelector('#finding-0 h2')!.textContent).toBe(tests[0].title);
    expect(container.querySelector('.ris-chapters a strong')!.textContent).toBe(tests[0].title);
    expect(container.querySelector('.ris-chapters a small')!.textContent).toBe('Paid ads');
    expect(container.querySelector('#rise-conversation h2')!.textContent).toBe('Let’s RISE Tvati');
    expect(container.querySelector('#rise-conversation')!.textContent).toContain('product margins');
    expect(container.querySelector('#rise-conversation img')!.getAttribute('src')).toContain('mattan.jpg');
    expect(container.querySelector('a[data-cta="close"]')!.getAttribute('href')).toBe('https://example.com/meeting');
  });

  it('keeps four reviewed findings visible before the call close', () => {
    const data = story();
    for (const title of ['Clarify the formula choice', 'Explain the free-item offer']) {
      const index = data.tests.length;
      data.tests.push({ ...data.tests[1], title });
      data.presentation.sections.push({ ...data.presentation.sections[1], test_index: index, headline: title });
    }
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(page(data));
    expect(container.querySelector('.ris-hero')!.textContent).toContain('4 findings');
    expect(container.querySelectorAll('.ris-chapters a')).toHaveLength(4);
    for (const index of [2, 3]) expect(container.querySelector(`#finding-${index}`)!.closest('details')).toBeNull();
    expect(container.querySelector('#finding-3')!.compareDocumentPosition(container.querySelector('#rise-conversation')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pairs the page evidence beneath the explanation and compact ad evidence', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(page(story()));
    const finding = container.querySelector('#finding-0')!;
    expect(finding.querySelectorAll('.ris-standard-grid .ris-ad-shot')).toHaveLength(1);
    expect(finding.querySelectorAll('.ris-standard-grid .ris-evidence-shot:not(.ris-ad-shot)')).toHaveLength(0);
    expect(finding.querySelectorAll('.ris-page-gallery .ris-evidence-shot')).toHaveLength(1);
    expect(container.querySelectorAll('#finding-1 .ris-standard-grid .ris-evidence-shot')).toHaveLength(1);
  });

  it('never invents a brand by splitting a domain, and handles a single finding', () => {
    const data = story();
    data.tests = data.tests.slice(0, 1); data.presentation.sections = data.presentation.sections.slice(0, 1);
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<DtcInsightStory companyName="tvati.com" domain="tvati.com" data={data} ads={{}} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" />);
    expect(container.querySelector('h1')!.textContent).toBe('Your growth review');
    expect(container.querySelector('.ris-hero')!.textContent).toContain('1 finding');
    expect(container.querySelector('#rise-conversation h2')!.textContent).toBe('Let’s plan your next paid test');
  });

  it('keeps the entire reviewed action readable below the paid evidence row', () => {
    const data = story();
    const opening = 'Keep the same page and offer. Replace the opening line with the customer quote.';
    const setup = ' Give each version its own tracking tag so orders can be matched to the ad. Run both versions at equal spend. Keep the rest of the ad unchanged. Check refund requests alongside purchases before deciding which version to keep. Use separate tracking links for each version. Keep the audience unchanged while the comparison runs.';
    data.tests[0].test = opening + setup;
    data.presentation.sections[0].action = data.tests[0].test;
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(page(data));
    const finding = container.querySelector('#finding-0')!;
    expect(finding.querySelector('.ris-takeaway p')!.textContent).toBe(data.tests[0].test);
    expect(finding.querySelector('.ris-standard-grid .ris-takeaway')).toBeNull();
    expect(finding.querySelector('.ris-standard-grid')!.nextElementSibling).toBe(finding.querySelector('.ris-takeaway'));
    expect(finding.querySelector('.ris-takeaway strong')).toBeNull();
    const details = finding.querySelector('details.ris-evidence')!;
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.textContent).toContain(data.tests[0].test);
    expect(details.querySelector('summary')!.textContent).toContain('Full test plan');
    expect(canShowStory(data)).toBe(true);
  });

  it('shows each finding its own ad image and marked page capture', () => {
    expect(canShowStory(story())).toBe(true);
    const html = renderToStaticMarkup(page(story()));
    expect(html).toContain('https://x.supabase.co/ad.png');
    expect(html).toContain('Ad text: “Vet-approved joint and mobility support” · Seen 14 Oct 2026');
    expect(html.match(/class="ris-mark"/g)).toHaveLength(2);
    expect(html).toContain('left:50%;top:48%;width:40%;height:4%');
    expect(html).toContain('Marked: “WHAT SIZE IS YOUR PET?”');
    expect(html.match(/aria-label="Enlarge: /g)).toHaveLength(3);
    // The shared top-of-page shot is no longer repeated across findings.
    expect(html.match(/p2\.png/g)).toHaveLength(1);
  });

  it('rejects captures that do not belong to the finding they illustrate', () => {
    const wrongQuote = story(); wrongQuote.presentation.sections[1].captures[0].quote = 'Words from another finding';
    const badMark = story(); badMark.presentation.sections[1].captures[0].mark = { x: .9, y: .5, w: .5, h: .1 };
    const noMark = story(); delete noMark.presentation.sections[1].captures[0].mark;
    const otherAd = story(); otherAd.presentation.sections[0].captures[0].source_url = 'https://www.facebook.com/ads/library/?id=999999';
    const otherAdText = story(); otherAdText.presentation.sections[0].captures[0].quote = 'Words the ad never said';
    const otherShop = story(); otherShop.presentation.sections[1].captures[0].source_url = 'https://other.com/products/tvati-pet';
    for (const bad of [wrongQuote, badMark, noMark, otherAd, otherAdText, otherShop]) expect(canShowStory(bad)).toBe(false);
  });

  it('opens a zoom view with steps, the source link and a close button', () => {
    render(page(story()));
    fireEvent.click(screen.getByRole('button', { name: /Enlarge: “WHAT SIZE IS YOUR PET\?”/ }));
    const view = screen.getByLabelText(/Zoomed view: /);
    expect(view.textContent).toContain('Marked: “WHAT SIZE IS YOUR PET?”');
    expect(view.querySelector('output')!.textContent).toBe('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in', hidden: true }));
    expect(view.querySelector('output')!.textContent).toBe('200%');
    expect(view.querySelector('a')!.getAttribute('href')).toBe(PET);
    fireEvent.click(screen.getByRole('button', { name: 'Close zoomed view', hidden: true }));
    expect(screen.queryByLabelText(/Zoomed view: /)).toBeNull();
  });
});
