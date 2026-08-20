import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto('http://localhost:3000/scan/daniele-mauro-9d', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
const txt = await p.evaluate(() => document.body.innerText);
for (const probe of ['A buyer here means', 'buyers already sit', 'Buyers verified', 'named one at a time']) {
  const i = txt.indexOf(probe);
  console.log(probe.padEnd(24), i < 0 ? 'ABSENT' : JSON.stringify(txt.slice(i, i + 130).replace(/\n/g, ' ')));
}
console.log('undefined on page:', txt.includes('undefined'));
console.log('console errors:', errs.length ? errs : 'none');
await b.close();
