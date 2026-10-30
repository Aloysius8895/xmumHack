import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {startRun,executeRun} from './runner.js';
import {summarize} from './analytics.js';
import {openBrowserSession,browserStatus} from './browser-session.js';
import {jsearchSettings} from './provider-env.js';
import {parseIncremental,fetchState} from './incremental.js';
const MAX_BODY=2*1024*1024;
export function makeServer(store,config,{token=process.env.CRAWLER_TOKEN,execute=executeRun,afterRun=async()=>{},loadState=fetchState}={}){
 if(!token||token.length<24)throw new Error('Set CRAWLER_TOKEN to at least 24 random characters');
 const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
 return createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/health'&&req.method==='GET')return send(res,200,{ok:true,service:'careersphere-crawler',platformRestricted:config.platformRestricted===true,platforms:config.sources.filter(s=>s.enabled).map(s=>s.id),
    browserSources:config.sources.some(s=>s.enabled&&(s.type==='browser'||s.transport==='browser')),lastSuccessfulRunAt:store.runs(store.latestRun()?.scope??'').filter(r=>['complete','capped'].includes(r.status)||(r.status==='partial'&&r.report?.publishable)).at(-1)?.finished_at??null,jsearch:{enabled:config.sources.some(s=>s.enabled&&(s.type==='jsearch'||s.transport==='jsearch')),configured:Boolean(jsearchSettings().key)},performance:{sourceConcurrency:config.maxSourceConcurrency||1,publicIntervalMs:config.requestIntervalMs,jsearchIntervalMs:config.jsearchRequestIntervalMs??config.requestIntervalMs}});
   const expected=Buffer.from('Bearer '+token),actual=Buffer.from(req.headers.authorization||'');
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return send(res,401,{error:'Unauthorized'});
   if(req.method==='POST'&&path==='/api/browser/open')return send(res,200,await openBrowserSession());
   if(req.method==='GET'&&path==='/api/browser/status')return send(res,200,await browserStatus());
   if(req.method==='POST'&&path==='/api/crawl'){
    // The body may only carry {trigger, since, known} (incremental.js); sources and limits are configured server-side
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return send(res,413,{error:'Request body too large; sources are configured server-side'});chunks.push(chunk);}
    let incremental;
    try{const text=Buffer.concat(chunks).toString('utf8').trim();incremental=parseIncremental(text?JSON.parse(text):null);}
    catch(e){return send(res,400,{error:e instanceof SyntaxError?'Body must be JSON':e.message});}
    // Started without state (command line, older caller): ask the game; unavailable means a full collection
    if(!incremental)incremental=await loadState();
    let id;try{id=startRun(store,config);}catch(e){if(e.code==='BUSY'){const active=store.latestRun();return send(res,409,{error:'A crawl is already running',runId:active.id,status:'running',statusUrl:'/api/runs/'+active.id});}throw e;}
    send(res,202,{runId:id,status:'running',incremental:Boolean(incremental),statusUrl:'/api/runs/'+id});setImmediate(()=>execute(store,config,id,{incremental}).then(()=>afterRun(id)).catch(()=>{}));return;
   }
   if(req.method==='GET'&&path==='/api/market/summary')return send(res,200,summarize(store));
   const match=/^\/api\/runs\/([a-zA-Z0-9-]+)$/.exec(path);
   if(req.method==='GET'&&match){const r=store.run(match[1]);return send(res,r?200:404,r?{id:r.id,status:r.status,startedAt:r.started_at,finishedAt:r.finished_at,report:r.report,tasks:store.tasks(r.id),publication:store.delivery(r.id)}:{error:'Run not found'});}
   send(res,404,{error:'Not found'});
  }catch{if(!res.headersSent)send(res,500,{error:'Internal crawler error; inspect run reports'});else res.end();}
 });
}
