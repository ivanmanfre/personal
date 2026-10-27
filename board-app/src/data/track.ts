// Usage tracking: batched events to board_track (validates the link or session; up to 50 per call),
// plus one row in `pageviews` per page load like the rest of the site. Nothing here may throw or
// hold up the board: every call is wrapped and fire-and-forget.
import { insertPageview, sendTrack, type Cred } from './api';
import { isTestBrowser } from './entry';

export type TrackEvent =
  | 'visit' | 'view' | 'open_post' | 'open_focus' | 'expand' | 'approve' | 'comment' | 'resolve'
  | 'edit' | 'reschedule' | 'pull' | 'photo' | 'sign_in' | 'classic';

type Row = { event: TrackEvent; view: string | null; ref: string | null; visit: string; meta: Record<string, unknown> | null; is_test: boolean };

let cred: Cred | null = null;
let view: string | null = null;
let queue: Row[] = [];
let timer = 0;
let started = false;
const TEST = (() => { try { return isTestBrowser(); } catch { return true; } })();

function visitId(): string {
  try {
    const k = 'board_visit_id';
    const v = sessionStorage.getItem(k);
    if (v) return v;
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(k, fresh);
    return fresh;
  } catch {
    return 'mem-' + Math.random().toString(36).slice(2);
  }
}
const VISIT = visitId();

function flush(keepalive = false) {
  try {
    if (!cred || !queue.length) return;
    if (!cred.token && !cred.session?.token) return; // sign-in screen: hold until there is a way in
    const batch = queue.splice(0, 50);
    void sendTrack(cred, batch, keepalive).then(r => { if (!r?.ok) requeue(batch); }).catch(() => requeue(batch));
    if (queue.length && !keepalive) flush();
  } catch { /* never surface */ }
}
const requeue = (b: Row[]) => { queue = [...b, ...queue].slice(0, 200); };

export function startTracking(c: Cred) {
  try {
    cred = c;
    if (started) return;
    started = true;
    timer = window.setInterval(() => flush(), 10_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    window.addEventListener('pagehide', () => flush(true));
  } catch { /* noop */ }
}

/** Keep the credential current (sign-in, sign-out) so batches go out with the right one. */
export function setTrackCred(c: Cred) { cred = c; }

export function setView(v: string) { view = v; }

export function track(event: TrackEvent, ref?: string | null, meta?: Record<string, unknown> | null) {
  try {
    queue.push({ event, view, ref: ref ? String(ref).slice(0, 80) : null, visit: VISIT, meta: meta || null, is_test: TEST });
    if (queue.length > 200) queue = queue.slice(-200);
    if (queue.length >= 50) flush();
  } catch { /* noop */ }
}

/** Send now (used before leaving for the classic board). */
export function flushNow() { flush(true); }

export function stopTracking() { window.clearInterval(timer); }

function device(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) return 'mobile';
  return 'desktop';
}

function refHost() {
  try { return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : null; } catch { return null; }
}

/** One `visit` per page load, with how the client arrived. */
export function trackVisit(entryView: string, auth: 'link' | 'session') {
  try {
    track('visit', null, {
      device: device(), viewport: `${window.innerWidth}x${window.innerHeight}`, referrer: refHost(), entry_view: entryView, auth,
    });
    // A short visit still counts: send the arrival right away, the rest batches every 10s.
    window.setTimeout(() => flush(), 1500);
  } catch { /* noop */ }
}

/** One `pageviews` row per load, same shape as lib/pageviewTracker.ts. Skips local dev. */
export function trackPageview(slug: string) {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.local')) return;
    const sid = (() => {
      try {
        const k = '__pv_sid';
        const v = sessionStorage.getItem(k);
        if (v) return v;
        const f = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(k, f);
        return f;
      } catch { return Math.random().toString(36).slice(2); }
    })();
    const clamp = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);
    const ref = document.referrer || null;
    void insertPageview({
      session_id: sid,
      path: `/client/${slug}`,
      referrer_host: clamp(refHost(), 253),
      referrer_full: clamp(ref, 2048),
      user_agent: clamp(navigator.userAgent, 512),
      device_type: device(),
      language: clamp(navigator.language, 35),
      screen_w: window.screen?.width ?? null,
      screen_h: window.screen?.height ?? null,
      is_test: TEST,
    }).catch(() => { /* never surface */ });
  } catch { /* noop */ }
}
