import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMarketRows, buildSkillRows } from '../../../../src/game/sources/Career/MarketSeries.js'
import { buildMockMarketHistory } from '../../../../src/game/sources/Career/MockMarketHistory.js'

const shown = ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']

test('changing the selected range updates endpoint counts, monthly changes and sparklines', () => {
    const trends = { periods: ['2024-05', '2024-06', '2024-07', '2026-10'], careers: [
        { id: 'a', ads: [10, 20, 15, 300] }, { id: 'b', ads: [30, 15, 30, 1] },
    ] }
    const june = buildMarketRows(trends, ['2024-05', '2024-06'])
    const july = buildMarketRows(trends, ['2024-06', '2024-07'])
    assert.deepEqual(june.map(row => [row.latest, row.change, row.trend]), [[20, 100, 'rising'], [15, -50, 'falling']])
    assert.deepEqual(july.map(row => [row.latest, row.change, row.trend]), [[15, -25, 'falling'], [30, 100, 'rising']])
    assert.deepEqual(july[0].displayAds, [20, 15])
    assert.equal(july[0].previousPeriod, '2024-06')
    assert.equal(buildMarketRows(trends, ['2024-07'])[0].change, -25)
})

test('a missing selected endpoint does not fall back to current counts', () => {
    const trends = { periods: ['2024-12', '2026-10'], careers: [{id: 'a', ads: [20, 300]}] }
    const row = buildMarketRows(trends, ['2025-01'])[0]
    assert.equal(row.latest, null)
    assert.equal(row.previousPeriod, '2024-12')
    assert.equal(row.change, null)
    assert.equal(row.trend, 'unknown')
})

test('skill trends use selected months and preserve observed zero over simulated shares', () => {
    const trends = { periods: ['2024-06', '2024-07', '2026-10'], skills: [{id: 'sql', share: [20, 0, 80]}] }
    const mock = {sql: {'2024-05': 10, '2024-07': 99}}
    const june = buildSkillRows(trends, ['2024-05', '2024-06'], mock)[0]
    const july = buildSkillRows(trends, ['2024-07'], mock)[0]
    assert.deepEqual(june.series, [10, 20])
    assert.equal(june.points, 10)
    assert.deepEqual(july.series, [0])
    assert.equal(july.latest, 0)
    assert.equal(july.points, -20)
    assert.equal(buildSkillRows(trends, ['2025-01'])[0].points, null)
})

test('rising and falling classifications agree with the displayed heatmap, preserving raw observations', () => {
    // The preview follows each career's big-picture direction (MockMarketHistory.js): ml-engineer up, chef down
    const bigPicture = { careers: { 'ml-engineer': { growth: 0.6 }, chef: { growth: -0.6 } } }
    const trends = { periods:['2026-10'], bigPicture, careers:[{id:'ml-engineer',ads:[31]},{id:'chef',ads:[43]}] }
    const before = structuredClone(trends)
    const preview = buildMockMarketHistory(trends, shown)
    const rows = buildMarketRows(trends, shown, preview)
    for(const row of rows)
    {
        assert.equal(row.trend, row.latest > row.previous ? 'rising' : 'falling')
        assert.equal(row.latest, row.displayAds.at(-1))
        assert.equal(row.previous, row.displayAds.at(-2))
        assert.equal(row.changeOrigin, 'preview')
    }
    assert.deepEqual(trends, before)
})

test('real month observations override preview; missing adjacent months are never compared with distant months', () => {
    const trends = {periods:['2026-09','2026-10'],careers:[{id:'ml-engineer',ads:[50,31]}]}
    const rows = buildMarketRows(trends, shown, buildMockMarketHistory(trends, shown))
    assert.equal(rows[0].trend, 'falling')
    assert.equal(rows[0].change, -38)
    assert.equal(rows[0].changeOrigin, 'observed')
    assert.equal(buildMarketRows({periods:['2026-04','2026-10'],careers:[{id:'x',ads:[20,30]}]}, shown)[0].trend, 'unknown')
})

test('zero denominators avoid invalid percentages and observed zero remains a falling observation', () => {
    const rows = buildMarketRows({periods:['2026-09','2026-10'],careers:[{id:'a',ads:[0,5]},{id:'b',ads:[5,0]}]}, shown)
    assert.equal(rows[0].trend, 'rising')
    assert.equal(rows[0].change, null)
    assert.equal(rows[1].change, -100)
    assert.equal(rows[1].trend, 'falling')
})

test('recovered dated FDE observations override generated history, preserving the current sample', () => {
    const trends = {periods:['2026-10'],careers:[{id:'forward-deployed-engineer',ads:[12]}],careerObservations:{'forward-deployed-engineer':{'2026-09':{value:8,origin:'archived'}}}}
    const preview = buildMockMarketHistory(trends, shown)
    assert.equal(preview.cells['forward-deployed-engineer']['2026-09'],undefined)
    const row = buildMarketRows(trends,shown,preview)[0]
    assert.equal(row.previous,8)
    assert.equal(row.latest,12)
    assert.equal(row.change,null, 'recovered archive counts and a targeted current sample have different collection coverage')
    assert.equal(row.trend,'unknown')
    assert.equal(row.changeOrigin,'incomparable-archive')
})
