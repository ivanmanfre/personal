// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach} from 'vitest';
const invoke = vi.fn(() => Promise.resolve({}));
vi.mock('./supabase', () => ({supabase: {functions: {invoke}}}));
vi.mock('./dashboardAuth', () => ({isAuthenticated: () => false}));

describe('trackScanOpen view', () => {
 beforeEach(() => { invoke.mockClear(); vi.resetModules(); Object.defineProperty(window, 'location', {value: new URL('https://inboundonsteroids.com/scan/x/'), configurable: true}); });
 it('sends the view', async () => {
  const {trackScanOpen} = await import('./scanOpenTracker');
  trackScanOpen('marta-quillfeather-fx1', 'team');
  expect(invoke).toHaveBeenCalledTimes(1);
  expect((invoke.mock.calls[0] as any)[1].body).toMatchObject({company_slug: 'marta-quillfeather-fx1', view: 'team'});
 });
 it('defaults to main', async () => {
  const {trackScanOpen} = await import('./scanOpenTracker');
  trackScanOpen('a-slug');
  expect((invoke.mock.calls[0] as any)[1].body.view).toBe('main');
 });
 it('main and team each fire once', async () => {
  const {trackScanOpen} = await import('./scanOpenTracker');
  trackScanOpen('s', 'main'); trackScanOpen('s', 'team'); trackScanOpen('s', 'main'); trackScanOpen('s', 'team');
  expect(invoke).toHaveBeenCalledTimes(2);
 });
});
