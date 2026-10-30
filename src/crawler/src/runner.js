import {readFile} from 'node:fs/promises';
import {Budget} from './http.js';
import {normalize} from './normalize.js';
import {scopeHash} from './config.js';
import {collectJsearch} from './sources/jsearch.js';
import {collectBrowser} from './sources/browser.js';
import {collectPublic} from './sources/public.js';
import {effectiveConfig} from './incremental.js';
export const startRun=(store,config,demo=false)=>store.beginRun(scopeHash(config),config,demo);
/**
 * `incremental` ({trigger, since, known} from incremental.js): only adverts posted since the watermark are asked for,
 * and every accepted advert is classified against the game's known listings as new, changed or unchanged.
 */
export async function executeRun(store,base,id,{demo=false,fetchImpl,publicOptions={},incremental=null}={}){
 // The stored config keeps the scope; an incremental run only narrows the platforms' recency filters
 const config=incremental?effectiveConfig(base,incremental.since):base,known=incremental?.known??new Map();
 const started=Date.now(),budget=new Budget(config),tasks=[],healthySources=[],unavailableSources=[],requestCache=new Map(),report={received:0,accepted:0,created:0,changed:0,rejected:{},requests:0};
 const delta={new:new Set(),changed:new Set(),seen:new Set(),skippedDetails:0,undatedAds:0};
 const sources=config.sources.filter(s=>s.enabled),concurrency=Math.max(1,Math.min(3,config.maxSourceConcurrency||1));
 const heartbeat=setInterval(()=>{try{store.heartbeat(id);}catch{}},20000);heartbeat.unref();
 const commit=rawSource=>{const {raw,source}=rawSource;const r=normalize(raw,source.id,config);if(r.rejection){report.rejected[r.rejection]=(report.rejected[r.rejection]||0)+1;return;}const result=store.ingest(id,r);report.accepted++;if(result.created)report.created++;if(result.changed)report.changed++;
  if(!incremental)return;
  const key=r.source+':'+r.sourceId,status=!known.has(key)?'new':known.get(key)===r.listingHash?'seen':'changed';
  if(!delta[status].has(key)){delta[status].add(key);if(status!=='seen'&&!r.postedDate)delta.undatedAds++;}
 };
 const commitSeen=seen=>{const key=seen.source+':'+seen.sourceId;if(!delta.seen.has(key)){delta.seen.add(key);if(seen.detailSkipped)delta.skippedDetails++;}};
 const collect=async source=>{
   const staged=[],stagedSeen=[],sourceTasks=[],sourceStarted=Date.now();
   const onSeen=async seen=>{if(config.platformRestricted)stagedSeen.push(seen);else commitSeen(seen);};
   const api=source.type==='jsearch'||(source.type==='public'&&source.transport==='jsearch');
   // Shared API responses also share one pacing lane; each browser source keeps its own sequential tab.
   const sourceBudget=budget.scope(api?'jsearch':source.id,
    api?(config.jsearchRequestIntervalMs??config.requestIntervalMs):config.requestIntervalMs);
   const onTask=async t=>{tasks.push(t);sourceTasks.push(t);store.addTask(id,t);};
   const onRecord=async raw=>{
    budget.signal.throwIfAborted();if(report.received>=config.maxRecordsPerRun){const e=new Error('Record budget exhausted');e.capped=true;throw e;}
    report.received++;if(config.platformRestricted)staged.push({raw,source});else commit({raw,source});
   };
   try{
    if(api)await collectJsearch({source,config,budget:sourceBudget,onRecord,onTask,fetchImpl,requestCache,known,onSeen});
    else if(source.type==='browser')await collectBrowser({source,config,budget:sourceBudget,onRecord,onTask});
    else if(source.type==='public')await collectPublic({source,config,budget:sourceBudget,onRecord,onTask,fetchImpl,runId:id,known,onSeen,...publicOptions});
    else{if(!demo)throw new Error('Fixture source allowed only in demo mode');const rows=JSON.parse(await readFile(source.path,'utf8'));for(const row of rows)await onRecord(row);await onTask({source:source.id,query:'synthetic-fixture',status:'complete',pages:1,records:rows.length});}
   }catch(e){await onTask({source:source.id,query:'source-initialization-or-run',status:e.capped?'capped':'failed',pages:0,records:0,error:e.message});}
   if(source.transport==='jsearch'&&sourceTasks.length&&sourceTasks.every(t=>!t.error)&&!sourceTasks.some(t=>t.eligibleRecords>0))await onTask({source:source.id,query:'platform-coverage',status:'failed',pages:0,records:0,error:'JSearch returned no verifiable records for this platform; coverage unavailable'});
   const expectedSource=['jsearch','public'].includes(source.type)?config.roles.reduce((n,r)=>n+r.queries.length,0):source.type==='browser'?source.startUrls?.length||1:1;
   const healthy=sourceTasks.length===expectedSource&&sourceTasks.every(t=>['complete','capped'].includes(t.status)&&t.pages>0&&!t.error);
   return {source,staged,stagedSeen,healthy,durationMs:Date.now()-sourceStarted,error:sourceTasks.find(t=>t.error)?.error||'Incomplete source queries'};
 };
 try{
  const results=new Array(sources.length);let next=0;
  const workers=Array.from({length:Math.min(concurrency,sources.length)},async()=>{
   while(next<sources.length){const index=next++;results[index]=await collect(sources[index]);}
  });
  // Drain every worker before finalizing the run, including when a storage callback fails.
  const settled=await Promise.allSettled(workers),failure=settled.find(r=>r.status==='rejected');
  if(failure)throw failure.reason;
  // Configured order keeps provenance and scope hashes stable across different completion orders.
  for(const result of results){
   if(result.healthy){for(const row of result.staged)commit(row);for(const seen of result.stagedSeen)commitSeen(seen);healthySources.push(result.source);}
   else unavailableSources.push({id:result.source.id,optional:result.source.optional===true,error:result.error});
  }
  if(incremental)Object.assign(report,{incremental:true,trigger:incremental.trigger,since:incremental.since,lookbackSeconds:config.postedWithinSeconds??null,
   new:delta.new.size,changed:delta.changed.size,unchanged:delta.seen.size,skippedDetails:delta.skippedDetails,undatedAds:delta.undatedAds,
   deltaKeys:{new:[...delta.new],changed:[...delta.changed],seen:[...delta.seen]}});
  const expected=config.sources.filter(s=>s.enabled).reduce((n,s)=>n+(['jsearch','public'].includes(s.type)?config.roles.reduce((m,r)=>m+r.queries.length,0):s.type==='browser'?s.startUrls?.length||1:1),0);
  const failed=tasks.some(t=>t.status==='failed'||t.pages===0||t.error)||tasks.length!==expected;
  report.publishable=healthySources.length>0&&unavailableSources.every(s=>s.optional)&&Boolean(config.platformRestricted);
  report.unavailableSources=unavailableSources;
  if(report.publishable&&unavailableSources.length)store.restrictRun(id,{...base,sources:healthySources},scopeHash({...base,sources:healthySources}));
  const status=expected===0?'failed':failed?(report.accepted||report.publishable?'partial':'failed'):tasks.some(t=>t.status==='capped')?'capped':'complete';
  report.requests=budget.count;report.uniqueInRun=store.records(id).length;report.durationMs=Date.now()-started;
  report.sourceTimings=results.map(({source,durationMs})=>({id:source.id,durationMs}));
  store.finishRun(id,status,report);return store.run(id);
 }catch(e){store.finishRun(id,'failed',{...report,error:e.message,requests:budget.count,durationMs:Date.now()-started});throw e;}finally{clearInterval(heartbeat);}
}
