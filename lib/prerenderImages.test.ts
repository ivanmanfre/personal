import { afterAll, beforeAll, expect, test } from 'vitest';
import http from 'node:http';
import { chromium } from 'playwright';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64');
let server: http.Server;
let browser: Awaited<ReturnType<typeof chromium.launch>>;
let origin: string;
let remoteImages = 0;
let localImages = 0;
let dataReads = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/remote.png') remoteImages++;
    if (req.url === '/local.png') localImages++;
    if (req.url === '/data') {
      dataReads++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ title: 'A growth scan for Fixture Brand' }));
      return;
    }
    if (req.url?.endsWith('.png')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(png);
      return;
    }
    const remote = origin.replace('127.0.0.1', 'localhost') + '/remote.png';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><head><meta property="og:image" content="${remote}"></head><body><h1>Report content</h1><img id="remote" src="${remote}" onerror="this.dataset.failed='true';this.style.display='none'"><img id="local" src="/local.png"><script>fetch('/data').then(r=>r.json()).then(d=>document.title=d.title)</script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch({ headless: true });
}, 30000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}, 30000);

test('prerender keeps image URLs and successful image state while avoiding external image downloads', async () => {
  const context = await browser.newContext();
  try {
    const { configurePrerenderImages } = await import('../scripts/prerender-images.mjs');
    await configurePrerenderImages(context, origin);
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    expect(remoteImages).toBe(0);
    expect(localImages).toBe(1);
    expect(dataReads).toBe(1);
    expect(await page.title()).toBe('A growth scan for Fixture Brand');
    expect(await page.locator('#remote').getAttribute('src')).toBe(origin.replace('127.0.0.1', 'localhost') + '/remote.png');
    expect(await page.locator('#remote').getAttribute('data-failed')).toBeNull();
    expect(await page.locator('#remote').isVisible()).toBe(true);
    expect(await page.locator('#remote').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toBe(origin.replace('127.0.0.1', 'localhost') + '/remote.png');
    expect(await page.locator('h1').innerText()).toBe('Report content');
  } finally {
    await context.close();
  }
});
