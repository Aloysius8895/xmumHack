import fs from 'node:fs'
import {parseEnv} from 'node:util'
import {readCrawlerState} from './crawler-ingestion.js'
import {knownListings,loadWindow} from './market-window.js'
export class RefreshError extends Error { constructor(status,code,detail={}){super(code);this.status=status;this.code=code;this.detail=detail} }

// A collection (scheduled or Refresh) is followed by this quiet time before a player can start another one
export const COOLDOWN_MS=30*60000
const DAY=86400000, MYT=8*3600000

function settings()
{
    let local={}
    try {local=parseEnv(fs.readFileSync(new URL('../../crawler/.env',import.meta.url),'utf8'))} catch {}
    return {baseUrl:process.env.MARKET_CRAWLER_URL??`http://127.0.0.1:${local.PORT||8788}`,token:process.env.MARKET_CRAWLER_TOKEN??local.CRAWLER_TOKEN}
}

/** Next daily collection (CRAWL_SCHEDULE_MYT, HH:MM Malaysia time, default 08:00; 'off' = no schedule) */
export function nextScheduledAt(now=Date.now(),schedule=process.env.CRAWL_SCHEDULE_MYT??'08:00')
{
    const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule)
    if(!match)return null
    const offset=(Number(match[1])*60+Number(match[2]))*60000
    const today=Math.floor((now+MYT)/DAY)*DAY-MYT+offset
    return new Date(today>now?today:today+DAY).toISOString()
}

/** When the last published collection finished, and until when Refresh stays closed after it */
export function collectionTimes(window=readCrawlerState(),now=Date.now())
{
    const lastCollectedAt=window?.runs?.at(-1)?.finishedAt??window?.latest?.run?.finishedAt??null
    const until=lastCollectedAt?Date.parse(lastCollectedAt)+COOLDOWN_MS:0
    return {lastCollectedAt,nextScheduledAt:nextScheduledAt(now),cooldownUntil:until>now?new Date(until).toISOString():null}
}

export function createSampleRefresh({configuration=settings,fetchImpl=fetch,readPublished=readCrawlerState,loadPublished=loadWindow,now=Date.now}={})
{
    let current=null, starting=null, nextAllowedAt=0
    const request=async(method,path,body)=>{
        const {baseUrl,token}=configuration()
        if(!token)throw new RefreshError(503,'crawler-not-configured')
        let response
        try {response=await fetchImpl(new URL(path,baseUrl),{method,headers:{authorization:'Bearer '+token,...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(body??{})}:{}),redirect:'error',signal:AbortSignal.timeout(12000)})}
        catch {throw new RefreshError(503,'crawler-unavailable')}
        const result=await response.json().catch(()=>({}))
        if(response.status===409&&result.runId)return result
        if(!response.ok)throw new RefreshError(502,'crawler-request-failed')
        return result
    }
    /**
     * trigger 'refresh' (a player) waits for the cooldown; 'schedule' (the daily workflow) never does.
     * Both are incremental: the crawler gets the watermark and the listings already known.
     */
    async function start({trigger='refresh'}={})
    {
        if(starting)return starting
        if(current&&['running','publishing'].includes(current.status))return {...current,shared:true}
        if(now()<nextAllowedAt)throw new RefreshError(429,'crawler-rate-limited')
        starting=(async()=>{
            const window=await loadPublished().catch(()=>readPublished())
            const times=collectionTimes(window,now())
            if(trigger==='refresh'&&times.cooldownUntil)throw new RefreshError(429,'crawler-cooldown',{cooldownUntil:times.cooldownUntil})
            const health=await request('GET','/health')
            if(health.platformRestricted!==true||!Array.isArray(health.platforms)||!health.platforms.length||health.platforms.some(id=>!['linkedin','indeed','ricebowl'].includes(id)))throw new RefreshError(503,'crawler-platforms-not-allowed')
            const result=await request('POST','/api/crawl',{trigger,since:window?.lastSuccessfulCollectionAt??null,known:knownListings(window)})
            if(typeof result.runId!=='string'||!/^[\w-]{1,100}$/.test(result.runId))throw new RefreshError(502,'crawler-invalid-response')
            current={runId:result.runId,trigger,status:'running',startedAt:new Date(now()).toISOString(),since:window?.lastSuccessfulCollectionAt??null}
            return {...current}
        })()
        try{return await starting}finally{starting=null}
    }
    async function poll(runId)
    {
        if(!current||current.runId!==runId)throw new RefreshError(404,'crawler-run-not-found')
        if(['published','failed'].includes(current.status))return {...current,...collectionTimes(readPublished(),now())}
        const result=await request('GET','/api/runs/'+encodeURIComponent(runId))
        if(result.id!==runId)throw new RefreshError(502,'crawler-invalid-response')
        const report=result.report??{}, delivery=result.publication?.status
        let status='running',error=null
        if(result.status==='running')status='running'
        else if(delivery==='published')status='published'
        else if(['complete','capped'].includes(result.status)||(result.status==='partial'&&report.publishable)){
            if(['pending','publishing'].includes(delivery))status='publishing'
            else {status='failed';error='crawler-publication-failed'}
        }else {status='failed';error='crawler-collection-failed'}
        const published=readPublished()?.latest
        if(status==='published'&&published?.run.id!==runId){status='failed';error='crawler-publication-failed'}
        const incremental=report.incremental===true
        current={...current,status,collectionStatus:result.status,error,postings:report.uniqueInRun??0,newAds:incremental?report.new??0:report.created??0,
            changedAds:incremental?report.changed??0:report.changed??0,unchangedAds:incremental?report.unchanged??0:null,skippedDetails:incremental?report.skippedDetails??0:null,
            previouslySeen:incremental?report.unchanged??0:Math.max(0,(report.uniqueInRun??0)-(report.created??0)),unavailableSources:(report.unavailableSources??[]).map(s=>({id:s.id,error:s.error})),
            publishedRunId:published?.run.id??null,finishedAt:result.finishedAt??null}
        if(status==='failed'&&current.unavailableSources.some(s=>/429/.test(s.error)))nextAllowedAt=now()+60000
        return {...current,...collectionTimes(readPublished(),now())}
    }
    return {start,poll,status:()=>current?{...current}:null}
}
export const sampleRefresh=createSampleRefresh()
