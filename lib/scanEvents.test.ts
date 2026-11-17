// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./scanOpenTracker', () => ({ trackScanOpen: async () => null }));
import { clickName, sectionName, startScanEvents, tagBookingHref, trackOpenWithEvents } from './scanEvents';

const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild as Element; };
const a = (html: string) => h(html) as HTMLAnchorElement;

type Entry = { target: Element; isIntersecting: boolean };
let observers: Array<{ cb: (e: Entry[]) => void; els: Element[] }> = [];
class FakeIO {
  cb: (e: Entry[]) => void; els: Element[] = [];
  constructor(cb: (e: Entry[]) => void) { this.cb = cb; observers.push(this); }
  observe(el: Element) { this.els.push(el); }
  unobserve() {}
  disconnect() { this.els = []; }
}
const fire = (el: Element, isIntersecting = true) => observers.forEach((o) => o.els.includes(el) && o.cb([{ target: el, isIntersecting }]));

describe('names and tags', () => {
  it('names a section by attribute then id', () => {
    expect(sectionName(h('<section data-scan-section="buyers" id="x">'))).toBe('buyers');
    expect(sectionName(h('<section id="rise-method">'))).toBe('rise-method');
    expect(sectionName(h('<section>'))).toBeNull();
    expect(sectionName(h('<section id="Has Spaces & CAPS">'))).toBe('has-spaces-caps');
  });
  it('names booking clicks', () => {
    expect(clickName(a('<a data-scan-click="book-close" href="https://calendly.com/x">'))).toBe('book-close');
    expect(clickName(a('<a data-cta="close" href="https://tidycal.com/x">'))).toBe('book-close');
    expect(clickName(a('<a href="https://calendly.com/x">'))).toBe('book-link');
    expect(clickName(a('<a href="https://cal.com/ivan/30">'))).toBe('book-link');
    expect(clickName(a('<a href="https://example.com">'))).toBeNull();
  });
  it('tags a booking link once', () => {
    expect(tagBookingHref('https://calendly.com/im-ivanmanfredi/30min', 'fabio-soprano-c2', 'close')).toBe('https://calendly.com/im-ivanmanfredi/30min?utm_source=scan&utm_medium=page&utm_campaign=fabio-soprano-c2&utm_content=close');
    expect(tagBookingHref('https://calendly.com/x?utm_content=header', 's', 'close')).toContain('utm_content=header');
    expect(tagBookingHref('not a url', 's', 'close')).toBe('not a url');
  });
});

describe('startScanEvents', () => {
  beforeEach(() => { vi.useFakeTimers(); observers = []; (globalThis as Record<string, unknown>).IntersectionObserver = FakeIO; document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('sends each section once', async () => {
    document.body.innerHTML = '<section data-scan-section="buyers"></section><section id="close"></section><section></section>';
    const sent: unknown[] = [];
    const stop = startScanEvents(document.body, 'acme-1', 77, (b) => { sent.push(b); });
    const buyers = document.querySelector('[data-scan-section="buyers"]')!;
    fire(buyers); vi.advanceTimersByTime(1100); fire(buyers, false); fire(buyers); vi.advanceTimersByTime(1100);
    const close = document.getElementById('close')!;
    fire(close); vi.advanceTimersByTime(500); fire(close, false);   // left before one second: not counted
    vi.advanceTimersByTime(2100);
    expect(sent).toEqual([{ kind: 'event', open_id: 77, company_slug: 'acme-1', events: [{ kind: 'section_view', name: 'buyers' }] }]);
    stop();
  });
  it('records a booking click, tags the link and flushes at once', () => {
    document.body.innerHTML = '<a id="b" data-scan-click="book-close" href="https://calendly.com/im-ivanmanfredi/30min">Book</a><a id="o" href="https://example.com/">x</a>';
    const sent: Array<{ events: unknown[] }> = [];
    const stop = startScanEvents(document.body, 'acme-2', 78, (b) => { sent.push(b as { events: unknown[] }); });
    const link = document.getElementById('b') as HTMLAnchorElement;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(link.href).toBe('https://calendly.com/im-ivanmanfredi/30min?utm_source=scan&utm_medium=page&utm_campaign=acme-2&utm_content=close');
    expect(sent[0].events).toEqual([{ kind: 'cta_click', name: 'book-close' }]);
    const other = document.getElementById('o') as HTMLAnchorElement;
    other.addEventListener('click', (e) => e.preventDefault());
    other.click();
    expect(other.href).toBe('https://example.com/');
    expect(sent).toHaveLength(1);
    stop();
  });
  it('stops cleanly', () => {
    document.body.innerHTML = '<a id="b" href="https://calendly.com/x">Book</a>';
    const sent: unknown[] = [];
    const stop = startScanEvents(document.body, 'acme-3', 79, (b) => { sent.push(b); });
    stop();
    const link = document.getElementById('b') as HTMLAnchorElement;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    vi.advanceTimersByTime(5000);
    expect(sent).toEqual([]);
  });
});

describe('trackOpenWithEvents', () => {
  it('does nothing without an open id', async () => {
    const start = vi.fn();
    const stop = trackOpenWithEvents('acme-4', 'main', { track: async () => null, start });
    await Promise.resolve(); await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    stop();
  });
  it('starts events with the open id and cleans up', async () => {
    const inner = vi.fn();
    const start = vi.fn(() => inner);
    const stop = trackOpenWithEvents('acme-5', 'team', { track: async (_s, v) => (v === 'team' ? 91 : null), start });
    await Promise.resolve(); await Promise.resolve();
    expect(start).toHaveBeenCalledWith(document.body, 'acme-5', 91);
    stop();
    expect(inner).toHaveBeenCalled();
  });
  it('a stop before the open resolves never starts events', async () => {
    const start = vi.fn();
    let resolve: (n: number) => void = () => {};
    const stop = trackOpenWithEvents('acme-6', 'main', { track: () => new Promise<number>((r) => { resolve = r; }), start });
    stop(); resolve(5);
    await Promise.resolve(); await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
  });
});
