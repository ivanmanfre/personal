// Section views and booking clicks on a /scan/<slug> page, tied to the open the tracker just stored.
// Self-contained: the page only calls trackOpenWithEvents(slug, view) once the report has rendered. Sections are read
// from [data-scan-section] (else section[id]); booking links from [data-scan-click], else a.ris-booking[data-cta],
// else a link to a booking host. Readers count only events whose open is labelled 'human' (scan_opens.open_class).

import { trackScanOpen, type ScanView } from './scanOpenTracker';

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const BOOKING_HOSTS = ['calendly.com', 'tidycal.com', 'cal.com', 'meetings.hubspot.com'];
const FLUSH_MS = 2000;
const SEEN_MS = 1000;
const MAX_BATCH = 20;

type ScanEvent = { kind: 'section_view' | 'cta_click'; name: string };
export type EventBody = { kind: 'event'; open_id: number; company_slug: string; events: ScanEvent[] };
type Sender = (body: EventBody) => void;

function clean(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
  return NAME_RE.test(s) ? s : null;
}

function isBookingHost(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return BOOKING_HOSTS.some((b) => host === b || host.endsWith('.' + b));
  } catch { return false; }
}

export function sectionName(el: Element): string | null {
  return clean(el.getAttribute('data-scan-section')) ?? clean(el.getAttribute('id'));
}

export function clickName(a: HTMLAnchorElement): string | null {
  const explicit = clean(a.getAttribute('data-scan-click'));
  if (explicit) return explicit;
  const cta = clean(a.getAttribute('data-cta'));
  if (cta) return clean('book-' + cta);
  return isBookingHost(a.getAttribute('href') || '') ? 'book-link' : null;
}

/** Adds the scan UTM tags to a booking link. Never overwrites a parameter that is already there. */
export function tagBookingHref(href: string, slug: string, placement: string): string {
  let u: URL;
  try { u = new URL(href); } catch { return href; }
  const tags: Array<[string, string]> = [['utm_source', 'scan'], ['utm_medium', 'page'], ['utm_campaign', slug], ['utm_content', placement]];
  for (const [k, v] of tags) if (!u.searchParams.has(k)) u.searchParams.append(k, v);
  return u.toString();
}

function defaultSender(): Sender {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const base = env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
  const key = env.VITE_SUPABASE_ANON_KEY || '';
  // fetch keepalive, not sendBeacon: the functions gateway needs the apikey / authorization headers, which a beacon
  // cannot carry. keepalive lets the last batch leave while the page unloads.
  return (body) => {
    try {
      void fetch(`${base}/functions/v1/scan-open`, {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      }).catch(() => {});
    } catch { /* never surface tracker errors */ }
  };
}

export function startScanEvents(root: HTMLElement, slug: string, openId: number, send: Sender = defaultSender()): () => void {
  const queue: ScanEvent[] = [];
  const sent = new Set<string>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const watched = new WeakSet<Element>();
  let stopped = false;

  const push = (e: ScanEvent) => {
    const k = e.kind + ':' + e.name;
    if (stopped || sent.has(k)) return;
    sent.add(k);
    queue.push(e);
  };
  const flush = () => {
    while (queue.length) send({ kind: 'event', open_id: openId, company_slug: slug, events: queue.splice(0, MAX_BATCH) });
  };

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        for (const en of entries) {
          const name = sectionName(en.target);
          if (!name) continue;
          const t = timers.get(en.target);
          if (en.isIntersecting && !t) {
            timers.set(en.target, setTimeout(() => { timers.delete(en.target); push({ kind: 'section_view', name }); }, SEEN_MS));
          } else if (!en.isIntersecting && t) {
            clearTimeout(t); timers.delete(en.target);
          }
        }
      }, { threshold: 0.5 })
    : null;
  const watch = () => {
    if (!io) return;
    root.querySelectorAll('[data-scan-section], section[id]').forEach((el) => {
      if (!watched.has(el)) { watched.add(el); io.observe(el); }
    });
  };

  const onClick = (ev: Event) => {
    const a = (ev.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null;
    if (!a) return;
    const name = clickName(a);
    if (!name) return;
    if (name.startsWith('book-')) {
      const tagged = tagBookingHref(a.href, slug, name.slice(5));
      if (tagged !== a.href) a.href = tagged;
    }
    push({ kind: 'cta_click', name });
    flush();   // the click may navigate away: send now
  };
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };

  watch();
  root.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  const tick = setInterval(() => { watch(); flush(); }, FLUSH_MS);

  return () => {
    if (stopped) return;
    flush();
    stopped = true;
    clearInterval(tick);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    io?.disconnect();
    root.removeEventListener('click', onClick, true);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
}

type Deps = {
  track: (slug: string, view: ScanView) => Promise<number | null>;
  start: (root: HTMLElement, slug: string, openId: number) => () => void;
};

/** Records the open, then (only when it was stored) starts section and click events. Returns the cleanup. */
export function trackOpenWithEvents(slug: string, view: ScanView = 'main', deps: Deps = { track: trackScanOpen, start: startScanEvents }): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  deps.track(slug, view)
    .then((id) => { if (id && !cancelled && typeof document !== 'undefined') stop = deps.start(document.body, slug, id); })
    .catch(() => {});
  return () => { cancelled = true; stop?.(); stop = null; };
}
