import test from 'node:test'
import assert from 'node:assert/strict'
import {collectNewSample} from './SampleRefresh.js'
test('Refresh starts collection, polls its run and reloads state only after publication',async()=>{
 const events=[],states=['running','publishing','published'];let reloads=0,starts=0
 const api={startMarketSample:async()=>{starts++;return {runId:'sample-1',status:'running'}},marketSampleStatus:async id=>{assert.equal(id,'sample-1');return {runId:id,status:states.shift()}},refresh:async()=>{reloads++}}
 const result=await collectNewSample(api,{pause:async()=>{},onChange:run=>events.push(run.status)})
 assert.equal(result.status,'published');assert.equal(starts,1);assert.equal(reloads,1);assert.deepEqual(events,['running','running','publishing','published'])
})
test('failed collection retains state and finite polling has an explicit timeout',async()=>{
 let reloads=0
 const api={startMarketSample:async()=>({runId:'sample',status:'running'}),marketSampleStatus:async()=>({status:'failed',error:'crawler-collection-failed'}),refresh:async()=>{reloads++}}
 await assert.rejects(collectNewSample(api,{pause:async()=>{}}),{code:'crawler-collection-failed'});assert.equal(reloads,0)
 api.marketSampleStatus=async()=>({status:'running',runId:'sample'})
 await assert.rejects(collectNewSample(api,{pause:async()=>{},maxPolls:2}),{code:'crawler-refresh-timeout'});assert.equal(reloads,0)
})
