import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {gameConfig} from '../src/game-config.js';
import {scopeHash} from '../src/config.js';
import {Store} from '../src/store.js';
import {normalize} from '../src/normalize.js';
import {exportRun,publishRun} from '../src/publication.js';
import {makeServer} from '../src/server.js';
process.env.SAVE_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'crawler-game-save-'));
process.env.COLLECTED_DATA_DIR='off';
process.env.AI_MOCK='1';
process.env.INTEGRATION_TOKEN='test-game-token-only';
const {receiveCrawler,readCrawlerState,crawlerFile}=await import('../../game/server/crawler-ingestion.js');
const {crawlerMarket,crawlerStatus}=await import('../../game/server/crawler-market.js');
const {handle}=await import('../../game/server/app.js');
const {allCareers,SKILLS}=await import('../../game/server/careers.js');
const config={...gameConfig(),sources:[{id:'linkedin',type:'public',enabled:true,optional:true}]},stores=[],directories=[];
const directory=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'crawler-game-ingest-'));directories.push(root);process.env.CRAWLER_DATA_DIR=root;return root;};
after(()=>{for(const s of stores)s.close();});
const sample=(n,{at='2026-10-24T02:00:00.000Z',c=config,descriptions=true}={})=>{
 const s=new Store(':memory:');stores.push(s);
 const id=s.beginRun(scopeHash(c),c,false,at);
 for(let i=0;i<n;i++)s.ingest(id,normalize({sourceId:'ad-'+i,title:i===2?'Data Analyst':'Forward Deployed AI Engineer',company:'Test employer '+i,location:'Kuala Lumpur, Malaysia',country:'MY',
  description:descriptions&&i!==1?'Python, SQL, REST APIs, Docker. Communication and model deployment.':'',url:'https://www.linkedin.com/jobs/view/'+i,postedAt:'2026-10-01'},'linkedin',c),at);
 for(const role of c.roles)for(const query of role.queries)s.addTask(id,{source:'linkedin',query,status:'complete',pages:1,records:n,error:null});
 s.finishRun(id,'complete',{},at);
 return {store:s,id,payload:exportRun(s,id)};
};
test('game config has every current career and only game skill IDs; FDE has an explicit title rule',()=>{
 assert.deepEqual(new Set(config.roles.map(r=>r.id)),new Set(allCareers().filter(c=>!c.custom).map(c=>c.id)));
 assert.deepEqual(new Set(config.skills.map(s=>s.id)),new Set(Object.keys(SKILLS)));
 const norm=title=>normalize({title,company:'X',country:'MY',description:'Python and TensorFlow'},'jsearch',config);
 assert.equal(norm('Forward-Deployed AI Engineer').role,'forward-deployed-engineer');
 assert.equal(norm('Field Development Engineer').role,'unmapped');
 assert.equal(norm('Data Scientist').role,'data-scientist');
 assert.equal(norm('Machine Learning Engineer').role,'ml-engineer');
});
test('date-only source precision is preserved without inventing a UTC timestamp',()=>{
 assert.equal(sample(1).payload.jobs[0].postedDate,'2026-10-01');
 assert.equal(sample(1).payload.jobs[0].postedAt,null);
});
test('real export contract updates heatmap, FDE and same-career skill denominator',()=>{
 directory();const {payload}=sample(3);receiveCrawler(payload,payload.run.id);
 const market=crawlerMarket();
 assert.equal(market.postings,3);assert.equal(market.denominator,2);
 assert.equal(market.careers['forward-deployed-engineer'].postings,2);
 assert.equal(market.careers['forward-deployed-engineer'].skills.denominator,1);
 assert.equal(market.careers['forward-deployed-engineer'].skills.skills.find(s=>s.id==='python').share,100);
 assert.deepEqual(market.trends.careers.find(c=>c.id==='forward-deployed-engineer').ads,[2]);
 assert.equal(market.trends.careers.length,14);assert.equal(market.trends.crawler.weeklyTrend.status,'insufficient_history');
});
test('HTTP publication authenticates, acknowledges and deduplicates a repeated run without touching player save',async()=>{
 directory();const {store,id}=sample(3),server=createServer((req,res)=>handle(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port+'/api/integrations/crawler';
 try{
  assert.equal((await fetch(url)).status,401);
  const first=await publishRun(store,id,{url,token:process.env.INTEGRATION_TOKEN});assert.equal(first.status,'published');assert.equal(first.duplicate,false);
  const again=await publishRun(store,id,{url,token:process.env.INTEGRATION_TOKEN});assert.equal(again.duplicate,true);
  assert.equal(readCrawlerState().receipts.length,1);assert.equal(crawlerMarket().postings,3);
  assert.equal(fs.readdirSync(process.env.SAVE_DIR).length,0,'ingestion stays outside player transactions');
 }finally{await new Promise(ok=>server.close(ok));}
});
test('demo, fixtures, incomplete runs, unknown IDs and count mismatches cannot replace healthy data',()=>{
 directory();const {payload}=sample(3);receiveCrawler(payload);
 for(const mutate of [p=>{p.isDemo=true;},p=>{p.scope.sources[0].type='fixture';},p=>{p.run.status='partial';},p=>{p.scope.roles[0]='ai-engineer';},p=>{p.summary.sampleSize=999;},p=>{p.jobs[0].country='SG';},p=>{p.summary.quality.tasks[0].error='HTTP 403';}]){
  const changed=structuredClone(payload);mutate(changed);assert.throws(()=>receiveCrawler(changed));assert.equal(crawlerMarket().postings,3);
 }
});
test('a conflicting run ID, header mismatch and stale delivery are rejected',()=>{
 directory();const {payload}=sample(1);receiveCrawler(payload);
 const conflict=structuredClone(payload);conflict.jobs[0].title+=' revised';
 assert.throws(()=>receiveCrawler(conflict),{code:'crawler-run-id-conflict'});
 assert.throws(()=>receiveCrawler(payload,'another-run'),{code:'crawler-bad-run-id'});
 assert.throws(()=>receiveCrawler(sample(1,{at:'2026-09-01T00:00:00.000Z'}).payload),{code:'crawler-stale-run'});
});
test('same-month snapshots replace counts, later months append, and a scope change resets comparison',()=>{
 directory();receiveCrawler(sample(1,{at:'2026-09-01T00:00:00.000Z'}).payload);
 receiveCrawler(sample(2,{at:'2026-09-24T00:00:00.000Z'}).payload);
 receiveCrawler(sample(1,{at:'2026-10-24T00:00:00.000Z'}).payload);
 assert.deepEqual(crawlerMarket().trends.periods,['2026-09','2026-10']);
 assert.deepEqual(crawlerMarket().trends.careers.find(c=>c.id==='forward-deployed-engineer').ads,[2,1]);
 receiveCrawler(sample(1,{at:'2026-10-25T00:00:00.000Z',c:{...config,datePosted:'week'}}).payload);
 assert.deepEqual(crawlerMarket().trends.periods,['2026-10']);
});
test('uncovered roles remain unknown while a healthy observed zero stays zero',()=>{
 directory();receiveCrawler(sample(0,{c:{...config,roles:config.roles.filter(r=>r.id==='forward-deployed-engineer')}}).payload);
 const market=crawlerMarket();assert.equal(market.careers['forward-deployed-engineer'].postings,0);
 assert.equal(market.careers['data-analyst'].postings,null);
 assert.equal(market.skillMarket.sql.share,null);
});
test('corrupt publication file retains the last consistent in-memory snapshot',()=>{
 directory();receiveCrawler(sample(1).payload);assert.equal(crawlerMarket().postings,1);
 fs.writeFileSync(crawlerFile(),'{incomplete');assert.equal(crawlerMarket().postings,1);
});
test('failed backend acknowledgement is persisted and POST is not retried',async()=>{
 const {store,id}=sample(1);let calls=0;
 await assert.rejects(publishRun(store,id,{url:'http://example.invalid/ingest',token:'test',fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}}));
 assert.equal(calls,1);assert.equal(store.delivery(id).status,'failed');assert.equal(store.run(id).status,'complete');
});
test('202 starts asynchronous work, run status exposes publication, and game retains fallback until publication',async()=>{
 directory();assert.equal(crawlerStatus().usingFallback,true);
 const s=new Store(':memory:');stores.push(s);
 const server=makeServer(s,config,{token:'crawler-test-token-long-enough',execute:async(store,_c,id)=>store.finishRun(id,'complete',{}),afterRun:async id=>s.setDelivery(id,{status:'failed',error:'test publication failed'})});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port,headers={authorization:'Bearer crawler-test-token-long-enough'};
 try{
  const start=await fetch(origin+'/api/crawl',{method:'POST',headers});assert.equal(start.status,202);
  const {statusUrl}=await start.json();await new Promise(ok=>setImmediate(ok));const result=await (await fetch(origin+statusUrl,{headers})).json();
  assert.equal(result.status,'complete');assert.equal(result.publication.status,'failed');assert.equal(crawlerMarket(),null);
 }finally{await new Promise(ok=>server.close(ok));}
});
