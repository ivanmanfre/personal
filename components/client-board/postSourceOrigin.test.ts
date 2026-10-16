import { expect, it } from 'vitest';
import { postSourceOrigin } from './postSourceOrigin';
it('uses recorded ownership and outlier provenance, while a URL alone establishes only YouTube', () => {
 const url = 'https://www.youtube.com/watch?v=fixture';
 expect(postSourceOrigin({ source_detail: { kind: 'own_posts', source_url: url } })).toEqual({ label: 'Own YouTube', href: url });
 expect(postSourceOrigin({ source_detail: { kind: 'youtube_outlier', source_url: url } })).toEqual({ label: 'YouTube outlier', href: url });
 expect(postSourceOrigin({ source_detail: { kind: 'unknown', source_url: url } })).toEqual({ label: 'YouTube', href: url });
 expect(postSourceOrigin({ source_label: 'Own YouTube' }).label).toBe('Own YouTube');
 expect(postSourceOrigin({ source_detail: { kind: 'youtube_outlier', source: 'ContentBrain', source_url: url } }).label).toBe('YouTube outlier · ContentBrain');
 expect(postSourceOrigin({ source_detail: { kind: 'unknown', source: 'ContentBrain', source_url: url } }).label).toBe('YouTube · ContentBrain');
});
it('names client calls and Instagram without inventing outlier performance', () => {
 expect(postSourceOrigin({ source_detail: { kind: 'call', call_title: 'Client recording' } }).label).toBe('Client call');
 expect(postSourceOrigin({ source_detail: { kind: 'winner_replica', source_url: 'https://www.instagram.com/p/fixture/' } })).toEqual({ label: 'Instagram', href: 'https://www.instagram.com/p/fixture/' });
});
it('does not turn supporting documentation, lane metadata or internal notes into a content origin', () => {
 expect(postSourceOrigin({ source_detail: { kind: 'swishdm_carousel_lane', supporting_urls: ['https://youtube.com/watch?v=facts'] }, source_label: 'SwishDM weekly carousel: draft' }).label).toBe('Source pending');
 expect(postSourceOrigin({ source_label: 'SwishDM carousel style sample: FIRST-5-POSTS Post 1' }).label).toBe('Source pending');
 expect(postSourceOrigin({ source_detail: { kind: 'strategy', label: 'Client call' } }).label).toBe('Source pending');
 expect(postSourceOrigin({ source_label: 'Picked by Ivan from inbox selection' }).label).toBe('Source pending');
});
it('keeps missing and unsafe sources honest and preserves the input provenance', () => {
 expect(postSourceOrigin({})).toEqual({ label: 'Source pending', href: undefined });
 expect(postSourceOrigin({ source_detail: { kind: 'unknown', source_url: 'javascript:alert(1)' } }).href).toBeUndefined();
 const item = { source_detail: { kind: 'winner_replica', source_url: 'https://instagram.com/p/fixture/', note: 'Internal editorial note' } };
 const before = JSON.stringify(item); postSourceOrigin(item); expect(JSON.stringify(item)).toBe(before);
});

it('accepts the canonical hyphenated Content-Brain source label', () => {
 expect(postSourceOrigin({ source_detail: { kind: 'youtube_outlier', source: 'Content-Brain', source_url: 'https://youtube.com/watch?v=fixture' } }).label).toBe('YouTube outlier · ContentBrain');
});
