import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BoardResourcesSurface from './BoardResourcesSurface';

describe('BoardResourcesSurface', () => {
  it('shows the configured review links and their status', () => {
    const html = renderToStaticMarkup(<BoardResourcesSurface resources={[{ title: 'Buyer comparison', href: 'https://madebyswishdm.com/resources/buyer-comparison/', note: 'Review the example.', status: 'For review' }]} />);
    expect(html).toContain('Buyer comparison');
    expect(html).toContain('https://madebyswishdm.com/resources/buyer-comparison/');
    expect(html).toContain('For review');
    expect(html).not.toContain('live and capturing');
  });
  it('does not render unsafe resource links', () => {
    const html = renderToStaticMarkup(<BoardResourcesSurface resources={[{ title: 'Unsafe', href: 'javascript:alert(1)' }, { title: 'Local', href: 'file:///private/report' }]} />);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('file:');
    expect(html).not.toContain('Unsafe');
  });
});
