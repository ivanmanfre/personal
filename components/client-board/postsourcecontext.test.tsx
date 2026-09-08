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
});
