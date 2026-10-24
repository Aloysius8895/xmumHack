import {summarize} from './analytics.js';
import {fetchJson} from './http.js';

export function exportRun(store,runId=store.latestRun()?.id){
 const r=store.run(runId);if(!r)throw new Error('Run not found');
 return {schemaVersion:'1.1',idempotencyKey:r.id,isDemo:Boolean(r.demo),
  run:{id:r.id,status:r.status,scopeHash:r.scope,startedAt:r.started_at,finishedAt:r.finished_at},
  scope:{country:r.config.country,timezone:r.config.timezone,datePosted:r.config.datePosted,pipelineVersion:r.config.pipelineVersion||1,
   roles:r.config.roles.map(x=>x.id),skills:r.config.skills.map(x=>x.id),sources:r.config.sources.filter(x=>x.enabled).map(x=>({id:x.id,type:x.type}))},
  summary:summarize(store,{runId:r.id,now:r.finished_at||new Date().toISOString()}),jobs:store.records(r.id).map(j=>({...j,sources:store.sourcesAtRun(j.id,r.id).filter(s=>r.config.sources.some(source=>source.enabled&&source.id===s.source))})),
  sampleHistory:store.runs(r.scope).filter(x=>x.demo===r.demo&&Date.parse(x.finished_at)<=Date.parse(r.finished_at)&&(['complete','capped'].includes(x.status)||(x.status==='partial'&&x.report?.publishable))).slice(-10).reverse().map(x=>({runId:x.id,collectedAt:x.finished_at,postings:store.records(x.id).length,newAds:Number.isInteger(x.report?.created)?x.report.created:null}))};
}

export async function publishRun(store,runId,{url=process.env.BACKEND_INGEST_URL,token=process.env.BACKEND_INGEST_TOKEN,fetchImpl}={}){
 const payload=exportRun(store,runId);
 if(payload.isDemo)throw new Error('Demo records cannot be pushed to a real backend');
 if(!['complete','capped'].includes(payload.run.status)&&!(payload.run.status==='partial'&&payload.summary.quality.publishable===true))throw new Error('Refusing to push incomplete run');
 if(!url||!token)throw new Error('Configure BACKEND_INGEST_URL and BACKEND_INGEST_TOKEN');
 const u=new URL(url);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Invalid ingestion URL');
 store.setDelivery(runId,{status:'publishing'});
 try{
  const result=await fetchJson(u,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':runId},body:JSON.stringify(payload),attempts:1,fetchImpl});
  if(result.accepted!==true||result.runId!==runId)throw new Error('Unexpected backend acknowledgement');
  const delivery={status:'published',publishedAt:new Date().toISOString(),duplicate:result.duplicate===true};
  store.setDelivery(runId,delivery);return delivery;
 }catch(e){store.setDelivery(runId,{status:'failed',error:e.message});throw e;}
}

export async function autoPublish(store,runId){
 const r=store.run(runId);
 if(r.demo||(!['complete','capped'].includes(r.status)&&!(r.status==='partial'&&r.report?.publishable)))return;
 if(!process.env.BACKEND_INGEST_URL||!process.env.BACKEND_INGEST_TOKEN){store.setDelivery(runId,{status:'not_configured'});return;}
 await publishRun(store,runId);
}
