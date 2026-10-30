import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMarketRows } from '../../../../src/game/sources/Career/MarketSeries.js'
import { buildMockMarketHistory } from '../../../../src/game/sources/Career/MockMarketHistory.js'

const shown = ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']

test('rising and falling classifications agree with the displayed heatmap, preserving raw observations', () => {
    const trends = { periods:['2026-10'], careers:[{id:'ml-engineer',ads:[31]},{id:'chef',ads:[43]}] }
    const before = structuredClone(trends)
    const preview = buildMockMarketHistory(trends, shown)
    const rows = buildMarketRows(trends, shown, preview)
    assert.equal(rows[0].trend, 'rising')
    assert.equal(rows[1].trend, 'falling')
    for(const row of rows)
    {
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
