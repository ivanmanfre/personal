import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto('http://localhost:3000/scan/daniele-mauro-9d', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
const el = await p.$('.icp-block');
if (!el) { console.log('NO .icp-block ON PAGE'); }
else {
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await el.screenshot({ path: '/tmp/icp-desktop.png' });
  console.log('desktop shot ok');
}
// mobile
const p2 = await b.newPage({ viewport: { width: 390, height: 1400 }, deviceScaleFactor: 2 });
await p2.goto('http://localhost:3000/scan/daniele-mauro-9d', { waitUntil: 'networkidle', timeout: 60000 });
await p2.waitForTimeout(2500);
const el2 = await p2.$('.icp-block');
if (el2) { await el2.scrollIntoViewIfNeeded(); await p2.waitForTimeout(300); await el2.screenshot({ path: '/tmp/icp-mobile.png' }); console.log('mobile shot ok'); }
console.log('console errors:', errs.length ? errs : 'none');
await b.close();
