/**
 * Wave 0 / P30-1 + P30-2: UTM capture + replay utility.
 *
 * On every pageview we read URL utm_* + ?ref= params and persist them in
 * sessionStorage. They get replayed when the user fires a form submit, opens
 * Calendly, or hits a Stripe checkout link, so attribution survives the
 * single-page-app navigation between landing and conversion.
 *
 * Convention (see /docs/utm-convention.md):
 *   utm_source = linkedin | outreach | nurture | podcast | referral | google | direct | upwork | lm-share
 *   utm_medium = profile | post | comment | dm | bio | newsletter | calendly_link | referral
 *   utm_campaign = e.g. agency-q2-2026, blueprint-launch, agent-ready-letter-issue-3
 *   utm_term, utm_content (optional)
 *   ref = referral token
 *
 * The first UTM hit per session wins ("first-touch attribution"). If the user
 * lands again with a different UTM in the same tab, we *do not* overwrite —
 * channel attribution is most useful when it survives in-tab navigation.
 */

const STORAGE_KEY = '__utm_first_touch';
const SESSION_FALLBACK_KEY = '__utm_first_touch_session';

export interface UtmPayload {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referral_token: string | null;
  landing_path: string | null;
  captured_at: string | null;
}

const EMPTY: UtmPayload = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  referral_token: null,
  landing_path: null,
  captured_at: null,
};

function read(): UtmPayload {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(SESSION_FALLBACK_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

function write(p: UtmPayload): void {
  try {
    const s = JSON.stringify(p);
    sessionStorage.setItem(STORAGE_KEY, s);
    // localStorage fallback survives inter-page nav in browsers that drop
    // sessionStorage (rare, but cheap insurance).
    localStorage.setItem(SESSION_FALLBACK_KEY, s);
  } catch {
    // private mode / quota — accept the loss.
  }
}

/**
 * Capture URL params on the current pageview. First-touch wins; later
 * URL UTMs are ignored unless none was previously captured.
 *
 * Safe to call on every route change; no-op when no params present and
 * a touch already exists.
 */
export function captureUtmFromUrl(): UtmPayload {
  if (typeof window === 'undefined') return { ...EMPTY };

  const existing = read();
  const hasExisting =
    existing.utm_source ||
    existing.utm_medium ||
    existing.utm_campaign ||
    existing.referral_token;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return existing;
  }

  const fresh: UtmPayload = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
    referral_token: params.get('ref') || params.get('referral_token'),
    landing_path: window.location.pathname,
    captured_at: new Date().toISOString(),
  };

  const hasFresh =
    fresh.utm_source ||
    fresh.utm_medium ||
    fresh.utm_campaign ||
    fresh.referral_token;

  if (!hasExisting && hasFresh) {
    write(fresh);
    return fresh;
  }
  return existing;
}

/** Read the captured first-touch payload (read-only). */
export function getUtmPayload(): UtmPayload {
  if (typeof window === 'undefined') return { ...EMPTY };
  return read();
}

/**
 * Append the captured UTMs to a URL as query params. Used when redirecting
 * to Stripe checkout / Calendly / external follow-on surfaces so attribution
 * survives the redirect. Existing query params on `targetUrl` are preserved.
 *
 * `extra` is merged on top of the captured UTMs (call-site overrides win).
 */
export function withUtmParams(
  targetUrl: string,
  extra?: Record<string, string | null | undefined>,
): string {
  if (typeof window === 'undefined') return targetUrl;
  const p = read();
  let url: URL;
  try {
    url = new URL(targetUrl, window.location.origin);
  } catch {
    return targetUrl;
  }

  const merged: Record<string, string | null | undefined> = {
    utm_source: p.utm_source,
    utm_medium: p.utm_medium,
    utm_campaign: p.utm_campaign,
    utm_term: p.utm_term,
    utm_content: p.utm_content,
    ref: p.referral_token,
    ...(extra || {}),
  };

  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '') continue;
    // Don't blat existing params already present on the target URL —
    // call-site params (e.g. session_id) take priority.
    if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  }
  return url.toString();
}

/**
 * Build a Stripe checkout URL with `client_reference_id` carrying the UTM
 * fingerprint, so the stripe-webhook can decode it server-side without
 * needing to round-trip metadata through Stripe Payment Link config.
 *
 * Payment Link format: `?client_reference_id=<short-utm-fingerprint>` is
 * what gets persisted on the Checkout Session and fired into our webhook.
 *
 * The fingerprint is `<source>__<medium>__<campaign>__<content>` truncated
 * to 200 chars (Stripe limit). null / missing fields collapse to empty.
 */
export function buildStripeCheckoutUrl(baseUrl: string): string {
  if (typeof window === 'undefined') return baseUrl;
  const p = read();
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return baseUrl;
  }

  const parts = [
    p.utm_source || '',
    p.utm_medium || '',
    p.utm_campaign || '',
    p.utm_content || '',
    p.referral_token || '',
  ];
  const fingerprint = parts.join('__').slice(0, 200);

  if (fingerprint.replace(/_/g, '').length > 0) {
    url.searchParams.set('client_reference_id', fingerprint);
  }
  // Also append utm_* — Stripe Payment Link will preserve these on the
  // checkout success URL, which the welcome page uses to fire a beacon.
  if (p.utm_source) url.searchParams.set('utm_source', p.utm_source);
  if (p.utm_medium) url.searchParams.set('utm_medium', p.utm_medium);
  if (p.utm_campaign) url.searchParams.set('utm_campaign', p.utm_campaign);
  if (p.utm_content) url.searchParams.set('utm_content', p.utm_content);
  return url.toString();
}

/**
 * Decode a fingerprint produced by buildStripeCheckoutUrl. Mirror used by
 * the stripe-webhook edge function to populate paid_assessments.utm_*.
 */
export function decodeFingerprint(fp: string | null | undefined): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referral_token: string | null;
} {
  const empty = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    referral_token: null,
  };
  if (!fp || typeof fp !== 'string') return empty;
  const parts = fp.split('__');
  return {
    utm_source: parts[0] || null,
    utm_medium: parts[1] || null,
    utm_campaign: parts[2] || null,
    utm_content: parts[3] || null,
    referral_token: parts[4] || null,
  };
}
