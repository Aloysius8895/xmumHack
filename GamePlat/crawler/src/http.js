import {setTimeout as delay} from 'node:timers/promises';
export class Budget{
 constructor(c){this.limit=c.maxRequestsPerRun;this.count=0;this.interval=c.requestIntervalMs;this.until=Date.now()+c.maxRunMs;this.signal=AbortSignal.timeout(c.maxRunMs);this.queues=new Map();this.last=new Map();}
 scope(key,interval=this.interval){return {take:()=>this.take(key,interval),signal:this.signal,until:this.until};}
 take(key='default',interval=this.interval){
  const turn=(this.queues.get(key)||Promise.resolve()).then(async()=>{
   const check=()=>{this.signal.throwIfAborted();if(this.count>=this.limit){const e=new Error('Request budget exhausted');e.capped=true;throw e;}};
   check();let wait;
   while((wait=(this.last.get(key)||0)+interval-Date.now())>0)await delay(wait,undefined,{signal:this.signal});
   check();this.last.set(key,Date.now());this.count++;
  });
  this.queues.set(key,turn.catch(()=>{}));return turn;
 }
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
