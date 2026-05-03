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
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const HOST = '127.0.0.1';  // explicit IPv4 — CI runners can resolve 'localhost' to ::1, breaking playwright

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
];

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

async function waitForServer(maxMs = 30000) {
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

      // Strip the SPA-redirect script and module preload hints? No — leave the
      // <script type="module"> entry so the real browser hydrates.
      // Also strip transient/runtime-only attributes Playwright might add.
      const html = await page.evaluate(() => {
        // Inject a marker so we can confirm this file came from prerender.
        const m = document.createElement('meta');
        m.name = 'x-prerendered';
        m.content = new Date().toISOString();
        document.head.appendChild(m);
        return '<!doctype html>\n' + document.documentElement.outerHTML;
      });

      const outDir = join(DIST, route.replace(/^\//, ''));
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
