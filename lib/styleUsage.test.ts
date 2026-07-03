import { describe, it, expect } from 'vitest';
import { aggregateImageStyleUsage, toRenderableImageUrl } from './styleUsage';

describe('toRenderableImageUrl', () => {
  it('rewrites a drive /file/d/ID/view link to a thumbnail link', () => {
    expect(toRenderableImageUrl('https://drive.google.com/file/d/ABC123/view?usp=drivesdk'))
      .toBe('https://drive.google.com/thumbnail?id=ABC123&sz=w600');
  });
  it('rewrites open?id= and uc?id= forms', () => {
    expect(toRenderableImageUrl('https://drive.google.com/open?id=XYZ')).toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w600');
    expect(toRenderableImageUrl('https://drive.google.com/uc?id=XYZ&export=view')).toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w600');
  });
  it('passes through a normal https image url', () => {
    expect(toRenderableImageUrl('https://cdn.x/y/slide-1.png')).toBe('https://cdn.x/y/slide-1.png');
  });
  it('returns null for empty/non-http', () => {
    expect(toRenderableImageUrl(null)).toBeNull();
    expect(toRenderableImageUrl('')).toBeNull();
    expect(toRenderableImageUrl('data:foo')).toBeNull();
  });
});

describe('aggregateImageStyleUsage', () => {
  it('counts per image_style and picks latest renderable cover', () => {
    const out = aggregateImageStyleUsage([
      { taxonomy: { image_style: 'Stat Card' }, image_urls: ['https://x/a.png'], created_at: '2026-06-01T00:00:00Z' },
      { taxonomy: { image_style: 'Stat Card' }, image_urls: ['https://x/b.png'], created_at: '2026-06-05T00:00:00Z' },
      { taxonomy: { image_style: 'Quote Card' }, image_urls: ['https://drive.google.com/file/d/QID/view'], created_at: '2026-06-02T00:00:00Z' },
      { taxonomy: { pillar: 'methodology' }, image_urls: ['https://x/c.png'], created_at: '2026-06-09T00:00:00Z' },
    ]);
    expect(out['Stat Card']).toEqual({ count: 2, cover: 'https://x/b.png' });
    expect(out['Quote Card']).toEqual({ count: 1, cover: 'https://drive.google.com/thumbnail?id=QID&sz=w600' });
    expect(out['undefined']).toBeUndefined();
  });
  it('skips rows with no renderable cover for the cover pick but still counts them', () => {
    const out = aggregateImageStyleUsage([
      { taxonomy: { image_style: 'Lifestyle Photo' }, image_urls: null, created_at: '2026-06-10T00:00:00Z' },
      { taxonomy: { image_style: 'Lifestyle Photo' }, image_urls: ['https://x/old.png'], created_at: '2026-06-01T00:00:00Z' },
    ]);
    expect(out['Lifestyle Photo']).toEqual({ count: 2, cover: 'https://x/old.png' });
  });
});
