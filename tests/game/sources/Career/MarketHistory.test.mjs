import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarketHistory } from '../../../../src/game/sources/Career/MarketHistory.js'
import { t } from '../../../../src/game/sources/Career/i18n.js'

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const options = { t, esc, locale:'zh-CN', short:period=>`${Number(period.slice(5))}月`, rangeLabel:(a,b)=>`${a} – ${b}` }

test('historical chart keeps gaps empty, breaks the line at missing observations, and cites each source', () => {
    const html = renderMarketHistory({periods:['2026-04','2026-05','2026-06','2026-07'],series:[{id:'dosm',sourceUrl:'https://www.dosm.gov.my/',values:[20,null,10,30]}]}, options)
    assert.equal((html.match(/<circle /g) ?? []).length, 3)
    assert.equal((html.match(/<polyline /g) ?? []).length, 1)
    const points = html.match(/<polyline[^>]+points="([^"]+)"/)[1].split(' ')
    assert.equal(points.length, 2, 'only June and July are joined; the April point is isolated')
    assert.match(html, /2026-05: 未取得数据/)
    assert.match(html, /href="https:\/\/www.dosm.gov.my\/"/)
    assert.doesNotMatch(html, /NaN|undefined/)
    assert.match(html, /不是零/)
})

test('no history renders no section; quarterly occupation values stay in their own table', () => {
    assert.equal(renderMarketHistory(null, options), '')
    const html = renderMarketHistory({periods:['2026-04'],series:[{id:'dosm',sourceUrl:'https://www.dosm.gov.my/',values:[null]}],quarterly:{sourceUrl:'https://www.dosm.gov.my/',periods:['2026-Q1','2026-Q2'],occupations:[{id:'software_developers',values:[20089,19899]}]}}, options)
    assert.equal((html.match(/<circle /g) ?? []).length, 0)
    assert.match(html, /2026-Q2/)
    assert.match(html, /其中：软件开发人员/)
    assert.match(html, /20,089/)
    assert.match(html, /19,899/)
})

test('monthly table displays source totals in the correct months and keeps zero distinct from missing', () => {
    const html = renderMarketHistory({periods:['2026-04','2026-05'],series:[
        {id:'dosm',sourceUrl:'https://www.dosm.gov.my/?a=1&b=2',values:[225826,null]},
        {id:'techmap',sourceUrl:'https://jobdatafeeds.com/data/countries/my',values:[0,59559]},
    ]}, options)
    const table = html.match(/<table class="career-history-monthly">([\s\S]*?)<\/table>/)?.[1]
    assert.ok(table, 'saved monthly values are readable without interpreting charts')
    const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => match[1])
    assert.match(rows[0], /DOSM[\s\S]*Techmap/)
    assert.match(rows[1], /2026-04[\s\S]*225,826[\s\S]*>0<\/td>/)
    assert.match(rows[2], /2026-05[\s\S]*未取得数据[\s\S]*59,559/)
    assert.match(table, /href="https:\/\/www.dosm.gov.my\/\?a=1&amp;b=2"/)
    assert.doesNotMatch(table, /NaN|undefined/)
})

test('DOSM explains publication gaps using the verified coverage and total', () => {
    const html = renderMarketHistory({periods:['2026-04','2026-05','2026-06','2026-07'],series:[
        {id:'dosm',sourceUrl:'https://www.dosm.gov.my/',values:[225826,200730,128953,null]},
    ]}, options)
    assert.match(html, /DOSM 按季度发布/)
    assert.match(html, /2026-04 – 2026-06/)
    assert.match(html, /555,509/)
    assert.match(html, /其余月份尚未取得可核验数据/)
    assert.doesNotMatch(html, /\{range\}|\{n\}/)

    const empty = renderMarketHistory({periods:['2026-11'],series:[
        {id:'dosm',sourceUrl:'https://www.dosm.gov.my/',values:[null]},
    ]}, options)
    assert.match(empty, /目前尚未取得这些月份的可核验数据/)
    assert.doesNotMatch(empty, /NaN|undefined|\{range\}|\{n\}/)
})
