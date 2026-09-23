const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  try {
    for (const slug of ['luiza-vass-8c','andrew-hayes-94','nerijus-danilevicius-43']) {
      for (const width of [320,375,390,768,1024,1180,1280,1440,1680]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`http://127.0.0.1:4317/dev/scan-release?slug=${slug}`);
        await page.locator('.audit-receipt').waitFor();
        const hero = await page.locator('h1').innerText();
        assert.match(hero, slug.startsWith('luiza') ? /37 people engaged/ : slug.startsWith('andrew') ? /13 people engaged/ : /Reach buyers beyond/);
        assert.doesNotMatch(hero, /reached|next conversation/);
        const fullCopy = await page.locator('.sample-story').innerText();
        assert.match(fullCopy, /qualified calls/i);
        assert.doesNotMatch(fullCopy, /\u2014|here’s your next conversation|Let’s make this your LinkedIn|Staffing Firm Placement|Story Checklist/);
        assert.equal(await page.locator('[data-flow]').count(), 7);
        assert.equal(await page.locator('.flow-wire').count(), 7);
        const slides = [];
        for (let i = 0; i < 6; i++) {
          const text = await page.locator('.bespoke-slide').innerText(); slides.push(text);
          assert.doesNotMatch(text, /carousel/i);
          assert.ok(text.length > 100);
          const clipped = await page.locator('.bespoke-slide').evaluate(e => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2);
          assert.equal(clipped, false, `Slide clipped ${slug} ${width} ${i}`);
          if (width === 375) await page.locator('.bespoke-slide').screenshot({path:`/tmp/revenue-final-${slug}-slide-${i}.png`});
          if (i < 5) await page.getByRole('button', { name: 'Next slide', exact: true }).click();
        }
        if (width === 375) fs.writeFileSync(`/tmp/revenue-${slug}-extracted-slides.txt`, slides.join('\n\n'));
        await page.locator('#together').evaluate(e=>e.scrollIntoView());
        const collisions = await page.locator('.flow-board').evaluate(root => {
          const base = root.getBoundingClientRect(), hits = [];
          const nodes = [...root.querySelectorAll('[data-flow]')].map(n=>({ id:n.dataset.flow, r:n.getBoundingClientRect() }));
          for (const path of root.querySelectorAll('.flow-wire')) {
            for(let n=3;n<path.getTotalLength()-3;n+=3) {
              const p=path.getPointAtLength(n), x=p.x+base.left, y=p.y+base.top;
              for(const node of nodes) if(node.id!==path.dataset.from&&node.id!==path.dataset.to&&x>node.r.left+2&&x<node.r.right-2&&y>node.r.top+2&&y<node.r.bottom-2) hits.push(`${path.dataset.from}->${path.dataset.to} crosses ${node.id}`);
            }
          }return [...new Set(hits)];
        });
        assert.deepEqual(collisions, [], `${slug} ${width} diagram connector collision`);
        for (const source of ['content','signals','cold']) {
          await page.locator(`[data-flow="${source}"]`).press('Enter');
          assert.equal(await page.locator(`[data-flow="${source}"]`).getAttribute('aria-pressed'), 'true');
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if ([375,1440].includes(width)) {
          await page.locator('.lead-flow').screenshot({path:`/tmp/revenue-final-${slug}-${width}-diagram.png`});
          await page.locator('.lead-tool').screenshot({path:`/tmp/revenue-final-${slug}-${width}-magnet.png`});
          await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/revenue-final-${slug}-${width}-hero.png`});
        }
        results.push({slug,width,height:await page.evaluate(()=>document.documentElement.scrollHeight),slides:slides.length,connectorCollisions:collisions});
        await page.close();
      }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok:true,results,errors},null,2));
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e);process.exit(1); });
