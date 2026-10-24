import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {digest} from '../config.js';
import {setTimeout as delay} from 'node:timers/promises';
import {readBrowserPage} from '../browser-session.js';
const HOSTS={linkedin:'linkedin.com',indeed:'indeed.com',ricebowl:'ricebowl.my'};
export function allowedPlatformUrl(value,platform){try{const u=new URL(value),base=HOSTS[platform];return u.protocol==='https:'&&!u.username&&!u.password&&Boolean(base)&&(u.hostname===base||u.hostname.endsWith('.'+base));}catch{return false;}}
export function parsePublic(html,mode,url,platform){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.MARKET_PYTHON||'python',['-X','utf8',fileURLToPath(new URL('./parse_public.py',import.meta.url))],{shell:false,windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.resume();
  child.on('error',()=>reject(new Error('Public parser unavailable: Python and beautifulsoup4 required')));
  child.on('close',code=>{try{if(code!==0)throw new Error();resolve(JSON.parse(output));}catch{reject(new Error('Public page parser failed'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({html,mode,url,platform}));
 });
}
export async function collectPublic({source,config,budget,onRecord,onTask,fetchImpl=fetch,runId='manual',rawDirectory,browserReadImpl=readBrowserPage}){
 if(!HOSTS[source.id])throw new Error('Platform is not allowed');
 const directory=rawDirectory||new URL('../../data/raw/'+runId+'/',import.meta.url),candidates=new Map(),groups=[];
 const read=async(url,mode)=>{
  if(!allowedPlatformUrl(url,source.id))throw new Error('URL outside allowed platform');
  let response,body;
  if(source.transport==='browser')body=Buffer.from(await browserReadImpl(url,source.id,budget));
  else {
  for(let attempt=0;attempt<2;attempt++){
   await budget.take();
   response=await fetchImpl(url,{redirect:'error',headers:{'user-agent':'Mozilla/5.0','accept-language':'en-US,en;q=0.8'},signal:AbortSignal.any([budget.signal,AbortSignal.timeout(25000)])});
   if(response.status!==429||attempt===1)break;
   const header=response.headers.get('retry-after');
   const wait=header===null?30000:/^\d+(\.\d+)?$/.test(header)?Number(header)*1000:Date.parse(header)-Date.now();
   if(!Number.isFinite(wait)||wait>60000)throw new Error('HTTP 429: Retry-After exceeds retry window');
   await response.body?.cancel();await delay(Math.max(0,wait),undefined,{signal:budget.signal});
  }
  if(!response.ok)throw new Error('HTTP '+response.status);
  if(response.url&&!allowedPlatformUrl(response.url,source.id))throw new Error('Redirect outside platform');
  body=Buffer.from(await response.arrayBuffer());
  }
  if(body.length>2000000)throw new Error('Public response too large');
  await mkdir(directory,{recursive:true});const filename=digest(url)+'.html';await writeFile(new URL(filename,directory),body,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  const parsed=await parsePublic(body.toString('utf8'),mode,url,source.id);
  if(!parsed.recognized)throw new Error('Unrecognized public page; not an observed zero');
  return {...parsed,provenance:{url,sha256:digest(body.toString('utf8')),rawFile:fileURLToPath(new URL(filename,directory))}};
 };
 for(const role of config.roles){
  const group=[];groups.push(group);
  for(const query of role.queries){
   const task={source:source.id,query,status:'running',pages:0,records:0,error:null};
   try{
    for(let page=0;page<config.maxPagesPerQuery;page++){
     let url;
     if(source.id==='linkedin'){url=new URL('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search');url.search=new URLSearchParams({keywords:query.replace(/ jobs in Malaysia$/i,''),location:'Malaysia',start:String(page*10),sortBy:'DD',f_TPR:'r'+(config.datePosted==='week'?7:30)*86400}).toString();}
     else if(source.id==='indeed'){url=new URL('https://malaysia.indeed.com/jobs');url.search=new URLSearchParams({q:query.replace(/ jobs in Malaysia$/i,''),l:'Malaysia',start:String(page*10),sort:'date',fromage:config.datePosted==='week'?'7':'30'}).toString();}
     else url=new URL('https://www.ricebowl.my/jobsearch/'+encodeURIComponent(query.replace(/ jobs in Malaysia$/i,'').toLowerCase().replace(/[^a-z0-9]+/g,'-'))+'-jobs-in-malaysia?page='+(page+1));
     const result=await read(url.href,source.id==='linkedin'?'linkedin-search':'structured');task.pages++;
     for(const row of result.records){if(!allowedPlatformUrl(row.url,source.id))continue;const key=row.sourceId||row.url;if(!candidates.has(key)){candidates.set(key,{...row,provenance:result.provenance});group.push(key);}task.records++;}
     for(const link of result.links||[])if(allowedPlatformUrl(link,source.id)&&!candidates.has(link)&&![...candidates.values()].some(row=>row.url===link)){candidates.set(link,{sourceId:link,url:link,needsDetail:true});group.push(link);}
     if(!result.records.length&&!result.links?.length){task.status='complete';break;}
     task.status='capped';
    }
   }catch(e){task.status='failed';task.error=e.message;await onTask(task);return;}
   await onTask(task);
  }
 }
 const selected=[];
 for(let i=0;selected.length<(config.maxDetailsPerSource||28)&&groups.some(g=>i<g.length);i++)for(const group of groups)if(group[i]&&selected.length<(config.maxDetailsPerSource||28))selected.push(group[i]);
 for(const key of selected){
  const row=candidates.get(key);if(row.description&&!row.needsDetail)continue;
  const detailUrl=source.id==='linkedin'?'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'+encodeURIComponent(row.sourceId):row.url;
  try{
   const result=await read(detailUrl,source.id==='linkedin'?'linkedin-detail':'structured');
   if(source.id==='linkedin'){
    const d=result.detail;if(d.closed_explicitly){candidates.delete(key);continue;}
    row.description=d.description_raw||'';row.employmentType=d.employment_type;row.detailProvenance=result.provenance;
   }else {
    const originalUrl=row.url;
    const matched=result.records.find(item=>item.url===row.url||item.sourceId===row.sourceId)??(result.records.length===1?result.records[0]:null);
    if(!matched?.description)throw new Error('Detail has no matching JobPosting data');
    Object.assign(row,matched,{url:originalUrl,provenance:result.provenance});
   }
  }catch(e){await onTask({source:source.id,query:'selected-detail',status:'failed',pages:0,records:0,error:e.message});return;}
 }
 for(const row of candidates.values())if(!row.needsDetail||row.title)await onRecord(row);
}
