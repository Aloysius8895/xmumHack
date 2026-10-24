import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {jsearchSettings} from './provider-env.js';
import {parseSearch} from './sources/jsearch.js';
import {allowedPlatformUrl} from './sources/public.js';
const {provider,key}=jsearchSettings({readGame:true});
if(!key)throw new Error('Set RAPIDAPI_KEY in GamePlat/game/.env or JSEARCH_API_KEY in the service environment');
if(!['rapidapi','openwebninja'].includes(provider))throw new Error('Unsupported JSEARCH_PROVIDER');
const url=new URL(provider==='rapidapi'?'https://jsearch.p.rapidapi.com/search-v2':'https://api.openwebninja.com/jsearch/search-v2');
url.search=new URLSearchParams({query:'data analyst jobs in Malaysia',country:'my',language:'en',date_posted:'month',num_pages:'1'}).toString();
const headers=provider==='rapidapi'?{'x-rapidapi-key':key,'x-rapidapi-host':'jsearch.p.rapidapi.com'}:{'x-api-key':key};
const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
const body=await response.text();let payload;try{payload=JSON.parse(body);}catch{}
const result={provider,requests:1,httpStatus:response.status,ok:response.ok,responseSha256:createHash('sha256').update(body).digest('hex')};
if(!response.ok){result.error=String(payload?.message||payload?.error||'Provider request failed').replaceAll(key,'[redacted]').slice(0,300);process.exitCode=1;}
else{
 try{
  const {jobs}=parseSearch(payload),counts={linkedin:0,indeed:0,ricebowl:0};
  for(const job of jobs){const links=[job.job_apply_link,...(job.apply_options||[]).map(o=>o.apply_link||o.url)].filter(Boolean);for(const id of Object.keys(counts))if(links.some(link=>allowedPlatformUrl(link,id)))counts[id]++;}
  Object.assign(result,{returned:jobs.length,eligibleByPlatform:counts,hasCursor:Boolean(payload.data.cursor)});
 }catch(e){result.ok=false;result.error=e.message;process.exitCode=1;}
}
const directory=new URL('../../verification/crawler-integration/',import.meta.url);await fs.mkdir(directory,{recursive:true});await fs.writeFile(new URL('jsearch-check.json',directory),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
