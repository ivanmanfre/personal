import { supabase } from './supabase';
import { isAuthenticated } from './dashboardAuth';

// Records one open of a /scan/<slug> page via the `scan-open` edge function.
// The edge fn stamps the request IP and makes the final owner call server-side;
// here we only pass the client-known owner signal + light context. Mirrors the
// guards in pageviewTracker.ts so the two agree on what counts as a real open.

const EXCLUDE_KEY = '__pv_exclude';
const fired = new Set<string>();

// `?me=1` sets a persistent "don't count me" flag; `?me=0` clears it. Shared
// with pageviewTracker so claiming a device once covers both trackers.
function ownerFlag(): boolean {
  try {
    const me = new URLSearchParams(window.location.search).get('me');
    if (me === '1') localStorage.setItem(EXCLUDE_KEY, '1');
    else if (me === '0') localStorage.removeItem(EXCLUDE_KEY);
    if (localStorage.getItem(EXCLUDE_KEY) === '1') return true;
  } catch { /* private mode — fall through to auth check */ }
  try { return isAuthenticated(); } catch { return false; }
}

function deviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|android|iphone|ipod|blackberry|opera mini|iemobile/.test(s)) return 'mobile';
  return 'desktop';
}

function isPreviewHost(host: string): boolean {
  return (
    host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host.endsWith('.local') || host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') || host.includes('staging.') || host.includes('preview.')
  );
}

function referrerHost(): string | null {
  try { return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : null; }
  catch { return null; }
}

/** Fire-and-forget. Records at most one open per slug per page load. */
export function trackScanOpen(slug: string): void {
  if (typeof window === 'undefined' || !slug) return;
  if (isPreviewHost(window.location.hostname)) return;   // keep dev traffic out
  if (fired.has(slug)) return;
  fired.add(slug);

  const ua = navigator.userAgent || '';
  supabase.functions
    .invoke('scan-open', {
      body: {
        company_slug: slug,
        owner_flag: ownerFlag(),
        device_type: deviceType(ua),
        referrer_host: referrerHost(),
        user_agent: ua.slice(0, 512),
      },
    })
    .catch(() => { /* never surface tracker errors to the page */ });
}
