// Incremental collection: a run that knows when the last successful one started (`since`) and the listings already
// stored by the game (`known`, platform:id -> listing fingerprint) asks the platforms only for recent adverts and
// skips the detail pages of listings that did not change. The game owns this state (market-window.js); the crawler
// keeps none of it between runs, so a fresh container collects incrementally too.
import {fetchJson} from './http.js';
const DAY=86400,BUFFER=2*3600,MAX=30*DAY;
export const TRIGGERS=['schedule','refresh','manual'];

/** Seconds to look back: since the watermark plus a 2 hour buffer, at most 30 days. null = no watermark (full run). */
export function lookbackSeconds(since,now=Date.now()){
 const at=Date.parse(since??'');if(!Number.isFinite(at))return null;
 return Math.min(MAX,Math.max(BUFFER,Math.ceil((now-at)/1000)+BUFFER));
}
// JSearch accepts all | today | 3days | week | month. 'today' is not used: its calendar-day or 24-hour meaning is
// not documented, and a calendar day could drop yesterday evening's adverts. Overlap is deduplicated anyway.
export const jsearchWindow=seconds=>seconds<=3*DAY?'3days':seconds<=7*DAY?'week':'month';
export const indeedDays=seconds=>String([1,3,7,14].find(days=>seconds<=days*DAY)??30);

/** The collection settings of one run; the stored config (and so the scope) keeps the configured window. */
export function effectiveConfig(config,since,now=Date.now()){
 const seconds=lookbackSeconds(since,now);
 return seconds===null?config:{...config,datePosted:jsearchWindow(seconds),postedWithinSeconds:seconds};
}

/** Validates the POST /api/crawl body. Only these three fields: sources and limits stay server-side. */
export function parseIncremental(body){
 if(body==null)return null;
 if(typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['trigger','since','known'].includes(k)))throw new Error('Only trigger, since and known are accepted');
 const trigger=body.trigger??'manual';if(!TRIGGERS.includes(trigger))throw new Error('Invalid trigger');
 const since=body.since??null;if(since!==null&&(typeof since!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(since)||!Number.isFinite(Date.parse(since))))throw new Error('Invalid since');
 const known=body.known??{};
 if(typeof known!=='object'||Array.isArray(known))throw new Error('Invalid known listings');
 const entries=Object.entries(known);if(entries.length>20000)throw new Error('Too many known listings');
 for(const [key,value] of entries)if(!/^(linkedin|indeed|ricebowl):\S{1,300}$/.test(key)||!/^[0-9a-f]{64}$/.test(value))throw new Error('Invalid known listing');
 return {trigger,since,known:new Map(entries)};
}

/** Asks the game for the state when the crawl was started without it (e.g. from the command line). */
export async function fetchState({url=process.env.BACKEND_INGEST_URL,token=process.env.BACKEND_INGEST_TOKEN,fetchImpl}={}){
 if(!url||!token)return null;
 try{
  const state=await fetchJson(new URL(url.replace(/\/+$/,'')+'/state'),{headers:{authorization:'Bearer '+token},attempts:1,fetchImpl});
  return parseIncremental({trigger:'manual',since:state.since??null,known:state.known??{}});
 }catch{return null;}
}
