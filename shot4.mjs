import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:3000/scan/daniele-mauro-9d', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3000);
const ch = await p.$('#cs-ch-outbound');
if (!ch) { console.log('chapter not found'); }
else {
  await ch.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  const box = await ch.boundingBox();
  console.log('chapter height', Math.round(box.height));
  await ch.screenshot({ path: '/tmp/ch03-full.png' });
}
await b.close();
