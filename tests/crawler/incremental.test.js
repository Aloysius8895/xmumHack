import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameConfig} from '../../src/crawler/src/game-config.js';
import {scopeHash} from '../../src/crawler/src/config.js';
import {Store} from '../../src/crawler/src/store.js';
import {startRun,executeRun} from '../../src/crawler/src/runner.js';
import {exportRun} from '../../src/crawler/src/publication.js';
import {lookbackSeconds,jsearchWindow,indeedDays,effectiveConfig,parseIncremental} from '../../src/crawler/src/incremental.js';
const DAY=86400,H=3600;
const list='<div data-entity-urn="urn:li:jobPosting:123"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/123"></a><h3 class="base-search-card__title">Forward Deployed Engineer</h3><h4 class="base-search-card__subtitle">Synthetic test employer</h4><span class="job-search-card__location">Kuala Lumpur, Malaysia</span><time datetime="2026-10-24"></time></div>';
const detail='<div class="show-more-less-html__markup">Synthetic test only. Python and SQL.</div>';
const linkedinOnly=()=>{const c=gameConfig();return {...c,sources:c.sources.filter(s=>s.id==='linkedin').map(s=>({...s,transport:'http'})),roles:c.roles.filter(r=>r.id==='forward-deployed-engineer'),requestIntervalMs:0,maxDetailsPerSource:5};};
const crawl=async(store,c,incremental)=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'incremental-crawl-')),urls=[];
 const id=startRun(store,c),run=await executeRun(store,c,id,{incremental,publicOptions:{rawDirectory:pathToFileURL(root+path.sep)},
  fetchImpl:async url=>{urls.push(url);return new Response(url.includes('/api/jobPosting/')?detail:list);}});
 return {id,run,urls,payload:exportRun(store,id)};
};

test('lookback: watermark plus a 2 hour buffer, capped at 30 days; JSearch never uses the ambiguous "today"',()=>{
 const now=Date.parse('2026-10-30T12:00:00Z');
 assert.equal(lookbackSeconds(null,now),null);
 assert.equal(lookbackSeconds('2026-10-30T11:00:00Z',now),H+2*H);
 assert.equal(lookbackSeconds('2025-01-01T00:00:00Z',now),30*DAY);
 assert.deepEqual([jsearchWindow(H),jsearchWindow(3*DAY),jsearchWindow(5*DAY),jsearchWindow(20*DAY)],['3days','3days','week','month']);
 assert.deepEqual([indeedDays(H),indeedDays(2*DAY),indeedDays(10*DAY),indeedDays(20*DAY)],['1','3','14','30']);
});

test('the run window narrows the requests, never the stored config or its scope',()=>{
 const c=linkedinOnly(),narrowed=effectiveConfig(c,'2026-10-30T10:00:00Z',Date.parse('2026-10-30T12:00:00Z'));
 assert.equal(narrowed.datePosted,'3days');assert.equal(narrowed.postedWithinSeconds,4*H);
 assert.equal(c.datePosted,'month');assert.equal(effectiveConfig(c,null),c);
});

test('the crawl body accepts only trigger, since and known',()=>{
 const known={['linkedin:123']:'a'.repeat(64)};
 const parsed=parseIncremental({trigger:'refresh',since:'2026-10-30T00:00:00Z',known});
 assert.equal(parsed.trigger,'refresh');assert.equal(parsed.known.get('linkedin:123'),'a'.repeat(64));
 assert.equal(parseIncremental(null),null);
 for(const bad of [{sources:[]},{trigger:'hack'},{since:'yesterday'},{known:{'jsearch:1':'a'.repeat(64)}},{known:{'linkedin:1':'not-a-hash'}},[]])
  assert.throws(()=>parseIncremental(bad));
});

test('a known unchanged listing keeps its detail page unfetched and is reported as seen, in the same scope',async()=>{
 const store=new Store(':memory:'),c=linkedinOnly();
 try{
  const first=await crawl(store,c,{trigger:'schedule',since:null,known:new Map()});
  assert.ok(first.urls.some(u=>u.includes('/api/jobPosting/')));
  assert.equal(first.payload.schemaVersion,'1.2');assert.equal(first.payload.delta.new,1);assert.equal(first.payload.jobs.length,1);
  const hash=first.payload.jobs[0].listingHash;assert.match(hash,/^[0-9a-f]{64}$/);

  const since=new Date(Date.now()-3*H*1000).toISOString();
  const second=await crawl(store,c,{trigger:'refresh',since,known:new Map([['linkedin:123',hash]])});
  assert.equal(second.urls.filter(u=>u.includes('/api/jobPosting/')).length,0,'no detail request for the unchanged listing');
  const search=new URL(second.urls[0]);assert.match(search.searchParams.get('f_TPR'),/^r\d+$/);
  assert.ok(Number(search.searchParams.get('f_TPR').slice(1))<=5*H+60);
  assert.deepEqual([second.run.report.new,second.run.report.changed,second.run.report.unchanged,second.run.report.skippedDetails],[0,0,1,1]);
  assert.equal(second.payload.jobs.length,0);assert.deepEqual(second.payload.seen,[{source:'linkedin',sourceId:'123'}]);
  assert.equal(store.run(second.id).scope,scopeHash(c),'a dynamic window does not change the comparable scope');
 }finally{store.close();}
});

test('a listing whose search-page fields changed is fetched again and published as changed',async()=>{
 const store=new Store(':memory:'),c=linkedinOnly();
 try{
  const run=await crawl(store,c,{trigger:'refresh',since:new Date(Date.now()-H*1000).toISOString(),known:new Map([['linkedin:123','b'.repeat(64)]])});
  assert.equal(run.urls.filter(u=>u.includes('/api/jobPosting/')).length,1);
  assert.equal(run.payload.delta.changed,1);assert.equal(run.payload.jobs[0].descriptionAvailable,true);
 }finally{store.close();}
});

test('JSearch rows already known and unchanged are reported as seen instead of being sent again',async()=>{
 const old=process.env.JSEARCH_API_KEY;process.env.JSEARCH_API_KEY='unit-test-key';
 const store=new Store(':memory:'),c={...gameConfig({jsearch:true}),roles:gameConfig().roles.filter(r=>r.id==='data-analyst'),sources:gameConfig({jsearch:true}).sources.filter(s=>s.id==='linkedin'),requestIntervalMs:0,jsearchRequestIntervalMs:100};
 const job=(id,title)=>({job_id:id,job_title:title,employer_name:'Synthetic employer',job_location:'Kuala Lumpur, Malaysia',job_country:'MY',job_description:'Python and SQL',job_apply_link:'https://www.linkedin.com/jobs/view/'+id,job_posted_at_datetime_utc:'2026-10-29T01:00:00.000Z'});
 const reply=()=>new Response(JSON.stringify({status:'OK',data:{cursor:null,jobs:[job('1','Data Analyst'),job('2','Senior Data Analyst')]}}));
 try{
  const first=startRun(store,c);await executeRun(store,c,first,{incremental:{trigger:'schedule',since:null,known:new Map()},fetchImpl:async()=>reply()});
  const known=new Map(exportRun(store,first).jobs.filter(j=>j.title==='Data Analyst').map(j=>['linkedin:'+j.sources[0].sourceId,j.listingHash]));
  let asked;const second=startRun(store,c);const run=await executeRun(store,c,second,{incremental:{trigger:'refresh',since:new Date(Date.now()-H*1000).toISOString(),known},fetchImpl:async url=>{asked=new URL(url);return reply();}});
  assert.equal(asked.searchParams.get('date_posted'),'3days');
  assert.deepEqual([run.report.new,run.report.unchanged],[1,1]);
  const payload=exportRun(store,second);assert.deepEqual(payload.jobs.map(j=>j.title),['Senior Data Analyst']);assert.equal(payload.seen.length,1);
 }finally{store.close();if(old===undefined)delete process.env.JSEARCH_API_KEY;else process.env.JSEARCH_API_KEY=old;}
});

test('the daily n8n workflow starts a scheduled collection on the game and polls that run, matching the committed export',async()=>{
 const {buildWorkflow}=await import('../../src/crawler/n8n/build-workflow.js');
 const flow=buildWorkflow('https://game.example.test/');
 const start=flow.nodes.find(n=>n.id==='start'),poll=flow.nodes.find(n=>n.id==='poll');
 assert.equal(start.parameters.method,'POST');assert.equal(start.parameters.url,'https://game.example.test/api/integrations/crawl/schedule');
 assert.match(poll.parameters.url,/game\.example\.test\/api\/integrations\/crawl\/schedule\/' \+ \$\('Start scheduled collection'\)\.first\(\)\.json\.runId/);
 assert.equal(flow.active,false,'imported inactive; enabling it is a deliberate step');
 const committed=JSON.parse(fs.readFileSync(new URL('../../src/crawler/n8n/daily-crawl.json',import.meta.url),'utf8'));
 assert.deepEqual(committed,buildWorkflow(),'run node n8n/build-workflow.js after changing it');
});
test('an empty LinkedIn result page is an observed zero; sign-in walls and other pages are not',async()=>{
 const {emptyLinkedinSearch}=await import('../../src/crawler/src/sources/public.js');
 for(const empty of ['<!DOCTYPE html>\n<!---->','<!DOCTYPE html><!----><!---->',''])assert.equal(emptyLinkedinSearch(empty),true,JSON.stringify(empty));
 for(const page of ['<!DOCTYPE html><html>Sign in to see more jobs</html>','<!DOCTYPE html><!----><li>job</li>','<html></html>'])assert.equal(emptyLinkedinSearch(page),false,page);
 const store=new Store(':memory:'),c=linkedinOnly(),root=fs.mkdtempSync(path.join(os.tmpdir(),'incremental-empty-'));
 try{
  const id=startRun(store,c),run=await executeRun(store,c,id,{incremental:{trigger:'schedule',since:new Date(Date.now()-H*1000).toISOString(),known:new Map()},
   publicOptions:{rawDirectory:pathToFileURL(root+path.sep)},fetchImpl:async()=>new Response('<!DOCTYPE html>\n<!---->')});
  assert.equal(run.status,'complete');assert.equal(run.report.publishable,true);assert.equal(exportRun(store,id).jobs.length,0);
 }finally{store.close();}
});
test('cloud profile: browser platforms off, API and HTTP platforms on',()=>{
 const withApi=gameConfig({jsearch:true,browserSources:false}).sources,noApi=gameConfig({browserSources:false}).sources;
 assert.deepEqual(withApi.filter(s=>s.enabled).map(s=>s.id),['linkedin','indeed']);
 assert.deepEqual(noApi.filter(s=>s.enabled).map(s=>s.id),['linkedin']);
 assert.ok(gameConfig().sources.every(s=>s.enabled),'local default keeps every platform');
});
