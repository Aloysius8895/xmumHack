import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {allCareers,SKILLS} from './careers.js'
import {allowedPlatformUrl} from '../../crawler/src/sources/public.js'

export class CrawlerError extends Error
{
    constructor(status,code) { super(code); this.status=status; this.code=code }
}
const fail = (code,status=400) => { throw new CrawlerError(status,code) }
const object = value => value && typeof value==='object' && !Array.isArray(value)
const string = (value,max=2000) => typeof value==='string' && value.length>0 && value.length<=max
const instant = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
const date = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value
const ids = list => Array.isArray(list) && list.length>0 && list.length<=200 && list.every(x=>string(x,100)) && new Set(list).size===list.length
const url = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password } catch { return false } }
const stable = value => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
export const malaysiaMonth = iso => new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,7)

export function validateCrawlerPayload(body,key)
{
    if(!object(body)||body.schemaVersion!=='1.1') fail('crawler-bad-schema')
    if(body.isDemo!==false||body.summary?.isDemo!==false) fail('crawler-demo-not-accepted')
    const {run,scope,summary,jobs}=body
    if(!object(run)||!string(run.id,100)||!/^[\w-]+$/.test(run.id)||body.idempotencyKey!==run.id||(key&&key!==run.id)) fail('crawler-bad-run-id')
    if(!['complete','capped'].includes(run.status)&&!(run.status==='partial'&&summary?.quality?.publishable===true&&summary?.quality?.unavailableSources?.length)) fail('crawler-incomplete-run')
    if(!instant(run.startedAt)||!instant(run.finishedAt)||Date.parse(run.finishedAt)<Date.parse(run.startedAt)||!string(run.scopeHash,100)) fail('crawler-bad-run')
    const known=new Set(allCareers().filter(c=>!c.custom).map(c=>c.id))
    if(!object(scope)||scope.country!=='MY'||scope.timezone!=='Asia/Kuala_Lumpur'||!ids(scope.roles)||scope.roles.some(id=>!known.has(id))||!ids(scope.skills)||scope.skills.some(id=>!SKILLS[id])) fail('crawler-catalog-mismatch-use-game-config')
    if(!Array.isArray(scope.sources)||!scope.sources.length||scope.sources.some(s=>!object(s)||!['linkedin','indeed','ricebowl'].includes(s.id)||s.type!=='public')||new Set(scope.sources.map(s=>s.id)).size!==scope.sources.length) fail('crawler-bad-sources')
    const sourceIds=new Set(scope.sources.map(s=>s.id)), jobIds=new Set(), sourceKeys=new Set()
    const unavailable=summary?.quality?.unavailableSources??[]
    if(!Array.isArray(unavailable)||unavailable.some(s=>!object(s)||!['linkedin','indeed','ricebowl'].includes(s.id)||sourceIds.has(s.id)||!string(s.error,500)))fail('crawler-bad-unavailable-sources')
    if(!Array.isArray(jobs)||jobs.length>1000) fail('crawler-bad-jobs')
    for(const job of jobs)
    {
        if(!object(job)||!string(job.id,100)||jobIds.has(job.id)||job.country!=='MY'||!string(job.title,1000)||!string(job.company,1000)||typeof job.location!=='string'||job.location.length>2000) fail('crawler-bad-job')
        jobIds.add(job.id)
        if(job.role!=='unmapped'&&!scope.roles.includes(job.role)) fail('crawler-bad-job-role')
        if(typeof job.description!=='string'||job.description.length>100000||job.descriptionAvailable!==Boolean(job.description.trim())) fail('crawler-bad-description')
        if(job.url!==null&&!scope.sources.some(s=>allowedPlatformUrl(job.url,s.id))) fail('crawler-bad-url')
        if((job.postedAt!==null&&!instant(job.postedAt))||(job.postedDate!=null&&!date(job.postedDate))) fail('crawler-bad-posted-date')
        if(!Array.isArray(job.skills)||job.skills.length>scope.skills.length||new Set(job.skills.map(s=>s.id)).size!==job.skills.length||job.skills.some(s=>!object(s)||!scope.skills.includes(s.id)||!string(s.evidence,2000)||s.requirement!=='mentioned')||(!job.descriptionAvailable&&job.skills.length)) fail('crawler-bad-job-skills')
        if(!Array.isArray(job.sources)||!job.sources.length||job.sources.some(s=>!object(s)||!sourceIds.has(s.source)||!string(s.sourceId)||(s.url!==null&&!allowedPlatformUrl(s.url,s.source)))) fail('crawler-bad-job-sources')
        for(const source of job.sources)
        {
            const identity=JSON.stringify([source.source,source.sourceId])
            if(sourceKeys.has(identity)) fail('crawler-duplicate-source-job')
            sourceKeys.add(identity)
        }
    }
    if(!object(summary)||summary.runId!==run.id||summary.scopeHash!==run.scopeHash||summary.status!==run.status||summary.sampleSize!==jobs.length||summary.descriptionCount!==jobs.filter(j=>j.descriptionAvailable).length) fail('crawler-summary-mismatch')
    const tasks=summary.quality?.tasks
    if(!Array.isArray(tasks)||!tasks.length||tasks.some(t=>!['complete','capped'].includes(t.status)||!Number.isInteger(t.pages)||t.pages<1||t.error||!sourceIds.has(t.source))) fail('crawler-unhealthy-tasks')
    const actual=new Map()
    for(const job of jobs)actual.set(job.role,(actual.get(job.role)||0)+1)
    if(!Array.isArray(summary.roles)||summary.roles.some(row=>actual.get(row.id)!==row.count)||new Set(summary.roles.map(row=>row.id)).size!==actual.size) fail('crawler-role-count-mismatch')
    const trend=summary.trend
    if(!object(trend)||!['comparable','insufficient_history'].includes(trend.status)||trend.timezone!=='Asia/Kuala_Lumpur'||!Array.isArray(trend.roles)||!Array.isArray(trend.missingCurrentDays)||!Array.isArray(trend.missingPreviousDays)) fail('crawler-bad-weekly-trend')
    if(trend.status==='comparable'&&(trend.missingCurrentDays.length||trend.missingPreviousDays.length)) fail('crawler-weekly-coverage-missing')
    if(body.sampleHistory!==undefined&&(!Array.isArray(body.sampleHistory)||body.sampleHistory.length>10||body.sampleHistory.some(s=>!object(s)||!string(s.runId,100)||!instant(s.collectedAt)||!Number.isInteger(s.postings)||s.postings<0||(s.newAds!==null&&(!Number.isInteger(s.newAds)||s.newAds<0||s.newAds>s.postings)))))fail('crawler-bad-sample-history')
    for(const row of trend.roles)
    {
        if(!scope.roles.includes(row.id)&&row.id!=='unmapped') fail('crawler-bad-weekly-role')
        if(!Number.isInteger(row.currentCount)||row.currentCount<0||!Number.isInteger(row.previousCount)||row.previousCount<0) fail('crawler-bad-weekly-count')
        const expected=trend.status==='comparable'&&row.previousCount>0?Math.round(10000*(row.currentCount-row.previousCount)/row.previousCount)/100:null
        if(row.growthPct!==expected) fail('crawler-bad-weekly-growth')
    }
    return structuredClone(body)
}

export function crawlerFile()
{
    if(process.env.CRAWLER_DATA_DIR==='off') return null
    const root=process.env.CRAWLER_DATA_DIR??(process.env.SAVE_DIR?path.join(process.env.SAVE_DIR,'crawler'):fileURLToPath(new URL('./data/crawler/',import.meta.url)))
    return path.join(root,'market.json')
}
let previous=null, signature='', previousFile=''
export function readCrawlerState()
{
    const file=crawlerFile()
    if(!file) return null
    try
    {
        const stat=fs.statSync(file), version=`${file}:${stat.mtimeMs}:${stat.size}`
        if(version===signature) return previous
        const envelope=JSON.parse(fs.readFileSync(file,'utf8'))
        if(envelope.sha256!==hash(envelope.data)||!envelope.data.latest) throw new Error('checksum')
        validateCrawlerPayload(envelope.data.latest)
        previous=envelope.data; signature=version; previousFile=file
        return previous
    }
    catch { return previousFile===file?previous:null }
}

export function receiveCrawler(body,key)
{
    const payload=validateCrawlerPayload(body,key), file=crawlerFile()
    if(!file) fail('crawler-ingestion-disabled',503)
    const old=readCrawlerState(), fingerprint=hash(payload), receipt=old?.receipts?.find(r=>r.id===payload.run.id)
    if(receipt)
    {
        if(receipt.hash!==fingerprint) fail('crawler-run-id-conflict',409)
        return {accepted:true,runId:payload.run.id,duplicate:true}
    }
    if(old?.latest&&Date.parse(payload.run.finishedAt)<=Date.parse(old.latest.run.finishedAt)) fail('crawler-stale-run',409)
    const data={latest:payload,receipts:[...(old?.receipts??[]),{id:payload.run.id,hash:fingerprint}].slice(-500),
        months:old?.latest?.run.scopeHash===payload.run.scopeHash?[...(old.months??[])]:[]}
    const period=malaysiaMonth(payload.run.finishedAt)
    const counts=Object.fromEntries(payload.scope.roles.map(id=>[id,payload.jobs.filter(j=>j.role===id).length]))
    const described=payload.jobs.filter(j=>j.descriptionAvailable)
    const shares=Object.fromEntries(payload.scope.skills.map(id=>[id,described.length?Math.round(described.filter(j=>j.skills.some(s=>s.id===id)).length/described.length*1000)/10:null]))
    data.months=data.months.filter(month=>month.period!==period)
    data.months.push({period,runId:payload.run.id,collectedAt:payload.run.finishedAt,counts,shares})
    data.months.sort((a,b)=>a.period.localeCompare(b.period)); data.months=data.months.slice(-24)
    fs.mkdirSync(path.dirname(file),{recursive:true})
    const temporary=file+'.'+crypto.randomUUID()+'.tmp'
    try { fs.writeFileSync(temporary,JSON.stringify({sha256:hash(data),data})); fs.renameSync(temporary,file) }
    finally { if(fs.existsSync(temporary))fs.unlinkSync(temporary) }
    signature=''
    return {accepted:true,runId:payload.run.id,duplicate:false}
}
