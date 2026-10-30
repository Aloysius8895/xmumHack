import {summarize} from './analytics.js';
import {fetchJson} from './http.js';

const sourceKey=s=>s.source+':'+s.sourceId;

/**
 * 1.1: every record of the run. 1.2 (incremental runs): the new and changed records as jobs, and `seen`, the
 * unchanged listings observed again, so the game refreshes their last-seen date without receiving them twice.
 */
export function exportRun(store,runId=store.latestRun()?.id){
 const r=store.run(runId);if(!r)throw new Error('Run not found');
 const enabled=s=>r.config.sources.some(source=>source.enabled&&source.id===s.source);
 const records=store.records(r.id).map(j=>({...j,sources:store.sourcesAtRun(j.id,r.id).filter(enabled)}));
 const incremental=r.report?.incremental===true,keys=r.report?.deltaKeys;
 const fresh=new Set(incremental?[...keys.new,...keys.changed]:[]),added=new Set(incremental?keys.new:[]);
 const jobs=incremental?records.filter(j=>j.sources.some(s=>fresh.has(sourceKey(s)))):records;
 const now=r.finished_at||new Date().toISOString();
 return {schemaVersion:incremental?'1.2':'1.1',idempotencyKey:r.id,isDemo:Boolean(r.demo),
  run:{id:r.id,status:r.status,scopeHash:r.scope,startedAt:r.started_at,finishedAt:r.finished_at,...(incremental?{trigger:r.report.trigger,since:r.report.since??null}:{})},
  scope:{country:r.config.country,timezone:r.config.timezone,datePosted:r.config.datePosted,pipelineVersion:r.config.pipelineVersion||1,
   roles:r.config.roles.map(x=>x.id),skills:r.config.skills.map(x=>x.id),sources:r.config.sources.filter(x=>x.enabled).map(x=>({id:x.id,type:x.type}))},
  summary:summarize(store,{runId:r.id,now,...(incremental?{rows:jobs}:{})}),jobs,
  ...(incremental?{
   seen:keys.seen.map(key=>{const at=key.indexOf(':');return {source:key.slice(0,at),sourceId:key.slice(at+1)};}).filter(enabled),
   delta:{new:jobs.filter(j=>j.sources.some(s=>added.has(sourceKey(s)))).length,changed:jobs.filter(j=>!j.sources.some(s=>added.has(sourceKey(s)))).length,
    unchanged:r.report.unchanged,skippedDetails:r.report.skippedDetails,undatedAds:r.report.undatedAds}}:{}),
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
