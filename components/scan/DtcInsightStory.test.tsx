// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import fixture from '../dev/scanlab/yananails-story.json';
import { DtcInsightStory, canShowStory, ShippingExample } from './DtcInsightStory';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
const data = { ...fixture.commercial, presentation: fixture.presentation } as DtcCommercialEvidence;
describe('source-backed story', () => {
  it('requires approved story version, complete evidence and the actual recorded ad destination', () => {
    expect(canShowStory(data, fixture.ads.meta)).toBe(true);
    expect(canShowStory({ ...data, status: 'error' }, fixture.ads.meta)).toBe(false);
    expect(canShowStory({ ...data, presentation: { ...data.presentation!, review: { approved: false, checked_at: '' } } }, fixture.ads.meta)).toBe(false);
    expect(canShowStory(data, { ...fixture.ads.meta, status: 'blocked' })).toBe(false);
    expect(canShowStory({ ...data, presentation: { ...data.presentation!, version: 'unknown' } }, fixture.ads.meta)).toBe(false);
    expect(canShowStory({ ...data, tests: [] }, fixture.ads.meta)).toBe(false);
    expect(canShowStory({ ...data, journeys: [] }, fixture.ads.meta)).toBe(false);
  });
  it('puts the paid insight before store suggestions, with dated activity and no performance claim', () => {
    const html = renderToStaticMarkup(<DtcInsightStory companyName="Yananails" domain="yananails.com" data={data} ads={fixture.ads} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" />);
    expect(html.indexOf('id="paid-media"')).toBeLessThan(html.indexOf('id="product-pair"'));
    expect(html).toContain('3');
    expect(html).toContain('Checked 13 Oct 2026');
    expect(html).toContain('Checked 8 Oct 2026');
    expect(html).toContain('Public ad records do not show spend or sales.');
    expect(html).toContain('mattan.jpg');
    expect(html).toContain(fixture.ads.meta.source_url.replaceAll('&', '&amp;'));
    expect(html).toContain(fixture.ads.google.source_url.replaceAll('&', '&amp;'));
    const capped = renderToStaticMarkup(<DtcInsightStory companyName="Yananails" domain="yananails.com" data={data} ads={{ ...fixture.ads, google: { ...fixture.ads.google, data: { ...fixture.ads.google.data, capped: true } } }} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" />);
    expect(capped).toContain('At least');
    expect(html).not.toContain('What we will test first');
    const blocked = renderToStaticMarkup(<DtcInsightStory companyName="Yananails" domain="yananails.com" data={data} ads={{ ...fixture.ads, google: { status: 'blocked', data: { ads_found: 900 } } }} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" />);
    expect(blocked).not.toContain('<strong>900</strong>');
    expect(blocked).not.toContain('Google creatives');
  });
  it('treats free shipping as strictly above the threshold and labels the basket as an example', () => {
    render(<ShippingExample data={data.presentation!.shipping} />);
    expect(screen.getByText('Example basket')).toBeTruthy();
    const input = screen.getByLabelText('Example basket value in SEK');
    fireEvent.change(input, { target: { value: '910' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Nagellim/ }));
    expect(screen.getByText('999 SEK')).toBeTruthy();
    expect(screen.getByText('Free shipping starts above 999 SEK')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add MULTI-MIST/ }));
    expect(screen.getByText('1,118 SEK')).toBeTruthy();
    expect(screen.getByText('Above the free-shipping threshold')).toBeTruthy();
  });
});
