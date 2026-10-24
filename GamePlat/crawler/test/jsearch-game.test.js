import test from 'node:test';
import assert from 'node:assert/strict';
import {jsearchSettings} from '../src/provider-env.js';
import {mapPlatformJob} from '../src/sources/jsearch.js';
import {gameConfig} from '../src/game-config.js';
import {Store} from '../src/store.js';
import {executeRun,startRun} from '../src/runner.js';
const base=()=>({job_id:'provider-id',job_title:'Data Analyst',employer_name:'Test employer',job_location:'Kuala Lumpur, Malaysia',job_country:'MY',job_description:'Python and SQL',job_apply_link:'https://outside.example/jobs/1',apply_options:[]});
const config=()=>({...gameConfig({jsearch:true}),roles:gameConfig().roles.filter(r=>r.id==='data-analyst'),sources:gameConfig({jsearch:true}).sources.filter(s=>s.id!=='ricebowl'),requestIntervalMs:0});
const withKey=async task=>{const old=process.env.JSEARCH_API_KEY;process.env.JSEARCH_API_KEY='unit-test-key';try{return await task();}finally{if(old===undefined)delete process.env.JSEARCH_API_KEY;else process.env.JSEARCH_API_KEY=old;}};
test('RAPIDAPI_KEY is a server-side alias and cannot be used as an OpenWebNinja key',()=>{
 assert.equal(jsearchSettings({env:{RAPIDAPI_KEY:' test-key '},readGame:false}).key,'test-key');
 assert.equal(jsearchSettings({env:{RAPIDAPI_KEY:'test-key',JSEARCH_PROVIDER:'openwebninja'},readGame:false}).key,null);
});
test('API mapping requires a real allowed-platform job link and explicit MY country',()=>{
 const raw={...base(),apply_options:[{apply_link:'https://my.linkedin.com/jobs/view/data-analyst-123?utm_source=test'}]};
 assert.equal(mapPlatformJob(raw,'linkedin').sourceId,'123');
 assert.equal(mapPlatformJob(raw,'indeed'),null);
 assert.equal(mapPlatformJob({...raw,job_country:'SG'},'linkedin'),null);
 assert.equal(mapPlatformJob({...raw,apply_options:[{apply_link:'https://linkedin.com.evil.invalid/jobs/view/123'}]},'linkedin'),null);
 const indeed=mapPlatformJob({...base(),job_apply_link:'https://malaysia.indeed.com/viewjob?jk=abc123'},'indeed');
 assert.equal(indeed.sourceId,'abc123');assert.equal(indeed.retrievalMethod,'jsearch');
});
test('game JSearch profile retains only the three approved platform IDs',()=>{
 const c=gameConfig({jsearch:true});
 assert.equal(c.platformRestricted,true);
 assert.deepEqual(c.sources.map(s=>s.id),['linkedin','indeed','ricebowl']);
 assert.equal(c.sources.find(s=>s.id==='linkedin').transport,'jsearch');
 assert.equal(c.sources.find(s=>s.id==='ricebowl').transport,'browser');
});
test('two platform views share one API request and never ingest unrelated publisher records',async()=>withKey(async()=>{
 const store=new Store(':memory:'),c=config();let calls=0;
 try{
  const id=startRun(store,c),result=await executeRun(store,c,id,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify({status:'OK',data:{cursor:null,jobs:[
   {...base(),job_id:'one',employer_name:'Company A',job_apply_link:'https://www.linkedin.com/jobs/view/123'},
   {...base(),job_id:'two',employer_name:'Company B',job_apply_link:'https://malaysia.indeed.com/viewjob?jk=abc'},
   {...base(),job_id:'other',employer_name:'Unapproved company'},
  ]}}),{status:200});}});
  assert.equal(calls,1);assert.equal(result.report.requests,1);assert.equal(store.records(id).length,2);
  assert.deepEqual(new Set(store.records(id).flatMap(row=>store.sources(row.id).map(s=>s.source))),new Set(['linkedin','indeed']));
  assert.ok(store.records(id).every(row=>row.company!=='Unapproved company'));
 }finally{store.close();}
}));
test('no eligible indexed platform coverage stays unavailable rather than becoming observed zero',async()=>withKey(async()=>{
 const store=new Store(':memory:'),c=config();let calls=0;
 try{const id=startRun(store,c),result=await executeRun(store,c,id,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify({status:'OK',data:{jobs:[base()],cursor:null}}));}});
  assert.equal(calls,1);assert.equal(result.status,'failed');assert.equal(result.report.publishable,false);assert.equal(store.records(id).length,0);
  assert.ok(result.report.unavailableSources.every(row=>row.error.includes('coverage unavailable')));
 }finally{store.close();}
}));
test('API authentication failure stops immediately and is shared across platform views',async()=>withKey(async()=>{
 const store=new Store(':memory:'),c=config();let calls=0;
 try{const id=startRun(store,c),result=await executeRun(store,c,id,{fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}});
  assert.equal(calls,1);assert.equal(result.status,'failed');assert.equal(store.records(id).length,0);
 }finally{store.close();}
}));
