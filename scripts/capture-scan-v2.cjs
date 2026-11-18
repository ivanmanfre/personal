// Visual acceptance captures for the V2 scan page (plan 2026-11-17-ivan-scan-page, Task 11).
//   BASE=http://localhost:4732 OUT=/tmp/v2-shots node scripts/capture-scan-v2.cjs
// BASE is a local `vite preview` of a VITE_BASE=/scan/ build. The six invented scans in components/dev/scanlab/v2-*.json
// are served in place of the scans read, so no live row is needed. Their profile images point at lm-og keys that do not
// exist (the adapter needs that URL shape); they are served from components/dev/scanlab/placeholders/. Guarded: edge functions, trackers and every
// non-GET are aborted, service workers blocked, storage video/GIF blocked (blockStorageMedia).
const path = require('path'), os = require('os'), fs = require('fs');
const req = (m) => { try { return require(m); } catch { return require(path.join(os.homedir(), '.claude/skills/playwright-driver/node_modules', m)); } };
const pw = req('playwright');
const blockStorageMedia = require(path.join(os.homedir(), '.claude/skills/playwright-driver/block-storage-media.js'));
const BASE = process.env.BASE || 'http://localhost:4732', OUT = process.env.OUT || path.join(os.tmpdir(), 'v2-shots');
const DIR = path.join(__dirname, '..', 'components', 'dev', 'scanlab');
const rows = new Map(fs.readdirSync(DIR).filter(f => /^v2-.*\.json$/.test(f)).map(f => { const r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); return [r.company_slug, {key: f.slice(3, -5), row: {...r, matched_offer: 'content_system'}}]; }));
const PLACEHOLDER = /\/storage\/v1\/(?:object|render\/image)\/public\/lm-og\/profile-(photo|banner)-[a-z0-9-]+-fx\d\.png/;
const placeholder = kind => fs.readFileSync(path.join(DIR, 'placeholders', kind === 'banner' ? 'banner.svg' : 'avatar.svg'));
const WIDTHS = [[390, 844], [1440, 900]];
fs.mkdirSync(OUT, {recursive: true});

async function guard(ctx) {
  // Registered first so it runs last: Playwright tries the newest route first, and this one ends in route.continue().
  await blockStorageMedia(ctx);
  await ctx.route('**/*', route => {
    const r = route.request(), u = r.url(), m = r.method(), remote = !/^http:\/\/(localhost|127\.0\.0\.1)/.test(u);
    if (remote && (/\/functions\/v1\/|scan-open|page-open|pageview|googletagmanager|google-analytics/i.test(u) || !['GET', 'HEAD', 'OPTIONS'].includes(m))) return route.abort('blockedbyclient');
    const ph = remote && m === 'GET' && u.match(PLACEHOLDER);
    if (ph) return route.fulfill({status: 200, contentType: 'image/svg+xml', body: placeholder(ph[1])});
    if (remote && m === 'GET' && /\/rest\/v1\/scans\?/.test(u)) {
      const hit = rows.get((new URL(u).searchParams.get('company_slug') || '').replace(/^eq\./, ''));
      if (hit) return route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(/pgrst\.object/.test(r.headers()['accept'] || '') ? hit.row : [hit.row])});
    }
    return route.fallback();
  });
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

/** On-scroll reveals only run in view: walk the page once so the full-page shot shows the settled state. */
async function scrollThrough(page) {
  for (let i = 0; i < 80; i++) { const done = await page.evaluate(() => { window.scrollBy(0, window.innerHeight * .7); return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2; }); await page.waitForTimeout(120); if (done) break; }
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/** Facts the acceptance asks about, measured on the open page. */
function facts(vh) {
  const rect = el => el ? el.getBoundingClientRect().top + window.scrollY : null;
  const offer = rect(document.querySelector('[data-scan-section="offer"]'));
  const small = [...document.querySelectorAll('.scan-studio a, .scan-studio button, .scan-studio summary')].filter(el => {
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && b.height < 44 && !el.closest('[data-mockup],.sp-exhibit,.sv2-fold-body,.journey-skip,[inert],[aria-hidden="true"]');
  }).map(el => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
  const bigNumerals = [...document.querySelectorAll('body *')].filter(el => {
    const b = el.getBoundingClientRect(); if (b.top + window.scrollY > vh || !b.height) return false;
    const t = (el.textContent || '').trim(); return /^[01]$/.test(t) && parseFloat(getComputedStyle(el).fontSize) > 17;
  }).length;
  return {screens: +(document.documentElement.scrollHeight / vh).toFixed(1), offerScreen: offer === null ? null : +(offer / vh + 1).toFixed(2), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, smallTargets: small, bigZeroOrOneOnScreenOne: bigNumerals, h1: document.querySelector('h1')?.textContent || '', firstScreenText: document.body.innerText.slice(0, 600)};
}

(async () => {
  const b = await pw.chromium.launch();
  const report = {};
  for (const [slug, {key}] of rows) for (const [w, h] of WIDTHS) {
    const ctx = await b.newContext({viewport: {width: w, height: h}, serviceWorkers: 'block', deviceScaleFactor: 1});
    await guard(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/scan/${slug}/`, {waitUntil: 'networkidle'});
    await settle(page);
    await scrollThrough(page);
    await page.screenshot({path: `${OUT}/${key}-${w}-main.png`, fullPage: true});
    const f = await page.evaluate(facts, h);
    const toggle = page.locator('#content .sv2-fold-toggle');
    if (await toggle.count()) { await toggle.click(); await settle(page); await page.locator('#content').screenshot({path: `${OUT}/${key}-${w}-content-open.png`}); }
    await page.goto(`${BASE}/scan/${slug}/team/`, {waitUntil: 'networkidle'});
    await settle(page);
    await scrollThrough(page);
    await page.screenshot({path: `${OUT}/${key}-${w}-team.png`, fullPage: true});
    const t = await page.evaluate(facts, h);
    report[`${key}-${w}`] = {main: f, team: {screens: t.screens, hScroll: t.hScroll, smallTargets: t.smallTargets, h1: t.h1}};
    console.log(key, w, JSON.stringify({screens: f.screens, offerScreen: f.offerScreen, hScroll: f.hScroll, small: f.smallTargets.length, teamScreens: t.screens}));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/facts.json`, JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
