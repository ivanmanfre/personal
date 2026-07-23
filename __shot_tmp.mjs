import { chromium } from 'playwright';
const [,, url, out, width, reduce] = process.argv;
const w = parseInt(width || '1440', 10);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: w, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: reduce === 'reduce' ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// scroll through to trigger reveals + lazy imgs
await page.evaluate(async () => {
  await new Promise(res => {
    let y = 0; const step = () => {
      window.scrollBy(0, 700); y += 700;
      if (y < document.body.scrollHeight + 1500) setTimeout(step, 60); else res();
    }; step();
  });
});
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
// measurements
const m = await page.evaluate(() => {
  const bb = document.querySelector('.bbrec');
  const italics = [...document.querySelectorAll('.bbrec *')].filter(el => {
    const cs = getComputedStyle(el);
    if (cs.fontStyle !== 'italic') return false;
    // exclude testimonial pull-quotes (.pf-quote allowed) and empty
    if (el.closest('.pf-quote')) return false;
    if (!el.textContent.trim()) return false;
    // only leaf-ish
    return el.children.length === 0 || [...el.childNodes].some(n => n.nodeType===3 && n.textContent.trim());
  }).map(el => ({ cls: el.className, txt: el.textContent.trim().slice(0,40) }));
  const overflow = document.body.scrollWidth > window.innerWidth + 1;
  return {
    hasBB: !!bb,
    docWidth: document.body.scrollWidth,
    winWidth: window.innerWidth,
    overflow,
    italicCount: italics.length,
    italics: italics.slice(0, 12),
    sections: [...document.querySelectorAll('.bbrec [id^=cs-]')].map(e=>e.id),
    actmarks: [...document.querySelectorAll('.actmark')].map(e=>e.querySelector('.act-title')?.textContent),
  };
});
console.log(JSON.stringify({ errors: errors.slice(0,20), ...m }, null, 2));
await browser.close();
