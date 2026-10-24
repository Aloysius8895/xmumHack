import {setTimeout as delay} from 'node:timers/promises';
import {canonicalUrl} from '../normalize.js';
import {digest} from '../config.js';
const allowed=(value,s)=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&s.allowOrigins.includes(u.origin);}catch{return false;}};
export function validateBrowserSource(s){
 if(!s.validated)throw new Error('Browser adapter is unvalidated; inspect a real permitted target');
 if(!s.allowOrigins?.length||!s.startUrls?.length||!s.readySelector||!s.itemSelector)throw new Error('Browser source requires allowOrigins, startUrls, readySelector and itemSelector');
 for(const u of s.startUrls)if(!allowed(u,s))throw new Error('Start URL outside allowOrigins');
 const mode=s.pagination?.mode||'none';if(!['none','button','scroll'].includes(mode))throw new Error('Invalid pagination mode');
 if(mode!=='none'&&(!Number.isInteger(s.pagination?.maxSteps)||s.pagination.maxSteps<1||s.pagination.maxSteps>200))throw new Error('Set maxSteps between 1 and 200');
 if(mode==='button'&&!s.pagination.nextSelector)throw new Error('Button pagination needs nextSelector');
 for(const field of ['title','company','country'])if(!s.fields?.[field])throw new Error('Missing browser field: '+field);
 if(!s.idAttribute&&!s.fields.url)throw new Error('Browser pagination needs stable IDs or links');
}
async function extract(page,s){
 return page.locator(s.itemSelector).evaluateAll((items,{fields,idAttribute})=>items.map(item=>{
  const r={sourceId:idAttribute?item.getAttribute(idAttribute):null};
  for(const [name,spec]of Object.entries(fields)){
   if(Object.hasOwn(spec,'value')){r[name]=spec.value;continue;}
   const el=spec.selector?item.querySelector(spec.selector):item;r[name]=el?(spec.attribute?el.getAttribute(spec.attribute):el.textContent):null;
  }return r;
 }),{fields:s.fields,idAttribute:s.idAttribute});
}
export async function scrapePage(page,s,{budget,onRecord}){
 const known=new Set();let records=0,steps=0,unchanged=0;
 const mode=s.pagination?.mode||'none',max=s.pagination?.maxSteps||1;
 const timeout=Math.min(s.timeoutMs||30000,Math.max(1,budget.until-Date.now()));
 await page.locator(s.emptySelector?s.readySelector+', '+s.emptySelector:s.readySelector).first().waitFor({state:'attached',timeout});
 if(s.emptySelector&&await page.locator(s.emptySelector).isVisible())return {status:'complete',records:0,pages:1};
 while(true){
  budget.signal.throwIfAborted();let added=0;
  for(const r of await extract(page,s)){
   if(r.url)r.url=canonicalUrl(new URL(r.url,page.url()).href);
   if(r.remote==='true')r.remote=true;else if(r.remote==='false')r.remote=false;
   const key=r.sourceId||r.url||digest([r.title,r.company,r.location]);
   if(known.has(key))continue;known.add(key);await onRecord(r);added++;records++;
  }
  unchanged=added?0:unchanged+1;
  if(mode==='none'||(s.endSelector&&await page.locator(s.endSelector).isVisible()))return {status:'complete',records,pages:steps+1};
  if(steps>=max||unchanged>=(s.pagination.noNewRounds||2))return {status:'capped',records,pages:steps+1};
  const next=mode==='button'?page.locator(s.pagination.nextSelector).first():null;
  if(next&&(!await next.count()||!await next.isVisible()||!await next.isEnabled()))return {status:'complete',records,pages:steps+1};
  await budget.take();
  const response=s.responseUrlIncludes?page.waitForResponse(r=>r.url().includes(s.responseUrlIncludes)&&r.status()===200,{timeout}):null;
  response?.catch(()=>{});
  if(next)await next.click({timeout});
  else if(s.pagination.scrollContainerSelector)await page.locator(s.pagination.scrollContainerSelector).evaluate(el=>{el.scrollTop+=Math.max(100,el.clientHeight*.8);});
  else await page.evaluate(()=>window.scrollBy(0,Math.max(100,innerHeight*.8)));
  steps++;if(response)await response;
  try{await page.waitForFunction(({selector,idAttribute,known,fields,endSelector})=>{
   if(endSelector&&document.querySelector(endSelector)?.getClientRects().length)return true;
   return [...document.querySelectorAll(selector)].some(el=>{
    const id=idAttribute?el.getAttribute(idAttribute):null,link=fields.url?.selector?el.querySelector(fields.url.selector):null;
    if(id)return !known.includes(id);
    if(link?.href){const u=new URL(link.href);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_.+|gclid|fbclid)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return !known.includes(u.href);}return false;
   });
  },{selector:s.itemSelector,idAttribute:s.idAttribute,known:[...known],fields:s.fields,endSelector:s.endSelector},{timeout});}
  catch{if(!(s.endSelector&&await page.locator(s.endSelector).isVisible()))return {status:'capped',records,pages:steps+1,error:'Pagination stalled or no new IDs'};}
 }
}
export async function collectBrowser({source:s,config,budget,onRecord,onTask,chromiumOverride}){
 validateBrowserSource(s);const chromium=chromiumOverride||(await import('playwright')).chromium;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
 const abort=()=>{void browser.close().catch(()=>{});};budget.signal.addEventListener('abort',abort,{once:true});
 try{
  const context=await browser.newContext({userAgent:'CareerSphereResearchBot/1.0'});
  await context.route('**/*',route=>allowed(route.request().url(),s)?route.continue():route.abort());
  const page=await context.newPage();
  for(const start of s.startUrls){
   const task={source:s.id,query:start,status:'running',records:0,pages:0,error:null};
   try{
    await budget.take();const response=await page.goto(start,{waitUntil:'domcontentloaded',timeout:s.timeoutMs||30000});
    if(!response?.ok())throw new Error('Browser navigation HTTP '+(response?.status()??'unknown'));
    const accept=async row=>{
     if(s.detail&&row.url){
      if(!allowed(row.url,s))throw new Error('Detail URL outside allowOrigins');
      await budget.take();const detail=await context.newPage();
      try{const r=await detail.goto(row.url,{waitUntil:'domcontentloaded',timeout:s.timeoutMs||30000});if(!r?.ok())throw new Error('Detail navigation HTTP '+(r?.status()??'unknown'));
       await detail.locator(s.detail.readySelector).first().waitFor({state:'visible',timeout:s.timeoutMs||30000});
       row.description=await detail.locator(s.detail.descriptionSelector).first().innerText();
      }finally{await detail.close();}
     }await onRecord(row);await delay(config.requestIntervalMs,undefined,{signal:budget.signal});
    };
    Object.assign(task,await scrapePage(page,s,{budget,onRecord:accept}));
   }catch(e){task.status=e.capped?'capped':'failed';task.error=e.message;}
   await onTask(task);if(budget.signal.aborted)break;
  }
 }finally{budget.signal.removeEventListener('abort',abort);await browser.close();}
}
