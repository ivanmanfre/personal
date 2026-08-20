import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:3000/scan/daniele-mauro-9d', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3000);
for (const [id, out] of [['cs-ch-cold', '/tmp/ch04-cold.png'], ['cs-ch-inbound', '/tmp/ch02-inbound.png']]) {
  const el = await p.$('#' + id);
  if (!el) { console.log(id, 'NOT FOUND'); continue; }
  await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  const bb = await el.boundingBox();
  await el.screenshot({ path: out });
  console.log(id, 'height', Math.round(bb.height));
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
