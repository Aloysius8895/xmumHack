import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMockMarketHistory } from '../../../../src/game/sources/Career/MockMarketHistory.js'

const months = ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']
const input = () => ({
    sample: true, periods: ['2026-10'],
    careers: [{ id: 'ml-engineer', ads: [31] }, { id: 'chef', ads: [43] }, { id: 'data-analyst', ads: [30] }],
    skills: [{ id: 'sql', share: [25] }],
})

test('all historical gaps are filled with distinct rising and falling career profiles', () => {
    const result = buildMockMarketHistory(input(), months)
    assert.equal(result.count, 18)
    assert.ok(result.cells['ml-engineer']['2026-04'].value < 31)
    assert.ok(result.cells.chef['2026-04'].value > 43)
    for(const row of Object.values(result.cells))
    {
        assert.equal(Object.keys(row).length, 6)
        for(const cell of Object.values(row))
        {
            assert.equal(cell.mock, true)
            assert.ok(Number.isSafeInteger(cell.value) && cell.value >= 0)
        }
        assert.equal(row['2026-10'], undefined, 'the observed October sample stays authoritative')
    }
})

test('observed zero remains zero, gaps are filled, and raw observations and skills are immutable', () => {
    const trends = input()
    trends.periods = ['2026-04','2026-05','2026-10']
    trends.careers = [{id:'data-analyst',ads:[0,null,30]}]
    const before = structuredClone(trends)
    const result = buildMockMarketHistory(trends, months)
    assert.equal(result.cells['data-analyst']['2026-04'], undefined)
    assert.ok(result.cells['data-analyst']['2026-05'])
    assert.deepEqual(trends, before)
})

test('refreshing and changing the selected month range preserve the same historical values', () => {
    const trends = input()
    const full = buildMockMarketHistory(trends, months)
    assert.deepEqual(buildMockMarketHistory(trends, months), full)
    const short = buildMockMarketHistory(trends, months.slice(-3))
    for(const career of trends.careers)
        for(const period of ['2026-08','2026-09'])
            assert.deepEqual(short.cells[career.id][period], full.cells[career.id][period])
})

test('later months are not fabricated for a stale observed sample; unseen careers get a stable fallback', () => {
    const trends = input()
    const result = buildMockMarketHistory(trends, [...months, '2026-11'])
    assert.equal(result.cells.chef['2026-11'], undefined)
    assert.equal(buildMockMarketHistory({}).count, 0)
    const missing = {periods:['2026-10'],careers:[{id:'new-career',ads:[null]}]}
    const fallback = buildMockMarketHistory(missing, months)
    assert.equal(fallback.count, 7)
    assert.equal(fallback.cells['new-career']['2026-10'].mock, true)
    assert.deepEqual(buildMockMarketHistory(missing, months), fallback)
})
