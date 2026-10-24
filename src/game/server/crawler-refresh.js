import fs from 'node:fs'
import {parseEnv} from 'node:util'
import {readCrawlerState} from './crawler-ingestion.js'
export class RefreshError extends Error { constructor(status,code){super(code);this.status=status;this.code=code} }

function settings()
{
    let local={}
    try {local=parseEnv(fs.readFileSync(new URL('../../crawler/.env',import.meta.url),'utf8'))} catch {}
    return {baseUrl:process.env.MARKET_CRAWLER_URL??`http://127.0.0.1:${local.PORT||8788}`,token:process.env.MARKET_CRAWLER_TOKEN??local.CRAWLER_TOKEN}
}

export function createSampleRefresh({configuration=settings,fetchImpl=fetch,readPublished=readCrawlerState}={})
{
    let current=null, starting=null, nextAllowedAt=0
    const request=async(method,path)=>{
        const {baseUrl,token}=configuration()
        if(!token)throw new RefreshError(503,'crawler-not-configured')
        let response
        try {response=await fetchImpl(new URL(path,baseUrl),{method,headers:{authorization:'Bearer '+token,...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{}),redirect:'error',signal:AbortSignal.timeout(12000)})}
        catch {throw new RefreshError(503,'crawler-unavailable')}
        const body=await response.json().catch(()=>({}))
        if(response.status===409&&body.runId)return body
        if(!response.ok)throw new RefreshError(502,'crawler-request-failed')
        return body
    }
    async function start()
    {
        if(starting)return starting
        if(current&&['running','publishing'].includes(current.status))return {...current,shared:true}
        if(Date.now()<nextAllowedAt)throw new RefreshError(429,'crawler-rate-limited')
        starting=(async()=>{
            const health=await request('GET','/health')
            if(health.platformRestricted!==true||!Array.isArray(health.platforms)||!health.platforms.length||health.platforms.some(id=>!['linkedin','indeed','ricebowl'].includes(id)))throw new RefreshError(503,'crawler-platforms-not-allowed')
            const result=await request('POST','/api/crawl')
            if(typeof result.runId!=='string'||!/^[\w-]{1,100}$/.test(result.runId))throw new RefreshError(502,'crawler-invalid-response')
            current={runId:result.runId,status:'running',startedAt:new Date().toISOString()}
            return {...current}
        })()
        try{return await starting}finally{starting=null}
    }
    async function poll(runId)
    {
        if(!current||current.runId!==runId)throw new RefreshError(404,'crawler-run-not-found')
        if(['published','failed'].includes(current.status))return {...current}
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
        current={...current,status,collectionStatus:result.status,error,postings:report.uniqueInRun??0,newAds:report.created??0,
            previouslySeen:Math.max(0,(report.uniqueInRun??0)-(report.created??0)),unavailableSources:(report.unavailableSources??[]).map(s=>({id:s.id,error:s.error})),
            publishedRunId:published?.run.id??null,finishedAt:result.finishedAt??null}
        if(status==='failed'&&current.unavailableSources.some(s=>/429/.test(s.error)))nextAllowedAt=Date.now()+60000
        return {...current}
    }
    return {start,poll,status:()=>current?{...current}:null}
}
export const sampleRefresh=createSampleRefresh()
