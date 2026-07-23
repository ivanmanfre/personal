import { chromium } from 'playwright';
const [,, url, out, sel] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => { await new Promise(r=>{let y=0;const s=()=>{window.scrollBy(0,700);y+=700;if(y<document.body.scrollHeight+1500)setTimeout(s,50);else r();};s();}); });
await page.waitForTimeout(1000);
const el = await page.$(sel);
if (!el) { console.log('NOT FOUND', sel); await browser.close(); process.exit(1); }
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await el.screenshot({ path: out });
console.log('shot', sel);
await browser.close();
