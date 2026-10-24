import {readFile} from 'node:fs/promises';
import {Budget} from './http.js';
import {normalize} from './normalize.js';
import {scopeHash} from './config.js';
import {collectJsearch} from './sources/jsearch.js';
import {collectBrowser} from './sources/browser.js';
import {collectPublic} from './sources/public.js';
export const startRun=(store,config,demo=false)=>store.beginRun(scopeHash(config),config,demo);
export async function executeRun(store,config,id,{demo=false,fetchImpl,publicOptions={}}={}){
 const budget=new Budget(config),tasks=[],healthySources=[],unavailableSources=[],requestCache=new Map(),report={received:0,accepted:0,created:0,changed:0,rejected:{},requests:0};
 const heartbeat=setInterval(()=>{try{store.heartbeat(id);}catch{}},20000);heartbeat.unref();
 const commit=rawSource=>{const {raw,source}=rawSource;const r=normalize(raw,source.id,config);if(r.rejection){report.rejected[r.rejection]=(report.rejected[r.rejection]||0)+1;return;}const result=store.ingest(id,r);report.accepted++;if(result.created)report.created++;if(result.changed)report.changed++;};
 try{
  for(const source of config.sources.filter(s=>s.enabled)){
   const staged=[],sourceTasks=[];
   const onTask=async t=>{tasks.push(t);sourceTasks.push(t);store.addTask(id,t);};
   const onRecord=async raw=>{
    budget.signal.throwIfAborted();if(report.received>=config.maxRecordsPerRun){const e=new Error('Record budget exhausted');e.capped=true;throw e;}
    report.received++;if(config.platformRestricted)staged.push({raw,source});else commit({raw,source});
   };
   try{
    if(source.type==='jsearch'||(source.type==='public'&&source.transport==='jsearch'))await collectJsearch({source,config,budget,onRecord,onTask,fetchImpl,requestCache});
    else if(source.type==='browser')await collectBrowser({source,config,budget,onRecord,onTask});
    else if(source.type==='public')await collectPublic({source,config,budget,onRecord,onTask,fetchImpl,runId:id,...publicOptions});
    else{if(!demo)throw new Error('Fixture source allowed only in demo mode');const rows=JSON.parse(await readFile(source.path,'utf8'));for(const row of rows)await onRecord(row);await onTask({source:source.id,query:'synthetic-fixture',status:'complete',pages:1,records:rows.length});}
   }catch(e){await onTask({source:source.id,query:'source-initialization-or-run',status:e.capped?'capped':'failed',pages:0,records:0,error:e.message});}
   if(source.transport==='jsearch'&&sourceTasks.length&&sourceTasks.every(t=>!t.error)&&!sourceTasks.some(t=>t.eligibleRecords>0))await onTask({source:source.id,query:'platform-coverage',status:'failed',pages:0,records:0,error:'JSearch returned no verifiable records for this platform; coverage unavailable'});
   const expectedSource=['jsearch','public'].includes(source.type)?config.roles.reduce((n,r)=>n+r.queries.length,0):source.type==='browser'?source.startUrls?.length||1:1;
   if(sourceTasks.length===expectedSource&&sourceTasks.every(t=>['complete','capped'].includes(t.status)&&t.pages>0&&!t.error)){
    for(const row of staged)commit(row);healthySources.push(source);
   }else unavailableSources.push({id:source.id,optional:source.optional===true,error:sourceTasks.find(t=>t.error)?.error||'Incomplete source queries'});
  }
  const expected=config.sources.filter(s=>s.enabled).reduce((n,s)=>n+(['jsearch','public'].includes(s.type)?config.roles.reduce((m,r)=>m+r.queries.length,0):s.type==='browser'?s.startUrls?.length||1:1),0);
  const failed=tasks.some(t=>t.status==='failed'||t.pages===0||t.error)||tasks.length!==expected;
  report.publishable=healthySources.length>0&&unavailableSources.every(s=>s.optional)&&Boolean(config.platformRestricted);
  report.unavailableSources=unavailableSources;
  if(report.publishable&&unavailableSources.length)store.restrictRun(id,{...config,sources:healthySources},scopeHash({...config,sources:healthySources}));
  const status=expected===0?'failed':failed?(report.accepted||report.publishable?'partial':'failed'):tasks.some(t=>t.status==='capped')?'capped':'complete';
  report.requests=budget.count;report.uniqueInRun=store.records(id).length;store.finishRun(id,status,report);return store.run(id);
 }catch(e){store.finishRun(id,'failed',{...report,error:e.message,requests:budget.count});throw e;}finally{clearInterval(heartbeat);}
}
