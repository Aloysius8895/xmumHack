import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {renderSamplingDiagnostics,renderUpdateLog} from '../../../../src/game/sources/Career/MarketSampling.js'
import {t} from '../../../../src/game/sources/Career/i18n.js'   // the game's own texts, Chinese by default

const esc=value=>String(value)
const now=Date.parse('2026-10-30T04:00:00.000Z')   // 12:00 Malaysia time
const collection={lastCollectedAt:'2026-10-30T03:45:00.000Z',nextScheduledAt:'2026-10-31T00:00:00.000Z',cooldownUntil:'2026-10-30T04:15:00.000Z',
    collectedAt:'2026-10-30T03:45:00.000Z',postings:412,window:{days:30}}
const render=refresh=>renderSamplingDiagnostics(null,{t,esc,locale:'en-GB',refresh:{now,collection,...refresh}})

test('shows the accumulated window, the last and the next collection',()=>{
    const html=render({})
    assert.match(html,/最近 30 天累积 · 412 则职位/)
    assert.match(html,/上次更新：15 分钟前/)
    assert.match(html,/下次自动更新：/)
})

test('the button waits for the cooldown and says until when',()=>{
    const html=render({})
    assert.match(html,/data-action="market-refresh"[^>]*disabled/)
    assert.match(html,/12:15 后可再刷新/)
    const open=renderSamplingDiagnostics(null,{t,esc,locale:'en-GB',refresh:{now:now+20*60000,collection}})
    assert.doesNotMatch(open,/data-action="market-refresh"[^>]*disabled/)
})

test('an incremental result reports new, updated and unchanged adverts, or that nothing is new',()=>{
    assert.match(render({result:{status:'published',newAds:3,changedAds:1,unchangedAds:40}}),/新增 3 则、更新 1 则，40 则没有变化/)
    assert.match(render({result:{status:'published',newAds:0,changedAds:0,unchangedAds:40}}),/上次采集之后没有新数据/)
    assert.match(render({result:{status:'published',postings:12,newAds:3,previouslySeen:9}}),/样本已更新/,'a full (non-incremental) run keeps the original message')
})

test('cooldown and unreachable service errors explain themselves with times, not a generic failure',()=>{
    assert.match(render({result:{status:'failed',error:'crawler-cooldown',cooldownUntil:'2026-10-30T04:15:00.000Z'}}),/12:15 后才能再次 Refresh/)
    assert.match(render({result:{status:'failed',error:'crawler-unavailable'}}),/正在显示截至 .+ 的数据/)
})

test('every new text exists in the three languages',()=>{
    const source=fs.readFileSync(new URL('../../../../src/game/sources/Career/i18n.js',import.meta.url),'utf8')
    for(const key of ['market.refresh.last','market.refresh.never','market.refresh.next','market.refresh.window','market.refresh.cooldownShort','market.refresh.justNow',
        'market.refresh.minutesAgo','market.refresh.hoursAgo','market.refresh.daysAgo','market.refresh.doneIncremental','market.refresh.nothingNew','market.refresh.offline','error.crawler-cooldown',
        'market.updates.title','market.updates.since','market.updates.share','market.updates.postings','market.updates.official','market.updates.sourceLink','market.updates.roadmap','market.updates.note','market.updates.seen','market.updates.none',
        'market.updates.direction','market.updates.directionHint','market.updates.directionSave','market.updates.directionSkills','market.updates.directionNone','market.updates.directionUnmatched','error.bad-learning-direction'])
    {
        const line=source.split('\n').find(row=>row.includes(`'${key}':`))
        assert.ok(line,key)
        for(const lang of ['zh','en','ms'])assert.match(line,new RegExp(`${lang}:'[^']+'`),`${key}.${lang}`)
    }
})

const names={skill:id=>({sql:'SQL',python:'Python'})[id]??id,career:id=>({'data-analyst':'数据分析师'})[id]??id}
test('the update log lists what changed for the player, and nothing before the starting point',()=>{
    assert.equal(renderUpdateLog({baseline:false,changes:[],count:0},{t,esc,locale:'en-GB',names}),'')
    const log={baseline:true,seenAt:'2026-10-29T04:00:00.000Z',count:3,affectedRoadmapSkills:['sql'],changes:[
        {kind:'skill-share',skillId:'sql',careers:['data-analyst'],from:50,to:58.8,delta:8.8,sample:{from:40,to:51}},
        {kind:'new-postings',careerId:'data-analyst',added:11,sample:true},
        {kind:'official',careerId:'data-analyst',source:'MyCOL 2024/2025',page:7,url:'https://example.org/mycol.pdf'}]}
    const html=renderUpdateLog(log,{t,esc,locale:'en-GB',names})
    assert.match(html,/SQL：职位占比 50% → 58.8%（\+8.8 个百分点，51 则有描述的职位）/)
    assert.match(html,/数据分析师：样本新增 11 则职位/)
    assert.match(html,/MyCOL 2024\/2025，第 7 页/)
    assert.match(html,/href="https:\/\/example.org\/mycol.pdf"/)
    assert.match(html,/影响你路线图里的技能：SQL/)
    assert.match(html,/data-action="updates-seen"/)
    const quiet=renderUpdateLog({...log,count:0,changes:[],affectedRoadmapSkills:[]},{t,esc,locale:'en-GB',names})
    assert.match(quiet,/目前没有值得注意的变化/)
    assert.doesNotMatch(quiet,/updates-seen/)
})

test('the learning direction form shows the matched skills and what matched nothing',()=>{
    const log={baseline:true,seenAt:'2026-10-29T04:00:00.000Z',count:0,changes:[],affectedRoadmapSkills:[]}
    const html=renderUpdateLog(log,{t,esc,locale:'en-GB',names,direction:{saved:{text:'Python SQL 跳舞',skillIds:['python','sql'],unmatched:['跳舞']}}})
    assert.match(html,/data-draft="learningDirection"[^>]*value="Python SQL 跳舞"/)
    assert.match(html,/对应的技能：Python, SQL · 未对应：跳舞/)
    assert.match(html,/data-action="learning-direction"/)
    assert.match(renderUpdateLog(log,{t,esc,locale:'en-GB',names,direction:{draft:'cad'}}),/value="cad"/)
})

test('the market heatmap shows no simulated months (D5)',()=>{
    const source=fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js',import.meta.url),'utf8')
    assert.doesNotMatch(source,/buildMockMarketHistory/)
})
