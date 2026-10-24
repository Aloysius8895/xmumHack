import test from 'node:test'
import assert from 'node:assert/strict'
import {createSampleRefresh} from './crawler-refresh.js'
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
const settings=()=>({baseUrl:'http://test.invalid',token:'server-only-token'})
test('concurrent button clicks share one crawl and server-only bearer credentials',async()=>{
 let starts=0
 const refresh=createSampleRefresh({configuration:settings,fetchImpl:async(url,options)=>{
  assert.equal(options.headers.authorization,'Bearer server-only-token')
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin','indeed','ricebowl']})
  starts++;return json({runId:'new-run',status:'running'},202)
 }})
 const [a,b]=await Promise.all([refresh.start(),refresh.start()]);assert.equal(a.runId,b.runId);assert.equal(starts,1)
 assert.equal((await refresh.start()).shared,true);assert.equal(starts,1)
})
test('unrestricted aggregate crawler is refused before starting a collection',async()=>{
 let posts=0
 const refresh=createSampleRefresh({configuration:settings,fetchImpl:async(_u,o)=>{if(o.method==='POST')posts++;return json({platformRestricted:false,platforms:['jsearch']})}})
 await assert.rejects(refresh.start(),{code:'crawler-platforms-not-allowed'});assert.equal(posts,0)
})
test('202 and a finished collection are not publication success; a new click after publication creates a new sample',async()=>{
 let stage=0,starts=0
 const refresh=createSampleRefresh({configuration:settings,readPublished:()=>({latest:{run:{id:'run-'+starts}}}),fetchImpl:async(url,o)=>{
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin']})
  if(o.method==='POST')return json({runId:'run-'+(++starts)},202)
  stage++;return json({id:'run-'+starts,status:stage===1?'running':'partial',report:{publishable:true,uniqueInRun:12,created:3,unavailableSources:[{id:'indeed',error:'HTTP 403'}]},publication:{status:stage<3?'publishing':'published'}})
 }})
 await refresh.start();assert.equal((await refresh.poll('run-1')).status,'running');assert.equal((await refresh.poll('run-1')).status,'publishing')
 const done=await refresh.poll('run-1');assert.equal(done.status,'published');assert.equal(done.previouslySeen,9)
 assert.equal((await refresh.start()).runId,'run-2');assert.equal(starts,2)
})
test('publication failure keeps the current snapshot and missing service returns a specific error',async()=>{
 const refresh=createSampleRefresh({configuration:settings,fetchImpl:async(url,o)=>url.pathname==='/health'?json({platformRestricted:true,platforms:['linkedin']}):o.method==='POST'?json({runId:'failed-run'},202):json({id:'failed-run',status:'failed',report:{},publication:{status:'pending'}})})
 await refresh.start();assert.equal((await refresh.poll('failed-run')).error,'crawler-collection-failed')
 const offline=createSampleRefresh({configuration:settings,fetchImpl:async()=>{throw new Error('offline')}})
 await assert.rejects(offline.start(),{code:'crawler-unavailable'})
})
