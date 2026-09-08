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
  it('labels originals as references awaiting adaptation', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ source: 'Neal Lahmi', reference_only: true }} />);
    expect(html).toContain('Source reference · adaptation pending');
  });
  it('puts the explanation and original link inside closed notes even without a quote', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ source: 'Example report', source_url: 'https://example.com/report', explanation: 'Why it matters.' }} />);
    const notes = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(notes).toContain('Why it matters.');
    expect(notes).toContain('Open original source');
    expect(notes).not.toMatch(/<details[^>]*\bopen(?:=|>)/);
  });
  it('uses reference titles without claiming a supporting link is the original', () => {
    const html = renderToStaticMarkup(<PostSourceContext detail={{ references: [{ url: 'https://example.com/context', title: 'Background report' }] }} />);
    expect(html).toContain('Background report');
    expect(html).not.toContain('Open original source');
  });

});
