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
   await page.goto(url);await page.waitForSelector('.journey-resource');await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('dialog').count(),0);
   const geometry = await page.evaluate(() => ({overflow:document.documentElement.scrollWidth>innerWidth, samples:[...document.querySelectorAll('.sample-body,.newsletter-body')].map(el=>{const s=getComputedStyle(el);return {font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight)}}),buttons:[...document.querySelectorAll('.scan-journey button,.scan-journey select')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.slice(0,40),width:r.width,height:r.height}})}));
   assert.equal(geometry.overflow,false,`overflow ${width}`);
   for(const s of geometry.samples){assert.ok(s.font>=16,`font ${width}`);assert.ok(s.line/s.font>=1.5,`line height ${width}`);}
   for(const b of geometry.buttons){assert.ok(b.width>=44&&b.height>=44,`target ${width}: ${JSON.stringify(b)}`);}
   await page.screenshot({path:path.join(out,`${width}-hero.png`)});
   for(const id of ['content','inbound','newsletter','outreach','together']) {
    await page.locator(`#${id} .chapter-heading`).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(170);
    const overlaps=await page.evaluate(()=>{const c=document.querySelector('.journey-buyer');if(!c)return false;const a=c.getBoundingClientRect();return [...document.querySelectorAll('.journey-reading')].some(el=>{const b=el.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;});});
    assert.equal(overlaps,false,`character on reading ${width} ${id}`);
    const onStep=await page.evaluate(()=>{const c=document.querySelector('.journey-buyer');if(!c)return false;const a=c.getBoundingClientRect();return [...document.querySelectorAll('.journey-step')].some(el=>{const b=el.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;});});
    assert.equal(onStep,false,`character on step badge ${width} ${id}`);
    if([390,1440].includes(width))await page.screenshot({path:path.join(out,`${width}-${id}.png`)});
   }
   // Capture actual exhibits, seams and the moving character halfway through each transition.
   if([390,1440].includes(width)){
    for(const selector of ['.journey-slide','.resource-browser','.request-demo','.journey-email-issue','.journey-thread:not(.journey-thread-engager)','.journey-thread-engager','.sg-client-tools']){
     await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(900);await page.screenshot({path:path.join(out,`${width}-${selector.slice(1).replace(/[^a-z-]/g,'')}.png`)});
    }
    for(let i=0;i<5;i++){
     const y=await page.locator('[data-journey-transition]').nth(i).evaluate(el=>el.getBoundingClientRect().top+scrollY+50-innerHeight*.64);
     await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(30);await page.screenshot({path:path.join(out,`${width}-transition-${i+1}.png`)});
    }
   }
   report.viewports.push({width,height,sampleCount:geometry.samples.length,buttonCount:geometry.buttons.length,overflow:false});
   await context.close();
  }
  for(const reduced of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:reduced?'reduce':'no-preference',hasTouch:true,acceptDownloads:true});const page=await context.newPage();
   await page.goto(url);await page.waitForSelector('.journey-resource');
   page.on('request',req=>{if(['POST','PUT','PATCH','DELETE'].includes(req.method()))report.writes.push({method:req.method(),url:req.url()});});
   const select=page.locator('#journey-post');
   for(let i=0;i<fixture.samples.posts.length;i++){await select.selectOption(String(i));await select.focus();assert.equal(await select.evaluate(el=>el===document.activeElement),true);assert.equal((await page.locator('.journey-post>.sample-body').innerText()).replace(/\s+/g,' '),fixture.samples.posts[i].body.replace(/\s+/g,' '));}
   const slides=fixture.samples.posts[0].slides;
   assert.equal(await page.getByRole('button',{name:'Previous slide'}).isDisabled(),true);
   for(let i=0;i<slides.length;i++){assert.equal(await page.locator('.slide-copy h3').innerText(),slides[i].heading);assert.equal(await page.locator('.slide-copy .sample-body').innerText(),slides[i].body);if(i<slides.length-1)await page.getByRole('button',{name:'Next slide'}).click();}
   assert.equal(await page.getByRole('button',{name:'Next slide'}).isDisabled(),true);
   await page.locator('.journey-deck').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.slide-copy h3').innerText(),slides[4].heading);
   const pick=(tier)=>page.locator(`.tier-picker input[value=${tier}]`).check({force:true});
   await pick('high');assert.equal(await page.getByTestId('record-context').innerText(),'84 / 100 · Advanced');assert.match(await page.getByTestId('followup-context').innerText(),/landed in Advanced/);
   await page.getByRole('button',{name:'Show the example lead'}).click();assert.equal(await page.locator('.newsletter-optin input').isChecked(),false);
   await page.locator('.newsletter-optin input').check();assert.equal(await page.getByRole('button',{name:/Example lead recorded/}).isDisabled(),true);
   await pick('low');assert.equal(await page.getByRole('button',{name:'Show the example lead'}).isEnabled(),true);assert.equal(await page.locator('.newsletter-optin input').isChecked(),true);assert.equal(await page.locator('.conversation-context>p').innerText(),'Alex · 31 / 100 · Developing');
   assert.equal(await page.locator('.resource-browser iframe').count(),0);assert.equal(await page.getByRole('link',{name:'Open the live assessment'}).count(),1);
   for(const name of fixture.assessment.sections)assert.ok((await page.locator('.resource-sections').innerText()).includes(name));
   assert.equal(await page.locator('.email-body>section').count(),3);assert.equal(await page.locator('.newsletter-cta').innerText(),'Reply with those three lines. I’ll tell you where I got curious.');assert.match(await page.locator('.email-footer').innerText(),/took The 99-1 Readiness Score\./);
   assert.ok(!(await page.locator('.journey-thread').first().innerText()).includes(fixture.samples.follow_ups[1].body));await page.getByRole('button',{name:/Show the next two messages/}).click();
   for(const follow of fixture.samples.follow_ups)assert.ok((await page.locator('.journey-thread').first().innerText()).includes(follow.body));
   assert.ok((await page.locator('.journey-thread-engager').innerText()).includes(fixture.samples.engager_outreach.samples[0].dm));assert.equal(await page.locator('body').innerText().then(t=>t.includes('[first name]')),false);
   assert.match(await page.locator('.thread-tag').first().innerText(),/warm outreach/i);
   await page.locator('.sg-client-tools').scrollIntoViewIfNeeded();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.getByRole('link',{name:'Open the real page'}).count(),1);
   if(reduced)assert.equal(await page.locator('.journey-buyer').count(),0);
   report.checks.push(`Full posts, slide boundaries, keyboard, shared tier, email issue, LinkedIn thread and separate subscription: ${reduced?'reduced':'normal'} motion`);
   await context.close();
  }
  // Image fallback and external calculator fallback stay usable without third-party assets.
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
  await page.route('**/*avatar-andrew*',route=>route.abort());await page.route('**/scan-preview/*.jpg',route=>route.abort());await page.route('https://resources.risedtc.com/**',route=>route.abort());
  await page.goto(url);await page.waitForSelector('.journey-resource');await page.locator('.sg-client-tools').scrollIntoViewIfNeeded();await page.waitForSelector('.tool-image-fallback');assert.ok((await page.locator('.journey-post .journey-avatar').innerText()).includes('AH'));await page.getByRole('button',{name:'Try the live calculator'}).click();assert.equal(await page.getByRole('link',{name:'Open ROAS calculator in a new tab'}).count(),1);await page.getByRole('button',{name:'Back to preview'}).click();
  await page.getByRole('button',{name:'Try the live assessment'}).click();assert.equal(await page.locator('.resource-browser iframe').count(),1);await page.getByRole('button',{name:'Back to the preview'}).click();assert.equal(await page.locator('.resource-browser iframe').count(),0);
  // Browser zoom equivalent: half-width CSS viewport in a 1440 physical-pixel screen.
  await page.setViewportSize({width:720,height:450});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'zoom-200-reflow.png')});
  report.checks.push('Missing images preserve text/initials and links; blocked live embed retains external action; live assessment toggles; 200% reflow');
  await context.close();
  assert.deepEqual(report.writes,[]);assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
