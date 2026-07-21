#!/usr/bin/env node
/**
 * Pre-render commercial routes to static HTML so share-scrapers (LinkedIn,
 * Slack, Twitter/X, Facebook, Google) see HTTP 200 with the right OG meta
 * before client-side JS runs.
 *
 * Strategy: spin up `vite preview` against dist/, drive it with Playwright,
 * wait for hydrated DOM + per-route useMetadata() updates, then write the
 * rendered HTML back to dist/<route>/index.html.
 *
 * Why a custom script vs a Vite plugin: this codebase uses React 19 +
 * StrictMode + react-router-dom 7 + lazy/Suspense + framer-motion + a
 * Supabase eager import inside pageviewTracker. None of the current Vite
 * pre-render plugins are confidently maintained for that combo, and the
 * cost of a misfire is a broken build. Driving the real production bundle
 * with a real browser is the most predictable path.
 *
 * Hydration safety: pre-rendered HTML still keeps <div id="root"> with the
 * pre-rendered children inside; the same <script type="module"
 * src="/main.tsx"> tag is preserved, so React 19's hydrateRoot equivalent
 * (createRoot here) takes over. We DO NOT remove the script tag — the
 * SPA still has to boot client-side for interactivity. The visible flash
 * risk is low because the static HTML matches what React renders on first
 * paint for these mostly-static marketing routes. Routes with heavy
 * client-only state (intake forms, scorecard wizard middle steps) are
 * NOT in the pre-render list — only their entry pages.
 *
 * Conflict check: cloudflare-share-worker handles /scorecard/result/:id
 * dynamic OG cards via its own Worker route, served from a different
 * subdomain (share.ivanmanfredi.com per wrangler.toml comments). It does
 * not intercept ivanmanfredi.com/scorecard, so pre-rendering /scorecard
 * here does not collide.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const HOST = '127.0.0.1';  // explicit IPv4 — CI runners can resolve 'localhost' to ::1, breaking playwright

// Local runs: Node doesn't auto-load .env, so the dynamic scan/board enumeration
// below silently degraded to the static ROUTES list outside CI (CI exports these
// as step env — see .github/workflows/deploy.yml). Backfill missing vars from the
// repo .env so `npm run build:prerender` behaves the same locally as in CI.
// Exported env always wins; absent .env (the CI path) is a clean no-op.
try {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* no .env — CI provides env directly */ }

// Routes to pre-render — priority order from A08-R01.
// Each route's <head> already comes from useMetadata(); we just freeze
// the post-hydration head + body into dist/<route>/index.html.
const ROUTES = [
  '/scorecard',
  '/assessment',
  '/start',
  '/lead-magnet-system',
  '/fractional',
  '/content-system',
  '/work',
  '/case-studies/own-content-engine',
  // Both /dashboard and /dashboard-v2 prerendered as stubs so the URLs return
  // 200 instead of GitHub Pages' SPA-fallback 404. Real first-time visitors
  // deep-linked to /dashboard?section=... were hitting a 404 redirect dance.
  // The page bootstraps and runs auth client-side; the prerendered HTML is
  // just enough to give bots/monitors a real 200 response.
  '/dashboard',
  '/dashboard-v2',
  // Hypertarget content-system scans: prerendered so the clean ivanmanfredi.com/scan/:slug
  // link returns 200 + per-scan OG meta and unfurls on LinkedIn. Add a slug here when a
  // hypertarget sample is promoted (low volume, manual). The page still hydrates client-side.
  '/scan/tk-douglass-9b',
  '/scan/step-digital',
  '/scan/dizz-agency',
  '/scan/skulpt',
];

// Dynamically add every promoted hypertarget scan (asset_ready / approved / sent) so each
// generated scan's clean /scan/:slug link returns 200 + per-scan OG and unfurls on LinkedIn —
// no manual ROUTES edit per prospect. Falls back to the static list if Supabase is unreachable.
async function fetchScanSlugs() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[prerender] no Supabase env — skipping dynamic scan enumeration');
    return [];
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/hypertarget_corpus?stage=in.(asset_ready,approved,sent)&company_slug=not.is.null&select=company_slug`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      console.warn(`[prerender] scan enum HTTP ${res.status} — using static routes only`);
      return [];
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map((r) => r.company_slug).filter(Boolean) : [];
  } catch (e) {
    console.warn('[prerender] scan enum failed:', e.message);
    return [];
  }
}

// Inline (corpus-less) scans — e.g. build-on-yes cold-lane builds — have NO
// hypertarget_corpus row; enumerate them from the scans table directly so their
// links prerender too. Anon key can read scans (verified 2026-07-11).
async function fetchInlineScanSlugs() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/scans?status=eq.complete&matched_offer=in.(content_system,dtc_growth)&company_slug=not.is.null&select=company_slug`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows)
      ? rows.map((r) => r.company_slug).filter((sl) => sl && sl !== 'scan-engine-selftest')
      : [];
  } catch { return []; }
}

for (const slug of [...(await fetchScanSlugs()), ...(await fetchInlineScanSlugs())]) {
  const r = `/scan/${slug}`;
  if (!ROUTES.includes(r)) ROUTES.push(r);
}
console.log(`[prerender] scan routes:`, ROUTES.filter((r) => r.startsWith('/scan/')).join(', '));

// Parallel to the scan enumeration, but for client boards. client_boards is RLS
// deny-all (only the get_client_board token RPC reads it), so the anon key CANNOT
// enumerate it. Instead we ask the deployed board-generator service — the only holder
// of the service-role key — for the finished preview boards, bearer-protected by
// BOARD_GEN_TOKEN. Each returns {slug, token}; we prerender /client/:slug?k=<token> so
// the clean link returns 200 + per-board OG (no Ivan portrait) and unfurls cleanly.
// Falls back to zero client routes if the service/env is unavailable — the per-board
// useMetadata() OG still fixes the unfurl for JS-rendering scrapers even without prerender.
async function fetchClientBoardSlugs() {
  const base = process.env.BOARD_GEN_URL;
  const token = process.env.BOARD_GEN_TOKEN;
  if (!base || !token) {
    console.warn('[prerender] no BOARD_GEN_URL/TOKEN — skipping client-board enumeration');
    return [];
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/list-board-slugs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[prerender] client-board enum HTTP ${res.status} — skipping client routes`);
      return [];
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows.filter((r) => r && r.slug && r.token) : [];
  } catch (e) {
    console.warn('[prerender] client-board enum failed:', e.message);
    return [];
  }
}

for (const { slug, token } of await fetchClientBoardSlugs()) {
  // Query is kept for navigation (the board RPC needs ?k=<token>) but stripped from the
  // on-disk path in the render loop, so this lands at dist/client/<slug>/index.html.
  const r = `/client/${slug}?k=${token}`;
  if (!ROUTES.includes(r)) ROUTES.push(r);
}
console.log(`[prerender] client routes:`, ROUTES.filter((r) => r.startsWith('/client/')).map((r) => r.split('?')[0]).join(', ') || '(none)');

// SCAN_MIRROR=1: the build (VITE_BASE=/scan/) is destined for the
// inboundonsteroids-site repo's scan/ dir, served at inboundonsteroids.com/scan/.
// Only scan routes render, and the on-disk path strips the leading /scan so dist/
// copies 1:1 into that repo's scan/ directory (dist/tk-x/ -> /scan/tk-x/).
const SCAN_MIRROR = process.env.SCAN_MIRROR === '1';
if (SCAN_MIRROR) {
  ROUTES.splice(0, ROUTES.length, ...ROUTES.filter((r) => r.startsWith('/scan/')));
  console.log(`[prerender] SCAN_MIRROR: ${ROUTES.length} scan routes only`);
}

// RISE_SCAN_MIRROR=1: white-label mirror of ONLY Rise's dtc_growth scans, destined for the
// rise-dtc-resources repo's scan/ dir, served at resources.risedtc.com/scan/ (so prospect-facing
// scan links live on Rise's own domain, not ivanmanfredi.com). Same /scan strip + per-scan OG as
// SCAN_MIRROR; the difference is the route set is filtered to dtc_growth slugs only (content_system
// scans stay off Rise's domain).
const RISE_SCAN_MIRROR = process.env.RISE_SCAN_MIRROR === '1';
if (RISE_SCAN_MIRROR) {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  let dtc = [];
  if (sUrl && sKey) {
    try {
      const res = await fetch(
        `${sUrl}/rest/v1/scans?status=eq.complete&matched_offer=eq.dtc_growth&company_slug=not.is.null&select=company_slug`,
        { headers: { apikey: sKey, Authorization: `Bearer ${sKey}` } },
      );
      if (res.ok) dtc = (await res.json()).map((r) => r.company_slug).filter(Boolean);
      else console.warn(`[prerender] RISE_SCAN_MIRROR enum HTTP ${res.status}`);
    } catch (e) {
      console.warn('[prerender] RISE_SCAN_MIRROR enum failed:', e.message);
    }
  }
  const want = new Set(dtc.map((s) => `/scan/${s}`));
  ROUTES.splice(0, ROUTES.length, ...ROUTES.filter((r) => want.has(r)));
  console.log(`[prerender] RISE_SCAN_MIRROR: ${ROUTES.length} dtc_growth scan routes only`);
}

// CLIENT_MIRROR=1: the build (VITE_BASE=/client/) is destined for the
// inboundonsteroids-site repo's client/ dir, served at inboundonsteroids.com/client/.
// Only /client routes render, and the on-disk path strips the leading /client so dist/
// copies 1:1 into that repo's client/ directory (dist/<slug>/ -> /client/<slug>/).
// Parallels SCAN_MIRROR exactly; additive.
const CLIENT_MIRROR = process.env.CLIENT_MIRROR === '1';
if (CLIENT_MIRROR) {
  ROUTES.splice(0, ROUTES.length, ...ROUTES.filter((r) => r.startsWith('/client/')));
  console.log(`[prerender] CLIENT_MIRROR: ${ROUTES.length} client routes only`);
}

const PORT = 4178;
const BASE = `http://${HOST}:${PORT}`;

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ not found. Run `vite build` first.');
  process.exit(1);
}

console.log(`[prerender] starting vite preview on ${HOST}:${PORT}`);
const preview = spawn(
  'npx',
  ['vite', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } }
);

// Mirror server output for debugging; don't rely on it for ready detection.
preview.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
preview.stderr.on('data', (chunk) => process.stderr.write(`[vite-err] ${chunk}`));
preview.on('error', (err) => console.error('[vite] spawn error:', err));
preview.on('exit', (code, sig) => {
  if (code !== null && code !== 0) console.error(`[vite] exited code=${code} signal=${sig}`);
});

// HTTP healthcheck — more reliable than parsing stdout for color-formatted URLs.
function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/`, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await ping()) {
      console.log(`[prerender] vite preview reachable after ${Date.now() - start}ms`);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite preview did not respond on ${BASE} within ${maxMs}ms`);
}

async function shutdown(code = 0) {
  try {
    preview.kill('SIGTERM');
  } catch {}
  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

(async () => {
  await waitForServer();

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],  // CI runners have limited /dev/shm
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; IvanPrerender/1.0; +https://ivanmanfredi.com)',
    viewport: { width: 1280, height: 1024 },
  });

  let failures = 0;

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    console.log(`[prerender] -> ${route}`);
    const page = await context.newPage();
    // Surface browser console errors so CI logs show why a route fails.
    page.on('pageerror', (err) => console.error(`[prerender][${route}] pageerror:`, err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[prerender][${route}] console.error:`, msg.text());
    });
    try {
      // 'networkidle' hangs on apps with Supabase realtime / long-poll connections.
      // 'domcontentloaded' is enough — useMetadata() runs in useEffect after first paint
      // anyway, and we explicitly waitForFunction below.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // useMetadata() runs in useEffect after first paint. Wait one micro-tick
      // for the title to update from the index.html default to the route title.
      await page.waitForFunction(
        () => document.title && !document.title.includes('Agent-Ready Ops™')
          ? true
          : document.title && document.title !== 'Iván Manfredi | Agent-Ready Ops™',
        { timeout: 5000 }
      ).catch(() => {
        // Not all routes change the title (e.g. if they share the default).
        // Don't fail the whole prerender on that.
      });
      // Give framer-motion + lazy chunks a beat to settle
      await page.waitForTimeout(800);

      // Scan routes fetch their row from Supabase before useMetadata() sets the
      // per-scan OG title/description/image. Wait for that so the prerendered HTML
      // carries the right share tags (other routes set metadata synchronously).
      if (route.startsWith('/scan/')) {
        await page
          .waitForFunction(() => /^(A content system|An inbound engine|A growth scan) for /.test(document.title), { timeout: 15000 })
          .catch(() => console.error(`[prerender][${route}] scan OG title never set — check the row exists/complete`));
        // Bake the full report body, not just OG tags. The scan content arrives via a
        // client-side Supabase fetch, so without this wait the baked #root is empty and
        // a visitor with a blocker/slow network sees a blank page. Every other route
        // already bakes its body (they render synchronously); this aligns scans.
        await page
          .waitForFunction(() => ((document.getElementById('root') || {}).innerText || '').length > 1500, { timeout: 20000 })
          .catch(() => console.error(`[prerender][${route}] scan body under threshold — baking whatever rendered`));
        await page.waitForTimeout(600);
      }

      // Client boards fetch their row via the get_client_board RPC before useMetadata()
      // sets the per-board OG title/description/image. Wait for that so the baked HTML
      // carries the clean per-board share tags (no Ivan portrait) instead of the defaults.
      if (route.startsWith('/client/')) {
        await page
          .waitForFunction(() => / · content preview$/.test(document.title), { timeout: 15000 })
          .catch(() => console.error(`[prerender][${route}] client OG title never set — check the board row is mode=preview and the token is valid`));
        await page.waitForTimeout(400);
      }

      // Strip the SPA-redirect script and module preload hints? No — leave the
      // <script type="module"> entry so the real browser hydrates.
      // Also strip transient/runtime-only attributes Playwright might add.
      const html = await page.evaluate((riseMirror) => {
        // Inject a marker so we can confirm this file came from prerender.
        const m = document.createElement('meta');
        m.name = 'x-prerendered';
        m.content = new Date().toISOString();
        document.head.appendChild(m);
        if (riseMirror) {
          // White-label scrub for Rise's domain: the SPA shell's static JSON-LD
          // (Person/Service schema: Ivan's name, portrait, offer URLs) and the Ivan
          // favicon must never ship on resources.risedtc.com. Crawler-visible even
          // though invisible to humans.
          document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
          document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]').forEach((l) => l.remove());
          const mk = (rel, href, sizes) => {
            const l = document.createElement('link');
            l.rel = rel; l.href = href; if (sizes) l.setAttribute('sizes', sizes);
            document.head.appendChild(l);
          };
          mk('icon', 'https://risedtc.com/wp-content/uploads/2025/04/cropped-Rise-DTC-favicon-blk-32x32.png', '32x32');
          mk('icon', 'https://risedtc.com/wp-content/uploads/2025/04/cropped-Rise-DTC-favicon-blk-192x192.png', '192x192');
          mk('apple-touch-icon', 'https://risedtc.com/wp-content/uploads/2025/04/cropped-Rise-DTC-favicon-blk-180x180.png');
        }
        return '<!doctype html>\n' + document.documentElement.outerHTML;
      }, RISE_SCAN_MIRROR);

      // Strip any query string (e.g. /client/:slug?k=<token>) from the on-disk path:
      // GitHub Pages resolves the file by path only, so this maps to
      // dist/<path>/index.html and the token stays out of the directory name.
      const outPath = (SCAN_MIRROR || RISE_SCAN_MIRROR)
        ? (route.split('?')[0].replace(/^\/scan/, '') || '/')
        : CLIENT_MIRROR
        ? (route.split('?')[0].replace(/^\/client/, '') || '/')
        : route.split('?')[0];
      const outDir = join(DIST, outPath.replace(/^\//, ''));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'index.html'), html, 'utf8');
      console.log(`[prerender] wrote ${outDir}/index.html (${html.length} bytes)`);
    } catch (err) {
      failures += 1;
      console.error(`[prerender] FAIL ${route}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`[prerender] done. ${ROUTES.length - failures}/${ROUTES.length} routes written.`);
  await shutdown(failures > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('[prerender] fatal:', err);
  await shutdown(1);
});
