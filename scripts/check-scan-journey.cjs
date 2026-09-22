const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const fixture = require('../components/dev/scan-walkthrough/journey/samples.json');
const out = process.env.JOURNEY_AUDIT_DIR || '/Users/ivanmanfredi/Desktop/Ivan - Content System/audits/andrew-scan-design-2026-09-21/lead-journey-v2';
const url = 'http://127.0.0.1:4317/dev/scan-walkthrough';
const sizes = [[320,740],[360,640],[375,667],[390,844],[768,1024],[1024,768],[1180,900],[1280,900],[1440,900],[1680,1000]];
fs.mkdirSync(out,{recursive:true});
(async () => {
 const browser = await chromium.launch();
 const report = {viewports:[],errors:[],writes:[],checks:[]};
 try {
  for (const [width,height] of sizes) {
   const context = await browser.newContext({viewport:{width,height},hasTouch:width<768});
   const page = await context.newPage();
   page.on('pageerror',e=>report.errors.push({width,error:e.message}));
   await page.goto(url);await page.waitForSelector('.lm-figure');await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('dialog').count(),0);
   const geometry = await page.evaluate(() => ({overflow:document.documentElement.scrollWidth>innerWidth, samples:[...document.querySelectorAll('.sample-body,.newsletter-body')].map(el=>{const s=getComputedStyle(el);return {font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),feed:!!el.closest('.feed-post')}}),buttons:[...document.querySelectorAll('.scan-journey button,.scan-journey select')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.slice(0,40),width:r.width,height:r.height}})}));
   assert.equal(geometry.overflow,false,`overflow ${width}`);
   for(const s of geometry.samples){assert.ok(s.font>=(s.feed?14:16),`font ${width}`);assert.ok(s.line/s.font>=1.5,`line height ${width}`);}
   for(const b of geometry.buttons){assert.ok(b.width>=44&&b.height>=44,`target ${width}: ${JSON.stringify(b)}`);}
   await page.screenshot({path:path.join(out,`${width}-hero.png`)});
   for(const id of ['content','inbound','newsletter','outreach','together']) {
    await page.locator(`#${id} .chapter-heading`).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(170);
    const overlaps=await page.evaluate(()=>{const c=document.querySelector('.journey-buyer');if(!c||parseFloat(getComputedStyle(c).opacity)<.05)return false;const a=c.getBoundingClientRect();return [...document.querySelectorAll('.journey-reading')].some(el=>{const b=el.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;});});
    assert.equal(overlaps,false,`character on reading ${width} ${id}`);
    const onStep=await page.evaluate(()=>{const c=document.querySelector('.journey-buyer');if(!c||parseFloat(getComputedStyle(c).opacity)<.05)return false;const a=c.getBoundingClientRect();return [...document.querySelectorAll('.journey-step')].some(el=>{const b=el.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;});});
    assert.equal(onStep,false,`character on step badge ${width} ${id}`);
    if([390,1440].includes(width))await page.screenshot({path:path.join(out,`${width}-${id}.png`)});
   }
   // Capture actual exhibits, seams and the moving character halfway through each transition.
   if([390,1440].includes(width)){
    for(const selector of ['.journey-carousel-post','.feed-row','.li-profile','.lm-figure','.lead-card','.journey-email-issue','.li-thread','.sg-proof','.sysmap','.journey-close']){
     await page.locator(selector).first().evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(900);await page.screenshot({path:path.join(out,`${width}-${selector.slice(1).replace(/[^a-z-]/g,'')}.png`)});
    }
   }
   report.viewports.push({width,height,sampleCount:geometry.samples.length,buttonCount:geometry.buttons.length,overflow:false});
   await context.close();
  }
  for(const reduced of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:reduced?'reduce':'no-preference',hasTouch:true,acceptDownloads:true});const page=await context.newPage();
   await page.goto(url);await page.waitForSelector('.lm-figure');
   page.on('request',req=>{if(['POST','PUT','PATCH','DELETE'].includes(req.method()))report.writes.push({method:req.method(),url:req.url()});});
   const written=fixture.samples.posts.map((p,i)=>({p,i})).filter(({p})=>!(p.slides&&p.slides.length)).slice(0,3);assert.equal(await page.locator('.feed-post').count(),written.length);
   for(let n=0;n<written.length;n++){const card=page.locator('.feed-post').nth(n);await card.getByRole('button',{name:'…more'}).click();assert.equal((await card.locator('.sample-body').innerText()).replace(/\s+/g,' '),written[n].p.body.replace(/\s+/g,' '));await card.getByRole('button',{name:'Show less'}).click();assert.equal(await card.getByRole('button',{name:'…more'}).count(),1);}
   const slides=fixture.samples.posts[0].slides;assert.ok((await page.locator('.journey-carousel-post>.sample-body').innerText()).includes(fixture.samples.posts[0].body.slice(0,40)));
   assert.equal(await page.getByRole('button',{name:'Previous slide'}).isDisabled(),true);
   for(let i=0;i<slides.length;i++){assert.equal(await page.locator('.slide-badge').innerText(),`${i+1} / ${slides.length}`);if(i<slides.length-1)await page.getByRole('button',{name:'Next slide'}).click();}
   assert.equal(await page.getByRole('button',{name:'Next slide'}).isDisabled(),true);
   await page.locator('.journey-deck').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.slide-badge').innerText(),`${slides.length-1} / ${slides.length}`);
   assert.equal(await page.locator('.li-profile h3').innerText(),fixture.founder.name);assert.equal(await page.locator('.li-featured b').innerText(),fixture.samples.lm.title);
   assert.equal(await page.locator('.lm-cover img').count(),1);for(const line of fixture.samples.lm.whats_inside)assert.ok((await page.locator('.lm-inside').innerText()).includes(line));assert.equal(await page.getByTestId('record-context').innerText(),`LinkedIn → ${fixture.samples.lm.title}`);
   assert.equal(await page.locator('.email-body h4').count(),1);assert.equal(await page.locator('.newsletter-body p').count(),2);assert.match(await page.locator('.email-footer').innerText(),/pulled The 99-1 Story Checklist\./);
   await page.locator('.li-thread').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.li-thread')?.classList.contains('is-settled'),{timeout:10000});
   for(const follow of fixture.samples.follow_ups)assert.ok((await page.locator('.li-thread').first().innerText()).includes(follow.body));
   await page.locator('.li-thread').nth(1).scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.li-thread.is-settled').length>=2,{timeout:8000});assert.ok((await page.locator('.li-thread').nth(1).innerText()).includes(fixture.samples.engager_outreach.samples[0].dm));assert.equal(await page.locator('body').innerText().then(t=>t.includes('[first name]')),false);
   await page.locator('.sg-proof').scrollIntoViewIfNeeded();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.getByRole('link',{name:'Open the library'}).count(),1);assert.ok((await page.locator('.proof-kyle').innerText()).includes('$80K/mo'));assert.equal(await page.locator('.sys-lane li').count(),6);assert.equal(await page.locator('.sys-call').count(),1);assert.ok(!(await page.locator('.journey-close').innerText()).includes('whole system'));
   report.checks.push(`Full posts, slide boundaries, keyboard, carousel card, cover and contents, one-idea newsletter, played-in LinkedIn threads and separate subscription: ${reduced?'reduced':'normal'} motion`);
   await context.close();
  }
  // Image fallback and external calculator fallback stay usable without third-party assets.
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
  await page.route('**/*avatar-andrew*',route=>route.abort());await page.route('**/scan-preview/*.jpg',route=>route.abort());await page.route('**/content-system/*.webp',route=>route.abort());
  await page.goto(url);await page.waitForSelector('.lm-figure');await page.locator('.sg-proof').scrollIntoViewIfNeeded();await page.waitForSelector('.tool-image-fallback');assert.ok((await page.locator('.journey-post .journey-avatar').first().innerText()).includes('AH'));assert.equal(await page.getByRole('link',{name:/Open the library/}).count(),2);await page.locator('.lm-figure').scrollIntoViewIfNeeded();await page.waitForSelector('.lm-cover-fallback',{timeout:8000});
  // Browser zoom equivalent: half-width CSS viewport in a 1440 physical-pixel screen.
  await page.setViewportSize({width:720,height:450});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'zoom-200-reflow.png')});
  report.checks.push('Missing images preserve text/initials and links; proof images fall back to links; 200% reflow');
  await context.close();
  assert.deepEqual(report.writes,[]);assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
