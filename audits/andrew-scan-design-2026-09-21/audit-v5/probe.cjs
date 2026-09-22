const { chromium } = require(require('path').join(process.env.HOME, '.claude/skills/playwright-driver/node_modules/playwright'));
const fs = require('fs');
const out = process.argv[2];
const pages = { 'new-luiza': 'http://localhost:4317/dev/scan-walkthrough?slug=luiza-vass-8c', 'old-luiza': 'https://inboundonsteroids.com/scan/luiza-vass-8c/', 'new-andrew': 'http://localhost:4317/dev/scan-walkthrough?slug=andrew-hayes-94', 'old-andrew': 'https://inboundonsteroids.com/scan/andrew-hayes-94/' };
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [name, url] of Object.entries(pages)) {
    for (const vp of [[1440, 900], [375, 812]]) {
      const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, reducedMotion: 'reduce' });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
      await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
      // settle: scroll through slowly so lazy/in-view content mounts, then back to top
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += vp[1] / 2) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
      await p.waitForTimeout(1200);
      const r = await p.evaluate(async (vh) => {
        const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
        const inPlatform = el => !!el.closest('[data-mockup="linkedin"],[data-mockup="email"],[data-mockup="browser"],.journey-post,.li-profile,.li-thread,.journey-email-issue,.journey-carousel-post,.feed-post,.figframe,.rounded-lg');
        const all = [...document.querySelectorAll('body *')].filter(vis);
        const RED = 'rgb(200, 54, 27)';
        const reds = []; const shadows = []; const radius = []; const fonts = {};
        for (const el of all) {
          const s = getComputedStyle(el); const plat = inPlatform(el);
          const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!plat) {
            if (s.backgroundColor === RED || (own && s.color === RED) || s.borderTopColor === RED && parseFloat(s.borderTopWidth) >= 2 || s.borderBottomColor === RED && parseFloat(s.borderBottomWidth) >= 2) reds.push((el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName) + ':' + (el.innerText || '').trim().slice(0, 40).replace(/\n/g, ' '));
            if (s.boxShadow !== 'none') shadows.push((typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName) + ' ' + s.boxShadow.slice(0, 40));
            const rad = parseFloat(s.borderTopLeftRadius); if (rad > 0 && !/avatar|face|dot|rail|img/i.test(el.className + el.tagName)) radius.push((typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName) + ' ' + rad);
          }
          if (own && !plat) { const f = s.fontFamily.split(',')[0].replace(/"/g, ''); fonts[f] = (fonts[f] || 0) + (el.innerText || '').trim().split(/\s+/).length; }
        }
        const h = [...document.querySelectorAll('h1,h2')].filter(vis).map(e => e.tagName + ': ' + e.innerText.replace(/\n/g, ' ').trim().slice(0, 110));
        const H = document.documentElement.scrollHeight;
        const ctas = [...document.querySelectorAll('a[href*="calendly"]')].filter(vis).map(a => Math.round((a.getBoundingClientRect().top + scrollY) / H * 100) + '% ' + a.innerText.trim().slice(0, 30));
        // settled words per viewport
        const wpv = [];
        for (let y = 0; y < H; y += vh / 2) {
          window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let w = 0, n;
          while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const pe = n.parentElement; if (!pe || !vis(pe)) continue; const rr = pe.getBoundingClientRect(); if (rr.bottom > 0 && rr.top < vh && parseFloat(getComputedStyle(pe).opacity) > .2) w += t.split(/\s+/).length; }
          wpv.push(w);
        }
        const words = document.body.innerText.trim().split(/\s+/).length;
        return { h, ctas, reds: [...new Set(reds)], redCount: new Set(reds).size, shadows: [...new Set(shadows)], radius: [...new Set(radius)].slice(0, 15), fonts, wpvMean: Math.round(wpv.reduce((a, b) => a + b, 0) / wpv.length), wpvMax: Math.max(...wpv), wpvOver130: wpv.filter(x => x > (vh > 850 ? 130 : 90)).length, wpvN: wpv.length, words, H };
      }, vp[1]);
      r.errors = errs.slice(0, 5);
      res[`${name}-${vp[0]}`] = r; await ctx.close();
      console.error('done', name, vp[0]);
    }
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1)); await b.close();
})();
