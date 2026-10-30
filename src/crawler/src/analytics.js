const DAY=86400000,OFFSET=8*3600000;
export const localDay=iso=>new Date(Date.parse(iso)+OFFSET).toISOString().slice(0,10);
const round=x=>Math.round(x*100)/100;
const counts=rows=>{const m=new Map();for(const r of rows)m.set(r.role,(m.get(r.role)||0)+1);return [...m].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count);};
const days=(from,to)=>{const out=[];for(let n=from;n<to;n+=DAY)out.push(localDay(new Date(n).toISOString()));return out;};
// `rows`: summarize only these records of the run (an incremental export publishes its new and changed ones)
export function summarize(store,{now=new Date().toISOString(),runId,rows:only}={}){
 const latest=runId?store.run(runId):store.latestRun();
 if(!latest)return {status:'no_data',isDemo:false,roles:[],skills:[],trend:{status:'insufficient_history',growthPct:null}};
 const rows=only??store.records(latest.id),described=rows.filter(r=>r.descriptionAvailable),skills=new Map();
 for(const r of described)for(const s of r.skills){const k=r.role+':'+s.id,v=skills.get(k)||{role:r.role,id:s.id,name:s.name,count:0};v.count++;skills.set(k,v);}
 const skillStats=[...skills.values()].map(s=>{const denominator=described.filter(r=>r.role===s.role).length;return {...s,denominator,ratePct:round(100*s.count/denominator)};});
 const todayStart=Math.floor((Date.parse(now)+OFFSET)/DAY)*DAY-OFFSET,start=todayStart-7*DAY,previousStart=start-7*DAY;
 const currentDays=days(start,todayStart),previousDays=days(previousStart,start);
 const healthy=store.runs(latest.scope).filter(r=>(['complete','capped'].includes(r.status)||(r.status==='partial'&&r.report?.publishable===true))&&r.demo===latest.demo&&Date.parse(r.finished_at)<=Date.parse(now));
 const covered=new Set(healthy.map(r=>localDay(r.finished_at))),missingCurrentDays=currentDays.filter(d=>!covered.has(d)),missingPreviousDays=previousDays.filter(d=>!covered.has(d));
 const current=new Map(),previous=new Map();
 for(const r of healthy){const t=Date.parse(r.finished_at),target=t>=start&&t<todayStart?current:t>=previousStart&&t<start?previous:null;if(target)for(const row of store.records(r.id))target.set(row.id,row);}
 const enough=!missingCurrentDays.length&&!missingPreviousDays.length,a=counts([...current.values()]),b=counts([...previous.values()]);
 const trendRoles=[...new Set([...a,...b].map(r=>r.id))].map(id=>{
  const currentCount=a.find(r=>r.id===id)?.count||0,previousCount=b.find(r=>r.id===id)?.count||0;
  return {id,currentCount,previousCount,growthPct:enough&&previousCount>0?round(100*(currentCount-previousCount)/previousCount):null,status:!enough?'insufficient_history':previousCount===0?(currentCount?'new_in_sample':'no_baseline'):'comparable'};
 }).sort((a,b)=>(b.growthPct??-Infinity)-(a.growthPct??-Infinity));
 return {status:latest.status,isDemo:Boolean(latest.demo),label:latest.demo?'DEMO / SYNTHETIC — not real market data':'Observed recruitment advertisements in the configured sample',runId:latest.id,scopeHash:latest.scope,lastUpdatedAt:latest.finished_at,sampleSize:rows.length,descriptionCount:described.length,missingDescriptionCount:rows.length-described.length,roles:counts(rows),skills:skillStats,
 quality:{latestRunStatus:latest.status,lastSuccessfulRunId:healthy.at(-1)?.id??null,capped:latest.status==='capped',tasks:store.tasks(latest.id).filter(t=>latest.config.sources.some(s=>s.enabled&&s.id===t.source)),publishable:latest.report?.publishable===true,unavailableSources:latest.report?.unavailableSources||[],report:latest.report},
 trend:{status:enough?'comparable':'insufficient_history',metric:'distinct_ads_observed_in_each_7_day_window',timezone:'Asia/Kuala_Lumpur',currentWindow:{from:currentDays[0],through:currentDays.at(-1)},previousWindow:{from:previousDays[0],through:previousDays.at(-1)},missingCurrentDays,missingPreviousDays,roles:trendRoles,note:'Complete calendar days and identical scope required. Capped runs are limited samples, not total vacancies or hires.'},
 limitations:['Duplicate adverts with substantially different links/descriptions may remain.','Remote eligibility must explicitly identify MY; unknown countries are excluded.','Skill evidence indicates mentions, not necessarily mandatory requirements.','Missing adverts are not automatically declared closed.']};
}
