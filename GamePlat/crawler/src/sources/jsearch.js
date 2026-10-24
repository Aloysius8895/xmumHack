import {fetchJson} from '../http.js';
import {jsearchSettings} from '../provider-env.js';
import {allowedPlatformUrl} from './public.js';
export function parseSearch(p){if(p?.status&&p.status!=='OK')throw new Error('Provider returned non-OK status');if(!p?.data||!Array.isArray(p.data.jobs))throw new Error('Unexpected JSearch schema: expected data.jobs[]');if(p.data.cursor!=null&&typeof p.data.cursor!=='string')throw new Error('Unexpected cursor type');return {jobs:p.data.jobs,cursor:p.data.cursor||null};}
export function mapJob(j){return {sourceId:j.job_id,title:j.job_title,company:j.employer_name,location:j.job_location||[j.job_city,j.job_state].filter(Boolean).join(', '),country:j.job_country,description:j.job_description,url:j.job_apply_link,postedAt:j.job_posted_at_datetime_utc,employmentType:j.job_employment_type,remote:j.job_is_remote,salary:j.job_min_salary!=null||j.job_max_salary!=null?{min:j.job_min_salary??null,max:j.job_max_salary??null,currency:j.job_salary_currency??null,period:j.job_salary_period??null}:null,providerRaw:j};}
export function mapPlatformJob(job,platform){
 const mapped=mapJob(job);
 if(!['MY','MYS','MALAYSIA'].includes(String(mapped.country||'').toUpperCase()))return null;
 const links=[job.job_apply_link,...(Array.isArray(job.apply_options)?job.apply_options:[]).map(option=>option.apply_link||option.url)].filter(Boolean);
 const link=links.find(link=>{
  if(!allowedPlatformUrl(link,platform))return false;
  const u=new URL(link);
  return platform==='linkedin'?/\/jobs\/view\//.test(u.pathname):platform==='indeed'?/\/(viewjob|rc\/clk|m\/viewjob)/.test(u.pathname):/\/job\/[A-Za-z0-9]+/.test(u.pathname);
 });
 if(!link)return null;
 const u=new URL(link);
 const identity=platform==='indeed'?(u.searchParams.get('jk')||u.searchParams.get('vjk')):platform==='linkedin'?u.pathname.match(/(\d+)\/?$/)?.[1]:u.pathname.match(/\/job\/([A-Za-z0-9]+)/)?.[1];
 return {...mapped,url:link,sourceId:identity||mapped.sourceId,retrievalMethod:'jsearch'};
}
export async function collectJsearch({source,config,budget,onRecord,onTask,fetchImpl,requestCache=new Map()}){
 const {provider,key}=jsearchSettings();
 if(!['rapidapi','openwebninja'].includes(provider))throw new Error('Invalid JSEARCH_PROVIDER');
 if(!key)throw new Error('Missing JSEARCH_API_KEY / RAPIDAPI_KEY; use npm run demo for offline fixtures');
 const platform=config.platformRestricted&&['linkedin','indeed','ricebowl'].includes(source.id)?source.id:null;
 const base=provider==='rapidapi'?'https://jsearch.p.rapidapi.com/search-v2':'https://api.openwebninja.com/jsearch/search-v2';
 const headers=provider==='rapidapi'?{'x-rapidapi-key':key,'x-rapidapi-host':'jsearch.p.rapidapi.com'}:{'x-api-key':key};
 for(const role of config.roles)for(const query of role.queries){
  const task={source:source.id,query,status:'running',pages:0,records:0,eligibleRecords:0,filteredOutsidePlatform:0,provider:'jsearch',error:null};
  try{let cursor=null;const seen=new Set();
   for(let p=0;p<config.maxPagesPerQuery;p++){
    const u=new URL(base);for(const [k,v] of Object.entries({query,country:'my',language:'en',date_posted:config.datePosted,num_pages:'1'}))u.searchParams.set(k,v);
    if(cursor)u.searchParams.set('cursor',cursor);
    const cacheKey=provider+':'+u.href;
    if(!requestCache.has(cacheKey))requestCache.set(cacheKey,fetchJson(u,{headers,budget,fetchImpl}));
    const result=parseSearch(await requestCache.get(cacheKey));task.pages++;
    for(const j of result.jobs){task.records++;const mapped=platform?mapPlatformJob(j,platform):mapJob(j);if(!mapped){task.filteredOutsidePlatform++;continue;}await onRecord(mapped);task.eligibleRecords++;}
    if(!result.cursor){task.status='complete';break;}
    if(seen.has(result.cursor))throw new Error('Provider repeated a cursor');seen.add(result.cursor);cursor=result.cursor;task.status='capped';
   }
  }catch(e){task.status=e.capped?'capped':'failed';task.error=e.message;}
  await onTask(task);if(budget.signal.aborted||/HTTP (401|403)/.test(task.error||''))return;
 }
}
