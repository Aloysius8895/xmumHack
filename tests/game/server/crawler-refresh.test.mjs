import test from 'node:test'
import assert from 'node:assert/strict'
import {createSampleRefresh,collectionTimes,nextScheduledAt,COOLDOWN_MS} from '../../../src/game/server/crawler-refresh.js'
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
const settings=()=>({baseUrl:'http://test.invalid',token:'server-only-token'})
const noWindow={readPublished:()=>null,loadPublished:async()=>null}
test('concurrent button clicks share one crawl and server-only bearer credentials',async()=>{
 let starts=0
 const refresh=createSampleRefresh({...noWindow,configuration:settings,fetchImpl:async(url,options)=>{
  assert.equal(options.headers.authorization,'Bearer server-only-token')
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin','indeed','ricebowl']})
  starts++;return json({runId:'new-run',status:'running'},202)
 }})
 const [a,b]=await Promise.all([refresh.start(),refresh.start()]);assert.equal(a.runId,b.runId);assert.equal(starts,1)
 assert.equal((await refresh.start()).shared,true);assert.equal(starts,1)
})
test('unrestricted aggregate crawler is refused before starting a collection',async()=>{
 let posts=0
 const refresh=createSampleRefresh({...noWindow,configuration:settings,fetchImpl:async(_u,o)=>{if(o.method==='POST')posts++;return json({platformRestricted:false,platforms:['jsearch']})}})
 await assert.rejects(refresh.start(),{code:'crawler-platforms-not-allowed'});assert.equal(posts,0)
})
test('202 and a finished collection are not publication success; a new click after publication creates a new sample',async()=>{
 let stage=0,starts=0
 const published=()=>({latest:{run:{id:'run-'+starts}}})
 const refresh=createSampleRefresh({configuration:settings,readPublished:published,loadPublished:async()=>published(),fetchImpl:async(url,o)=>{
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin']})
  if(o.method==='POST')return json({runId:'run-'+(++starts)},202)
  stage++;return json({id:'run-'+starts,status:stage===1?'running':'partial',report:{publishable:true,uniqueInRun:12,created:3,unavailableSources:[{id:'indeed',error:'HTTP 403'}]},publication:{status:stage<3?'publishing':'published'}})
 }})
 await refresh.start();assert.equal((await refresh.poll('run-1')).status,'running');assert.equal((await refresh.poll('run-1')).status,'publishing')
 const done=await refresh.poll('run-1');assert.equal(done.status,'published');assert.equal(done.previouslySeen,9)
 assert.equal((await refresh.start()).runId,'run-2');assert.equal(starts,2)
})
test('publication failure keeps the current snapshot and missing service returns a specific error',async()=>{
 const refresh=createSampleRefresh({...noWindow,configuration:settings,fetchImpl:async(url,o)=>url.pathname==='/health'?json({platformRestricted:true,platforms:['linkedin']}):o.method==='POST'?json({runId:'failed-run'},202):json({id:'failed-run',status:'failed',report:{},publication:{status:'pending'}})})
 await refresh.start();assert.equal((await refresh.poll('failed-run')).error,'crawler-collection-failed')
 const offline=createSampleRefresh({...noWindow,configuration:settings,fetchImpl:async()=>{throw new Error('offline')}})
 await assert.rejects(offline.start(),{code:'crawler-unavailable'})
})
test('the crawler receives the watermark and the known listings, so the run is incremental',async()=>{
 let body=null
 const window={lastSuccessfulCollectionAt:'2026-10-30T00:00:00.000Z',runs:[],postings:[{listingHash:'a'.repeat(64),sources:[{source:'linkedin',sourceId:'1'}]}]}
 const refresh=createSampleRefresh({configuration:settings,readPublished:()=>window,loadPublished:async()=>window,now:()=>Date.parse('2026-10-30T12:00:00Z'),fetchImpl:async(url,o)=>{
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin','indeed']})
  body=JSON.parse(o.body);return json({runId:'inc-run'},202)
 }})
 const started=await refresh.start()
 assert.deepEqual(body,{trigger:'refresh',since:'2026-10-30T00:00:00.000Z',known:{'linkedin:1':'a'.repeat(64)}})
 assert.equal(started.trigger,'refresh')
})
test('Refresh waits 30 minutes after any finished collection; the daily schedule does not',async()=>{
 const finished='2026-10-30T12:00:00.000Z',window={runs:[{finishedAt:finished}],postings:[]}
 let posts=0,clock=Date.parse(finished)+10*60000
 const refresh=createSampleRefresh({configuration:settings,readPublished:()=>window,loadPublished:async()=>window,now:()=>clock,fetchImpl:async(url,o)=>{
  if(url.pathname==='/health')return json({platformRestricted:true,platforms:['linkedin']})
  posts++;return json({runId:'run-'+posts},202)
 }})
 await assert.rejects(refresh.start(),error=>error.code==='crawler-cooldown'&&error.status===429&&error.detail.cooldownUntil===new Date(Date.parse(finished)+COOLDOWN_MS).toISOString())
 assert.equal(posts,0)
 assert.equal((await refresh.start({trigger:'schedule'})).trigger,'schedule');assert.equal(posts,1)
 const later=createSampleRefresh({configuration:settings,readPublished:()=>window,loadPublished:async()=>window,now:()=>Date.parse(finished)+COOLDOWN_MS+1,fetchImpl:async(url)=>url.pathname==='/health'?json({platformRestricted:true,platforms:['linkedin']}):json({runId:'after'},202)})
 assert.equal((await later.start()).runId,'after')
})
test('collection times: last finished run, cooldown end and the next 08:00 Malaysia time',()=>{
 const now=Date.parse('2026-10-30T01:00:00.000Z')   // 09:00 MYT, past today's 08:00
 assert.equal(nextScheduledAt(now,'08:00'),'2026-10-31T00:00:00.000Z')
 assert.equal(nextScheduledAt(Date.parse('2026-10-29T23:00:00.000Z'),'08:00'),'2026-10-30T00:00:00.000Z')
 assert.equal(nextScheduledAt(now,'off'),null)
 const times=collectionTimes({runs:[{finishedAt:'2026-10-30T00:50:00.000Z'}]},now)
 assert.equal(times.lastCollectedAt,'2026-10-30T00:50:00.000Z');assert.equal(times.cooldownUntil,'2026-10-30T01:20:00.000Z')
 assert.equal(collectionTimes(null,now).cooldownUntil,null)
})
