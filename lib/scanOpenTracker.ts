import { supabase } from './supabase';
import { isAuthenticated } from './dashboardAuth';

// Records one open of a /scan/<slug> page via the `scan-open` edge function.
// The edge fn stamps the request IP and makes the final owner call server-side;
// here we only pass the client-known owner signal + light context. Mirrors the
// guards in pageviewTracker.ts so the two agree on what counts as a real open.

const EXCLUDE_KEY = '__pv_exclude';
const fired = new Map<string, Promise<number | null>>();

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

export type ScanView = 'main' | 'team';

/**
 * Fire-and-forget. Records at most one open per slug per page load and resolves to the stored open id
 * (null when skipped, on any failure, and for the owner: an owner open never starts page events); a second call for
 * the same slug gets the same promise. Callers that ignore the result keep working as before.
 */
export function trackScanOpen(slug: string, view: ScanView = 'main'): Promise<number | null> {
  if (typeof window === 'undefined' || !slug) return Promise.resolve(null);
  if (isPreviewHost(window.location.hostname)) return Promise.resolve(null);   // keep dev traffic out
  const already = fired.get(slug);
  if (already) return already;   // one open per slug per page load; a re-render gets the same open id

  const ua = navigator.userAgent || '';
  const owner = ownerFlag();
  const p = supabase.functions
    .invoke('scan-open', {
      body: {
        company_slug: slug,
        owner_flag: owner,
        device_type: deviceType(ua),
        referrer_host: referrerHost(),
        user_agent: ua.slice(0, 512),
        view,
      },
    })
    .then(({ data }) => {
      const d = data as { open_id?: unknown; is_owner?: unknown } | null;
      if (owner || d?.is_owner === true) return null;   // the owner's own opens never collect page events
      const id = d?.open_id;
      return typeof id === 'number' && Number.isFinite(id) ? id : null;
    })
    .catch(() => null);   // never surface tracker errors to the page
  fired.set(slug, p);
  return p;
}
