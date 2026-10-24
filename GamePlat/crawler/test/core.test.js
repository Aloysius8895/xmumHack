import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {loadConfig,scopeHash} from '../src/config.js';
import {normalize,extractSkills,canonicalUrl} from '../src/normalize.js';
import {Budget,fetchJson} from '../src/http.js';
import {parseSearch,collectJsearch} from '../src/sources/jsearch.js';
import {validateBrowserSource} from '../src/sources/browser.js';
import {Store} from '../src/store.js';
import {summarize,localDay} from '../src/analytics.js';
import {executeRun,startRun} from '../src/runner.js';
import {makeServer} from '../src/server.js';
const config=loadConfig();
const raw=(o={})=>({sourceId:'A',title:'Frontend Developer',company:'Example',location:'KL',country:'MY',description:'JavaScript, React.js, TypeScript, Node.js',url:'https://example.invalid/jobs/a',...o});
const norm=(o={},source='test')=>normalize(raw(o),source,config);
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
const withKey=async(fn)=>{const old=process.env.JSEARCH_API_KEY;process.env.JSEARCH_API_KEY='test-key';try{return await fn();}finally{if(old===undefined)delete process.env.JSEARCH_API_KEY;else process.env.JSEARCH_API_KEY=old;}};
test('country explicit; dates and salary remain unknown',()=>{assert.equal(normalize(raw({country:'SG'}),'test',config).rejection,'outside_malaysia');assert.equal(normalize(raw({country:''}),'test',config).rejection,'unknown_country');const r=norm({postedAt:'3'});assert.equal(r.postedAt,null);assert.equal(r.salary,null);assert.equal(r.role,'frontend-developer');});
test('emerging occupations stay unmapped',()=>assert.equal(norm({title:'Forward Deployed Engineer'}).role,'unmapped'));
test('ambiguous role matches remain reviewable',()=>assert.equal(norm({title:'Frontend Developer / Machine Learning Engineer'}).role,'unmapped'));
test('skill boundaries, punctuation and aliases',()=>{const r=extractSkills('C++, C#, React.js, TypeScript. Reactive, Java and NoSQL are different.',config.skills);assert.deepEqual(r.map(s=>s.id).sort(),['cpp','csharp','react','typescript']);assert.ok(r.every(s=>s.evidence&&s.requirement==='mentioned'));});
test('URLs remove tracking but preserve identity',()=>{assert.equal(canonicalUrl('https://example.invalid/jobs?id=5&utm_source=x#top'),'https://example.invalid/jobs?id=5');assert.equal(canonicalUrl('javascript:alert(1)'),null);});
test('v2 response parser fails on unexpected schema',()=>{assert.deepEqual(parseSearch({status:'OK',data:{jobs:[],cursor:null}}),{jobs:[],cursor:null});assert.throws(()=>parseSearch({data:[]}),/schema/);assert.throws(()=>parseSearch({status:'ERROR',data:{jobs:[]}}),/non-OK/);});
test('401 is not retried and no response secrets are printed',async()=>{let calls=0;await assert.rejects(fetchJson('https://example.invalid',{fetchImpl:async()=>{calls++;return new Response('SECRET',{status:401});}}),{message:'HTTP 401'});assert.equal(calls,1);});
test('429 retry consumes another request budget',async()=>{const budget=new Budget({...config,requestIntervalMs:0});let calls=0;const r=await fetchJson('https://example.invalid',{budget,fetchImpl:async()=>++calls===1?json({},429,{'retry-after':'0'}):json({ok:true})});assert.equal(r.ok,true);assert.equal(budget.count,2);});
test('budget stops additional requests',async()=>{const b=new Budget({...config,maxRequestsPerRun:1,requestIntervalMs:0});await b.take();await assert.rejects(b.take(),/budget/);});
test('cursor is forwarded; page limit becomes capped',async()=>withKey(async()=>{
 const urls=[],rows=[],tasks=[],c={...config,roles:[config.roles[0]],maxPagesPerQuery:2,requestIntervalMs:0};
 await collectJsearch({source:{id:'jsearch'},config:c,budget:new Budget(c),onRecord:r=>rows.push(r),onTask:t=>tasks.push(t),fetchImpl:async url=>{urls.push(new URL(url));return json({status:'OK',data:{jobs:[{job_id:String(urls.length)}],cursor:'cursor-'+urls.length}});}});
 assert.equal(urls[0].pathname.endsWith('/search-v2'),true);assert.equal(urls[0].searchParams.has('cursor'),false);assert.equal(urls[1].searchParams.get('cursor'),'cursor-1');assert.equal(tasks[0].status,'capped');assert.equal(rows.length,2);
}));
test('missing key is failed, never synthetic fallback',async()=>{const old=process.env.JSEARCH_API_KEY;delete process.env.JSEARCH_API_KEY;const s=new Store(':memory:');try{const id=startRun(s,config),r=await executeRun(s,config,id);assert.equal(r.status,'failed');assert.match(s.tasks(id)[0].error,/JSEARCH_API_KEY/);}finally{s.close();if(old!==undefined)process.env.JSEARCH_API_KEY=old;}});
test('record cutoff is partial, not a healthy sample',async()=>withKey(async()=>{const s=new Store(':memory:');try{const c={...config,roles:[config.roles[0]],maxRecordsPerRun:1,requestIntervalMs:0},id=startRun(s,c);const r=await executeRun(s,c,id,{fetchImpl:async()=>json({status:'OK',data:{jobs:[1,2].map(n=>({job_id:'job-'+n,job_title:'Frontend Developer',employer_name:'Example',job_country:'MY',job_description:'React '+n,job_apply_link:'https://example.invalid/jobs/'+n})),cursor:null}})});assert.equal(r.status,'partial');assert.equal(s.records(id).length,1);}finally{s.close();}}));
test('duplicates merge and revisions preserve past observations',()=>{const s=new Store(':memory:');try{const id=s.beginRun('scope',config),first=s.ingest(id,norm());s.ingest(id,norm());s.ingest(id,norm({sourceId:'B'},'second'));assert.equal(s.records(id).length,1);assert.equal(s.sources(first.id).length,2);s.finishRun(id,'complete',{});const id2=s.beginRun('scope',config),changed=s.ingest(id2,norm({description:'Python and React'}));s.finishRun(id2,'complete',{});assert.equal(changed.created,false);assert.equal(changed.changed,true);assert.match(s.records(id)[0].description,/JavaScript/);assert.equal(s.records(id2)[0].description,'Python and React');}finally{s.close();}});
test('generic apply URL does not merge different titles',()=>{const s=new Store(':memory:');try{const id=s.beginRun('scope',config);s.ingest(id,norm());s.ingest(id,norm({sourceId:'B',title:'Data Analyst',description:'SQL'}));assert.equal(s.records(id).length,2);}finally{s.close();}});
test('SQLite run lock prevents concurrent crawls',()=>{const s=new Store(':memory:');try{s.beginRun('scope',config);assert.throws(()=>s.beginRun('scope',config),/already running/);}finally{s.close();}});
test('stale lease becomes interrupted, never success',()=>{const s=new Store(':memory:');try{const id=s.beginRun('scope',config,false,'2020-01-01T00:00:00Z');s.beginRun('scope',config);assert.equal(s.run(id).status,'interrupted');}finally{s.close();}});
test('one sample cannot fabricate growth',()=>{const s=new Store(':memory:');try{const id=s.beginRun('scope',config);s.ingest(id,norm());s.finishRun(id,'complete',{});const r=summarize(s);assert.equal(r.trend.status,'insufficient_history');assert.ok(r.trend.roles.every(r=>r.growthPct===null));}finally{s.close();}});
test('14 covered days compare; failed day invalidates comparison',()=>{const s=new Store(':memory:');try{
 for(let day=1;day<=14;day++){const at='2026-10-'+String(day).padStart(2,'0')+'T01:00:00.000Z',id=s.beginRun('fixed',config,false,at);s.ingest(id,norm({sourceId:'baseline'}),at);if(day>7)s.ingest(id,norm({sourceId:'extra',description:'SQL React',url:'https://example.invalid/jobs/extra'}),at);s.finishRun(id,'complete',{},at);}
 let r=summarize(s,{now:'2026-10-15T04:00:00Z'});assert.equal(r.trend.status,'comparable');assert.equal(r.trend.roles[0].growthPct,100);
 s.db.prepare("UPDATE runs SET status='failed' WHERE started_at LIKE '2026-10-03%'").run();r=summarize(s,{now:'2026-10-15T04:00:00Z'});assert.equal(r.trend.status,'insufficient_history');assert.equal(r.trend.roles[0].growthPct,null);
 }finally{s.close();}});
test('scope captures configuration changes and MYT date boundary',()=>{assert.notEqual(scopeHash(config),scopeHash({...config,maxPagesPerQuery:3}));assert.equal(localDay('2026-10-24T18:00:00Z'),'2026-10-25');});
test('missing descriptions are excluded from skill denominator',()=>{const s=new Store(':memory:');try{const id=s.beginRun('scope',config);s.ingest(id,norm());s.ingest(id,norm({sourceId:'B',description:'',url:'https://example.invalid/jobs/b'}));s.finishRun(id,'complete',{});const r=summarize(s);assert.equal(r.sampleSize,2);assert.equal(r.descriptionCount,1);assert.equal(r.skills.find(s=>s.id==='react').ratePct,100);}finally{s.close();}});
test('unvalidated browser source is rejected',()=>assert.throws(()=>validateBrowserSource({validated:false}),/unvalidated/));
test('HTTP bearer auth and asynchronous 202 run status',async()=>{
 const s=new Store(':memory:'),token='test-token-that-is-long-enough';let executed=false;const server=makeServer(s,config,{token,execute:async(_s,_c,id)=>{executed=true;s.finishRun(id,'complete',{});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(url+'/api/market/summary')).status,401);const r=await fetch(url+'/api/crawl',{method:'POST',headers:{authorization:'Bearer '+token}});assert.equal(r.status,202);const b=await r.json();await new Promise(ok=>setImmediate(ok));assert.ok(b.runId);assert.equal(executed,true);assert.equal((await fetch(url+b.statusUrl,{headers:{authorization:'Bearer '+token}})).status,200);}
 finally{await new Promise(ok=>server.close(ok));s.close();}
});
