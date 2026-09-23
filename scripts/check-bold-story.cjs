const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const b=await chromium.launch(),errors=[],results=[];
 try {
 for(const slug of ['luiza-vass-8c','andrew-hayes-94'])for(const width of [375,768,1024,1180,1280,1440,1680]){
  const c=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:4317/dev/scan-walkthrough?slug=${slug}`);await p.locator('.branded-resource').waitFor();await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('.post-pair>article').count(),2);assert.equal(await p.locator('.post-pair .text-only-post img').count(),1);
  assert.equal(await p.locator('.magnet-promotion .magnet-cover').count(),1);assert.match(await p.locator('.magnet-cover').getAttribute('aria-label'),/Comment (TEAM|QUESTION)/);
  const pair=await p.locator('.post-pair>article').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
  if(width>900){assert.ok(pair[1].x>pair[0].x);assert.ok(Math.abs(pair[1].y-pair[0].y)<2);}else assert.ok(pair[1].y>pair[0].y);
  const text=await p.locator('.sample-story').innerText();assert.doesNotMatch(text,/Creative talent, represented|See what we’d run|Staffing Firm Placement|budget calculator|\u2014/);assert.match(text,/Signal-based cold outreach/);
  assert.ok((await p.locator('.research-receipt blockquote').innerText()).length>30);
  assert.equal((text.match(/Kyle Hunt is an agency ops coach/g)||[]).length,1);
  assert.match(await p.locator('.capture-bridge').innerText(),/If they opt in/);
  assert.equal(await p.locator('.flow-qualification .is-checked b').count(),3);
  if(slug.startsWith('luiza')){
   assert.equal(await p.evaluate(()=>document.fonts.check('700 24px "Neu Formula"')),true);
   await p.getByRole('button',{name:'Film',exact:true}).click();assert.match(await p.locator('.project-output').innerText(),/Editor/);
   await p.getByRole('button',{name:'Brand identity',exact:true}).click();assert.match(await p.locator('.project-output').innerText(),/Brand strategist/);
   assert.match(await p.locator('.scope-deliverables').innerText(),/Vector and web files/i);
   await p.getByRole('checkbox').check();
   assert.match(await p.locator('.project-team').innerText(),/Project lead · already booked/);
  }else{const before=await p.locator('.study-output blockquote').innerText();await p.getByRole('button',{name:'Renewing',exact:true}).click();assert.notEqual(await p.locator('.study-output blockquote').innerText(),before);}
  await p.locator('.resource-actions button').first().click();await p.waitForFunction(()=>document.querySelector('.resource-actions').innerText.includes('Copied'));
  const copied=await p.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.length>100);
  if(slug.startsWith('luiza')){assert.match(copied,/Project lead · already booked/);assert.match(copied,/separately/i);}else assert.match(copied,/results file/i);
  const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'Download the example'}).click();const d=await downloadPromise;assert.match(d.suggestedFilename(),/\.txt$/);assert.equal(await d.failure(),null);assert.equal(await fs.readFile(await d.path(),'utf8'),copied);
  if(slug.startsWith('luiza')){await p.getByRole('button',{name:'Film',exact:true}).click();assert.equal(await p.getByRole('checkbox').isChecked(),false);}
  await p.getByRole('button',{name:'See the next message'}).click();assert.equal(await p.locator('#outreach .sample-message').count(),3);assert.equal(await p.locator('#cold-outreach .sample-message').count(),1);
  assert.equal(await p.locator('.flow-wires animateMotion').count(),0);assert.equal(await p.locator('.flow-wire').count(),7);
  await p.locator('[data-flow="cold"]').click();assert.equal(await p.locator('[data-flow="cold"]').getAttribute('aria-pressed'),'true');assert.match(await p.locator('.flow-source-tag').innerText(),/cold outreach/);
  await p.locator('.portrait-close').scrollIntoViewIfNeeded();assert.equal(await p.getByRole('link',{name:'Book a call with me'}).getAttribute('href'),'https://calendly.com/im-ivanmanfredi/30min');
  await p.waitForFunction(()=>[...document.querySelectorAll('.founder-photo img,.closing-portrait')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${slug} ${width}`);
  results.push({slug,width});await c.close();
 }
 const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4317/dev/scan-walkthrough?slug=luiza-vass-8c');await p.locator('.lead-flow').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.lead-flow').classList.contains('is-running'));
 const time=()=>p.locator('.flow-wires').evaluate(s=>s.getCurrentTime());let a=await time();await p.waitForTimeout(500);assert.ok(await time()>a+.3,'Flow moves');
 await p.getByRole('button',{name:'Pause the lead journey'}).click();a=await time();await p.waitForTimeout(400);assert.ok(Math.abs(await time()-a)<.05,'Pause freezes motion');
 await p.getByRole('button',{name:'Play the lead journey'}).click();await p.waitForTimeout(10600);assert.match(await p.locator('.flow-source-tag').innerText(),/Warm outreach/);assert.ok(await time()>a+10,'Motion continues after a full route');
 await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(300);assert.equal(await p.locator('.flow-wires').evaluate(s=>s.animationsPaused()),true,'Motion pauses offscreen');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,results,errors},null,2));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
