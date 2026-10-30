import {allCareers,SKILLS} from './careers.js'
import {readCrawlerState,malaysiaMonth} from './crawler-ingestion.js'
import {collectionTimes} from './crawler-refresh.js'
import {WINDOW_DAYS} from './market-window.js'
import {buildSamplingDiagnostics} from './sampling-diagnostics.js'
import {fdeHistory} from './fde-history.js'

const share=(n,d)=>d?Math.round(n/d*1000)/10:null
const windowRange=at=>({days:WINDOW_DAYS,from:new Date(Date.parse(at)-WINDOW_DAYS*86400000).toISOString(),through:at})

export function crawlerStatus()
{
    const data=readCrawlerState(), latest=data?.latest, times=collectionTimes(data)
    return latest?{status:latest.run.status,runId:latest.run.id,source:latest.scope.sources.map(s=>s.id).join('+'),
        collectedAt:latest.run.finishedAt,postings:data.postings.length,denominator:data.postings.filter(p=>p.descriptionAvailable).length,
        weeklyTrend:latest.summary.trend,usingFallback:false,coveredCareers:latest.scope.roles.length,
        unavailableSources:latest.summary.quality.unavailableSources??[],sampleHistory:latest.sampleHistory??[],
        window:windowRange(latest.run.finishedAt),lastRun:data.runs?.at(-1)??null,...times}
        :{status:'waiting',usingFallback:true,weeklyTrend:{status:'insufficient_history'},...times}
}

/**
 * The crawler is a separate sample frame. Never add its counts to the legacy sample.
 * Everything here is the accumulated window (market-window.js): the postings seen in the last 30 days.
 */
export function crawlerMarket()
{
    const data=readCrawlerState()
    if(!data?.latest) return null
    const {run,scope,summary}=data.latest
    const jobs=data.postings, described=jobs.filter(j=>j.descriptionAvailable)
    const meta={sample:true,live:true,source:scope.sources.map(s=>s.id).join('+'),collectedAt:run.finishedAt,
        period:malaysiaMonth(run.finishedAt),postings:jobs.length,denominator:described.length,
        previousPeriod:null,historyStatus:summary.trend.status,comparable:summary.trend.status==='comparable',
        pendingClassification:jobs.filter(j=>j.role==='unmapped').length,crawlerRunId:run.id,window:windowRange(run.finishedAt)}
    const skills=scope.skills.map(id=>({id,count:described.filter(j=>j.skills.includes(id)).length})).map(s=>({...s,share:share(s.count,described.length),change:null})).sort((a,b)=>b.count-a.count)
    const careers={}
    for(const career of allCareers().filter(c=>!c.custom))
    {
        const covered=scope.roles.includes(career.id), rows=jobs.filter(j=>j.role===career.id), usable=rows.filter(j=>j.descriptionAvailable)
        const perSkills=scope.skills.map(id=>({id,count:usable.filter(j=>j.skills.includes(id)).length})).filter(s=>s.count).map(s=>({...s,share:share(s.count,usable.length),change:null})).sort((a,b)=>b.count-a.count)
        const week=summary.trend.roles.find(row=>row.id===career.id)
        careers[career.id]={...meta,postings:covered?rows.length:null,heat:covered?share(rows.length,jobs.length):null,
            companies:covered?new Set(rows.map(j=>j.company.toLowerCase())).size:null,change:week?.growthPct??null,
            weeklyTrend:week??null,note:null,topSkills:Object.fromEntries(perSkills.map(s=>[s.id,s.count])),history:[],
            skills:{...meta,postings:covered?rows.length:null,denominator:covered?usable.length:null,skills:perSkills}}
    }
    const diagnosticJobs=jobs.map(job=>({canonical_job_id:job.key,source:job.sources[0].source,occupation_id:job.role==='unmapped'?null:job.role,
        country:'MY',description_quality:job.descriptionAvailable?'usable':'missing_or_short',live_verified:false,status:'unknown',
        collected_at:job.lastSeenAt,company_normalized:job.company.toLowerCase(),company_raw:job.company,title_raw:job.title,
        location_raw:job.location,posted_date:job.postedDate??(job.postedAt?new Date(Date.parse(job.postedAt)+8*3600000).toISOString().slice(0,10):null),job_url:job.url}))
    const sampling=buildSamplingDiagnostics(diagnosticJobs,{collection_runs:[{searches:summary.quality.tasks.map(t=>({page_cap_reached:t.status==='capped'}))}]},run.finishedAt)
    for(const demand of Object.values(sampling.emergingDemand))demand.postings=demand.postings.filter(job=>job.url)
    return {...meta,careers,skills:{...meta,skills},skillMarket:Object.fromEntries(Object.keys(SKILLS).map(id=>[id,{...meta,share:scope.skills.includes(id)?skills.find(s=>s.id===id).share:null,change:null}])),
        trends:{...meta,demo:false,periods:data.months.map(m=>m.period),careerObservations:fdeHistory(),sampling,crawler:crawlerStatus(),
            monthlyMetric:'postings_observed_in_month_within_window',
            denominators:data.months.map(m=>m.denominator??null),thin:data.months.map(m=>m.thin??null),
            careers:allCareers().filter(c=>!c.custom).map(c=>({id:c.id,careerId:c.id,name:c.name,shortName:c.shortName,emerging:Boolean(c.emerging),ads:data.months.map(m=>m.counts[c.id]??null)})),
            skills:scope.skills.map(id=>({id,name:SKILLS[id],share:data.months.map(m=>m.shares[id]??null)}))}}
}
