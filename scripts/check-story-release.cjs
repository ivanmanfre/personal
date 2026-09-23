const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch(),errors=[],results=[];try{
 for(const slug of ['luiza-vass-8c','andrew-hayes-94','nerijus-danilevicius-43'])for(const width of [375,1440]){
 const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:4317/dev/scan-release?slug=${slug}`);await p.locator('.portrait-close').waitFor();await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('.post-pair article').count(),2);assert.ok(await p.locator('.research-receipt blockquote').count());
 assert.equal(await p.locator('.audit-opening').getAttribute('data-assessment'),slug.startsWith('nerijus')?'zero-buyers':'unclassified');
 const text=await p.locator('main').innerText();if(!slug.startsWith('luiza'))assert.doesNotMatch(text,/Luiza|creative talent reps|beauty launch|neu\./);if(!slug.startsWith('andrew'))assert.doesNotMatch(text,/Andrew|CueVu|skincare brands/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${slug} ${width}`);
 for(const [label,selector]of [['hero','.audit-opening'],['resource','.branded-resource'],['map','.lead-flow']]){await p.locator(selector).scrollIntoViewIfNeeded();await p.locator(selector).screenshot({path:`/tmp/release-${slug}-${width}-${label}.png`})}
 results.push({slug,width,heading:await p.locator('h1').innerText()});await p.close();
 }
 const p=await b.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
 for(const [scenario,state]of [['zero-buyers','zero-buyers'],['network','network'],['no-posts','no-posts'],['no-engagement','no-engagement'],['missing-audit','unavailable'],['missing-rubric','unclassified'],['invalid-counts','unclassified'],['broken-avatar','unclassified']]){
 await p.goto(`http://127.0.0.1:4317/dev/scan-release?slug=luiza-vass-8c&case=${scenario}`);await p.locator('.portrait-close').waitFor();assert.equal(await p.locator('.audit-opening').getAttribute('data-assessment'),state);assert.match(await p.locator('.release-review-bar').innerText(),/TEST SCENARIO/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(scenario==='no-posts')assert.equal(await p.locator('.research-receipt blockquote').count(),0);
 }
 await p.goto('http://127.0.0.1:4317/dev/scan-release?slug=rachel-woods-b5');await p.getByRole('heading',{name:'This scan needs an editorial version.'}).waitFor();assert.equal(await p.locator('.sample-story').count(),0);
 await p.goto('http://127.0.0.1:4317/dev/scan-release?slug=not-a-real-scan');await p.getByRole('alert').waitFor();assert.equal(await p.locator('.sample-story').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,results,scenarios:8,missingDraftAndSlug:true,errors},null,2));
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
