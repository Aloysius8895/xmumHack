import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Budget} from '../src/http.js';
import {gameConfig} from '../src/game-config.js';
import {loadConfig} from '../src/config.js';
import {Store} from '../src/store.js';
import {executeRun,startRun} from '../src/runner.js';

test('concurrent reservations share a strict total request cap',async()=>{
 const budget=new Budget({maxRequestsPerRun:3,requestIntervalMs:0,maxRunMs:5000});
 const results=await Promise.allSettled(Array.from({length:12},(_,i)=>budget.scope('lane-'+i%3).take()));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
 assert.equal(budget.count,3);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.capped));
});
test('same-provider queues preserve pacing while independent sources can start',async()=>{
 const budget=new Budget({maxRequestsPerRun:8,requestIntervalMs:50,maxRunMs:5000}),starts=[];
 const a=budget.scope('jsearch'),b=budget.scope('jsearch'),browser=budget.scope('ricebowl');
 await a.take();const first=Date.now();
 const second=b.take().then(()=>starts.push({id:'second-api',at:Date.now()}));
 await browser.take();assert.deepEqual(starts,[]);
 await second;assert.ok(starts[0].at-first>=45);assert.equal(budget.count,3);
});
test('a queued reservation cancels at the shared deadline and spends no additional budget',async()=>{
 const budget=new Budget({maxRequestsPerRun:5,requestIntervalMs:200,maxRunMs:50});
 await budget.take();await assert.rejects(budget.take());assert.equal(budget.count,1);
});
test('speed settings are bounded and older profiles remain valid',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'collection-speed-config-')),'profile.json');
 for(const overrides of [{},{maxSourceConcurrency:3,jsearchRequestIntervalMs:2500}]){
  writeFileSync(file,JSON.stringify({...gameConfig(),...overrides}));assert.ok(loadConfig(file));
 }
 for(const overrides of [{maxSourceConcurrency:4},{maxSourceConcurrency:0},{jsearchRequestIntervalMs:0}]){
  writeFileSync(file,JSON.stringify({...gameConfig(),...overrides}));assert.throws(()=>loadConfig(file),/Invalid config/);
 }
});

const withKey=async task=>{
 const previous=process.env.JSEARCH_API_KEY;process.env.JSEARCH_API_KEY='unit-test-key';
 try{return await task();}finally{if(previous===undefined)delete process.env.JSEARCH_API_KEY;else process.env.JSEARCH_API_KEY=previous;}
};
test('indexed platforms overlap browser work, share API responses and retain complete source records',async()=>withKey(async()=>{
 const store=new Store(':memory:'),rawDirectory=pathToFileURL(mkdtempSync(join(tmpdir(),'parallel-sources-'))+sep);
 const config={...gameConfig({jsearch:true}),roles:[gameConfig().roles[0]],requestIntervalMs:0,jsearchRequestIntervalMs:0};
 let release,apiStarted=false,apiCalls=0,browserCalls=0;
 const ready=new Promise(resolve=>{release=resolve;});
 const timeout=setTimeout(()=>release(),3000);
 try{
  const id=startRun(store,config),result=await executeRun(store,config,id,{
   fetchImpl:async()=>{
    apiStarted=true;apiCalls++;await ready;
    return new Response(JSON.stringify({status:'OK',data:{cursor:null,jobs:[
     {job_id:'one',job_title:'Data Analyst',employer_name:'Test LinkedIn',job_country:'MY',job_location:'Kuala Lumpur, Malaysia',job_description:'SQL and Python',job_apply_link:'https://www.linkedin.com/jobs/view/123'},
     {job_id:'two',job_title:'Data Analyst',employer_name:'Test Indeed',job_country:'MY',job_location:'Kuala Lumpur, Malaysia',job_description:'SQL',job_apply_link:'https://malaysia.indeed.com/viewjob?jk=abc'},
    ]}}));
   },
   publicOptions:{rawDirectory,browserReadImpl:async(_url,platform,budget)=>{
    await budget.take();assert.equal(platform,'ricebowl');assert.equal(apiStarted,true);browserCalls++;release();
    return '<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Data Analyst',hiringOrganization:{name:'Test Ricebowl'},jobLocation:{address:{addressCountry:'MY',addressRegion:'Selangor'}},description:'SQL and Python',url:'https://www.ricebowl.my/job/ABC123'})+'</script>';
   }},
  });
  assert.equal(result.report.publishable,true);assert.equal(apiCalls,1);assert.equal(browserCalls,1);
  assert.equal(result.report.requests,2);assert.equal(store.records(id).length,3);
  assert.deepEqual(result.config.sources.map(s=>s.id),['linkedin','indeed','ricebowl']);
  assert.deepEqual(result.report.sourceTimings.map(s=>s.id),['linkedin','indeed','ricebowl']);
 }finally{clearTimeout(timeout);store.close();}
}));
test('authentication failure stops all role queries and is shared by both platform views',async()=>withKey(async()=>{
 const store=new Store(':memory:'),config={...gameConfig({jsearch:true}),sources:gameConfig({jsearch:true}).sources.filter(s=>s.id!=='ricebowl'),roles:gameConfig().roles.slice(0,3),requestIntervalMs:0,jsearchRequestIntervalMs:0};
 let calls=0;
 try{
  const id=startRun(store,config),result=await executeRun(store,config,id,{fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}});
  assert.equal(calls,1);assert.equal(result.report.requests,1);assert.equal(result.report.publishable,false);
  assert.equal(store.tasks(id).length,2);assert.equal(store.records(id).length,0);
 }finally{store.close();}
}));
