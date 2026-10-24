import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameConfig} from '../src/game-config.js';
import {allowedPlatformUrl,parsePublic} from '../src/sources/public.js';
import {Store} from '../src/store.js';
import {startRun,executeRun} from '../src/runner.js';
import {exportRun} from '../src/publication.js';
const list='<div data-entity-urn="urn:li:jobPosting:123"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123"></a><h3 class="base-search-card__title">Forward Deployed Engineer</h3><h4 class="base-search-card__subtitle">Synthetic test employer</h4><span class="job-search-card__location">Kuala Lumpur, Malaysia</span><time datetime="2026-10-24"></time></div>';
test('only exact platform hosts and their subdomains are accepted',()=>{
 for(const [id,url]of [['linkedin','https://my.linkedin.com/jobs/view/1'],['indeed','https://malaysia.indeed.com/viewjob?jk=1'],['ricebowl','https://www.ricebowl.my/job/1']])assert.equal(allowedPlatformUrl(url,id),true);
 for(const url of ['https://linkedin.com.evil.invalid/jobs/1','https://evil.invalid/?linkedin.com','http://linkedin.com/jobs','https://user:secret@linkedin.com/jobs'])assert.equal(allowedPlatformUrl(url,'linkedin'),false);
});
test('public parser preserves source title, date and explicit Malaysia location; unknown HTML is not zero',async()=>{
 const result=await parsePublic(list,'linkedin-search','https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search','linkedin');
 assert.equal(result.records[0].country,'MY');assert.equal(result.records[0].postedAt,'2026-10-24');
 assert.equal((await parsePublic('<html>Sign in or verify</html>','linkedin-search','https://www.linkedin.com','linkedin')).recognized,false);
});
test('Ricebowl JobPosting JSON-LD retains original country and description',async()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Data Analyst',hiringOrganization:{name:'Synthetic'},jobLocation:{address:{addressCountry:'MY',addressLocality:'Johor'}},description:'<p>SQL and Python</p>',datePosted:'2026-10-24',url:'https://www.ricebowl.my/job/123'})+'</script>';
 const parsed=await parsePublic(html,'structured','https://www.ricebowl.my/job/123','ricebowl');assert.equal(parsed.records[0].country,'MY');assert.equal(parsed.records[0].description,'SQL and Python');
});
test('Ricebowl imported FDE template without JSON-LD uses observed job DOM and keeps dates unknown',async()=>{
 const html='<h2 class="font-bold">Forward Deployed Engineer</h2><h2 id="companyName-id-123">Synthetic employer</h2><div id="job-locations"><div class="job-locations-content">Kuala Lumpur Federal Territory Malaysia</div></div><div id="job-description"><div class="job-description-content">Python and production model deployment.</div></div>';
 const parsed=await parsePublic(html,'structured','https://www.ricebowl.my/job/ABC123-forward-deployed-engineer','ricebowl');
 assert.equal(parsed.records[0].title,'Forward Deployed Engineer');assert.equal(parsed.records[0].country,'MY');assert.equal(parsed.records[0].sourceId,'ABC123');assert.equal(parsed.records[0].postedAt,undefined);assert.ok(parsed.records[0].description.includes('Python'));
});
test('blocked sources are excluded; only a complete available-source sample is publishable',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'public-crawl-test-')),s=new Store(':memory:');
 const c={...gameConfig(),sources:gameConfig().sources.map(s=>({...s,transport:'http'})),roles:gameConfig().roles.filter(r=>r.id==='forward-deployed-engineer'),requestIntervalMs:0,maxDetailsPerSource:1};
 const urls=[];
 try{
  const id=startRun(s,c);const r=await executeRun(s,c,id,{publicOptions:{rawDirectory:pathToFileURL(root+path.sep)},fetchImpl:async url=>{urls.push(url);if(!new URL(url).hostname.endsWith('linkedin.com'))return new Response('Access blocked',{status:403});return new Response(url.includes('/api/jobPosting/')?'<div class="show-more-less-html__markup">Synthetic test only. Python and SQL.</div>':list);}});
  assert.equal(r.status,'partial');assert.equal(r.report.publishable,true);assert.deepEqual(r.config.sources.map(x=>x.id),['linkedin']);
  const payload=exportRun(s,id);assert.equal(payload.jobs.length,1);assert.equal(payload.jobs[0].role,'forward-deployed-engineer');
  assert.deepEqual(payload.summary.quality.unavailableSources.map(s=>s.id),['indeed','ricebowl']);assert.equal(payload.summary.quality.tasks.length,1);
  assert.ok(urls.every(url=>['linkedin.com','indeed.com','ricebowl.my'].some(host=>new URL(url).hostname===host||new URL(url).hostname.endsWith('.'+host))));
 }finally{s.close();}
});
test('every source blocked produces no publishable sample',async()=>{
 const s=new Store(':memory:'),c={...gameConfig(),sources:gameConfig().sources.map(s=>({...s,transport:'http'})),roles:[gameConfig().roles[0]],requestIntervalMs:0};
 try{const id=startRun(s,c),r=await executeRun(s,c,id,{fetchImpl:async()=>new Response('Blocked',{status:403})});assert.equal(r.status,'failed');assert.equal(r.report.publishable,false);assert.equal(s.records(id).length,0);}finally{s.close();}
});
test('429 follows Retry-After with one bounded retry, while 403 is not retried',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'public-retry-test-')),s=new Store(':memory:');
 const c={...gameConfig(),sources:[{id:'linkedin',type:'public',enabled:true,optional:true}],roles:[gameConfig().roles.find(r=>r.id==='forward-deployed-engineer')],requestIntervalMs:0};let calls=0;
 try{
  const id=startRun(s,c),r=await executeRun(s,c,id,{publicOptions:{rawDirectory:pathToFileURL(root+path.sep)},fetchImpl:async url=>{calls++;if(calls===1)return new Response('Limited',{status:429,headers:{'retry-after':'0'}});return new Response(url.includes('/api/jobPosting/')?'<div class="show-more-less-html__markup">Synthetic Python</div>':list);}});
  assert.equal(r.report.publishable,true);assert.equal(calls,3);assert.equal(r.report.requests,3);
 }finally{s.close();}
});
test('Ricebowl browser transport parses verified card attributes and matching details without HTTP fallback',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'browser-source-test-')),s=new Store(':memory:');
 const c={...gameConfig(),sources:[{id:'ricebowl',type:'public',transport:'browser',optional:true,enabled:true}],roles:[gameConfig().roles.find(r=>r.id==='data-analyst')],requestIntervalMs:0};
 const url='https://www.ricebowl.my/job/ABC123-data-analyst';let reads=0;
 const card='<mkrb-job-card job-id="ABC123" job-title="Data Analyst" company="Synthetic employer" locations=\'[{"label":"Selangor"}]\' posted-at="1791251262000" href="'+url+'"></mkrb-job-card>';
 const detail='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',identifier:{value:'ABC123'},title:'Data Analyst',hiringOrganization:{name:'Synthetic employer'},jobLocation:{address:{addressCountry:'MY',addressRegion:'Selangor'}},description:'SQL and Python',url:'https://employer.example.invalid/careers/ABC123'})+'</script>';
 try{const id=startRun(s,c),r=await executeRun(s,c,id,{fetchImpl:async()=>{throw new Error('HTTP must not be used')},publicOptions:{rawDirectory:pathToFileURL(root+path.sep),browserReadImpl:async(u,platform,budget)=>{assert.equal(platform,'ricebowl');await budget.take();reads++;return u.includes('/jobsearch/')?card:detail;}}});
  assert.equal(r.report.publishable,true);assert.equal(reads,2);assert.equal(s.records(id)[0].role,'data-analyst');assert.equal(s.records(id)[0].description,'SQL and Python');assert.equal(s.records(id)[0].url,url);
 }finally{s.close();}
});
