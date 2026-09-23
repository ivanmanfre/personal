const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
const rows=JSON.parse(fs.readFileSync('components/scan/story/__fixtures__/review-rows.json','utf8'));
(async()=>{const b=await chromium.launch();try{for(const row of rows){
 const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const payload=JSON.parse(fs.readFileSync(`audits/andrew-scan-design-2026-09-21/revenue-story/release/${row.company_slug}.json`));
 const complete={...row,id:'local-test',status:'complete',matched_offer:'content_system',report_json:{...row.report_json,content_system:{...row.report_json.content_system,story_v1:{...payload.story_v1,reviewStatus:'approved'}}}};
 await p.route('**/rest/v1/scans?**',r=>r.fulfill({json:complete,headers:{'access-control-allow-origin':'*'}}));
 await p.goto(`http://127.0.0.1:4317/scan/${row.company_slug}/`);await p.locator('.portrait-close').waitFor();
 assert.match(await p.title(),/qualified calls/);assert.match(await p.locator('meta[name=robots]').last().getAttribute('content'),/noindex/);assert.equal(await p.locator('.release-review-bar').count(),0);assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),`https://inboundonsteroids.com/scan/${row.company_slug}/`);assert.equal(await p.locator('meta[property="og:image"]').getAttribute('content'),row.report_json.content_system.og_image_url);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log(`${row.company_slug}: production route, metadata, mobile layout pass (intercepted test data)`);await p.close();
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
