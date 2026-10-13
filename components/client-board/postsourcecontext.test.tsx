import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PostSourceContext from './PostSourceContext';

describe('PostSourceContext', () => {
  it('keeps internal locators and unsafe URLs out of links', () => {
    const html = renderToStaticMarkup(<PostSourceContext label="Saved call" detail={{
      source_url: 'javascript:alert(1)', supporting_urls: ['file:///private/transcript', 'https://example.com/report'],
    }} />);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('file:');
    expect(html).toContain('href="https://example.com/report"');
  });
  it('shows a reference source with no internal status words', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ source: 'Neal Lahmi', reference_only: true }} />);
    expect(html).toContain('Neal Lahmi');
    expect(html).not.toContain('adaptation pending');
  });
  it('puts the original link inside closed notes and never shows internal review text', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ source: 'Example report', source_url: 'https://example.com/report', explanation: 'Why it matters.',
      note: "Written from Davorin's own lines and approved by Ivan (2026-09-28).", claim_boundary: 'Hypothetical throughout.', evidence_status: 'source_gap' }} />);
    const notes = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(notes).toContain('Open original source');
    expect(notes).not.toMatch(/<details[^>]*\bopen(?:=|>)/);
    for (const t of ['Why it matters.', 'approved by Ivan', 'Hypothetical throughout.', 'needs attention']) expect(html).not.toContain(t);
  });
  it('cleans internal stamps out of the source line', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ source: 'Domas call · 19 Aug 2026; saved review N2' }} />);
    expect(html).toContain('Domas call · 19 Aug 2026');
    expect(html).not.toContain('saved review');
  });
  it('uses reference titles without claiming a supporting link is the original', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ references: [{ url: 'https://example.com/context', title: 'Background report' }] }} />);
    expect(html).toContain('Background report');
    expect(html).not.toContain('Open original source');
  });

});
