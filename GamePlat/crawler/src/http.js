import {setTimeout as delay} from 'node:timers/promises';
export class Budget{
 constructor(c){this.limit=c.maxRequestsPerRun;this.count=0;this.interval=c.requestIntervalMs;this.last=0;this.until=Date.now()+c.maxRunMs;this.signal=AbortSignal.timeout(c.maxRunMs);}
 async take(){this.signal.throwIfAborted();if(this.count>=this.limit){const e=new Error('Request budget exhausted');e.capped=true;throw e;}const wait=Math.max(0,this.last+this.interval-Date.now());if(wait)await delay(wait,undefined,{signal:this.signal});this.signal.throwIfAborted();this.last=Date.now();this.count++;}
}
export async function fetchJson(url,{headers={},budget,fetchImpl=fetch,attempts=3,method='GET',body}={}){
 let last;
 for(let n=0;n<attempts;n++){
  if(budget)await budget.take();let r;
  try{r=await fetchImpl(url,{method,headers,body,signal:budget?AbortSignal.any([budget.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),redirect:'error'});}
  catch(e){last=new Error('Network request failed ('+e.name+')');if(n===attempts-1||budget?.signal.aborted)throw last;await delay(500*2**n,undefined,{signal:budget?.signal});continue;}
  if(r.ok){try{return await r.json();}catch{throw new Error('Response is not valid JSON');}}
  last=new Error('HTTP '+r.status);
  if(![429,500,502,503,504].includes(r.status)||n===attempts-1)throw last;
  const h=r.headers.get('retry-after');let wait=h?(/^\d+(\.\d+)?$/.test(h)?Number(h)*1000:Date.parse(h)-Date.now()):500*2**n;
  if(!Number.isFinite(wait))wait=500*2**n;if(wait>60000)throw new Error('Retry-After exceeds retry window');
  await delay(Math.max(0,wait)+Math.floor(Math.random()*100),undefined,{signal:budget?.signal});
 }throw last;
}
