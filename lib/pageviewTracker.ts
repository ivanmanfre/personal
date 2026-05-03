import { supabase } from './supabase';
import { captureUtmFromUrl } from './utmCapture';

const SESSION_KEY = '__pv_sid';
const EXCLUDE_KEY = '__pv_exclude';
const SESSION_ID_LEN = 16;

/**
 * Persistent "don't count me" flag kept in localStorage. Toggle it by
 * visiting the site with `?me=1` (set) or `?me=0` (clear) once per browser.
 * When set, trackPageview() is a no-op. Mirrors Plausible's internal-traffic
 * opt-out. Private-mode / localStorage failures fall back to tracking.
 */
function syncExclusionFlag(): boolean {
  try {
    const me = new URLSearchParams(window.location.search).get('me');
    if (me === '1') localStorage.setItem(EXCLUDE_KEY, '1');
    else if (me === '0') localStorage.removeItem(EXCLUDE_KEY);
    return localStorage.getItem(EXCLUDE_KEY) === '1';
  } catch {
    return false;
  }
}

function makeSessionId(): string {
  const bytes = new Uint8Array(SESSION_ID_LEN);
  (crypto || (window as any).msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = makeSessionId();
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / sessionStorage disabled — just use an in-memory id.
    return makeSessionId();
  }
}

function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|android|iphone|ipod|blackberry|opera mini|iemobile/.test(s)) return 'mobile';
  return 'desktop';
}

function clamp(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function isIgnoredPath(path: string): boolean {
  return path.startsWith('/dashboard') || path.startsWith('/v/');
}

/**
 * Send one pageview. Fire-and-forget — failures are swallowed so a broken
 * tracker never breaks the site.
 */
export async function trackPageview(path: string): Promise<void> {
  if (isIgnoredPath(path)) return;
  if (typeof window === 'undefined') return;

  // Skip localhost + preview builds + Vercel/Netlify preview hosts to keep
  // dev traffic out of prod data. Wave 0 / P30-3.
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    host.includes('staging.') ||
    host.includes('preview.')
  ) {
    return;
  }

  // Owner opt-out: `?me=1` once per browser, then every future visit is skipped.
  if (syncExclusionFlag()) return;

  // Capture first-touch UTMs for replay through Stripe/Calendly redirects.
  // Safe to call on every pageview; it's first-touch, so it's a no-op once
  // we already have a UTM payload for the session.
  try { captureUtmFromUrl(); } catch { /* never let tracker block */ }

  try {
    const params = new URLSearchParams(window.location.search);
    const refFull = document.referrer || null;
    const row = {
      session_id: getSessionId(),
      path: clamp(path, 512)!,
      referrer_host: clamp(safeHost(refFull), 253),
      referrer_full: clamp(refFull, 2048),
      utm_source: clamp(params.get('utm_source'), 128),
      utm_medium: clamp(params.get('utm_medium'), 128),
      utm_campaign: clamp(params.get('utm_campaign'), 128),
      utm_content: clamp(params.get('utm_content'), 128),
      user_agent: clamp(navigator.userAgent, 512),
      device_type: detectDeviceType(navigator.userAgent),
      language: clamp(navigator.language, 35),
      screen_w: window.screen?.width ?? null,
      screen_h: window.screen?.height ?? null,
    };
    await supabase.from('pageviews').insert(row);
  } catch {
    // Never surface tracker errors to the UI.
  }
}
