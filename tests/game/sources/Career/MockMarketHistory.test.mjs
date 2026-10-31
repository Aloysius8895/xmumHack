import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMockMarketHistory, buildMockSkillHistory } from '../../../../src/game/sources/Career/MockMarketHistory.js'

const months = ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']
// Big-picture directions (server/big-picture.js): ml-engineer up, chef down, data-analyst none; JobStreet 2025 shares
// only place a career never collected
const bigPicture = { careers: { 'ml-engineer': { growth: 0.6 }, chef: { growth: -0.6 } }, skills: { sql: { growth: -0.5 } } }
const yearOnYear = { careers: { 'ml-engineer': { to: { share: 2 } }, chef: { to: { share: 1 } }, 'data-analyst': { to: { share: 3 } }, 'new-career': { to: { share: 1.5 } } } }
const input = () => ({
    sample: true, periods: ['2026-10'], yearOnYear, bigPicture,
    careers: [{ id: 'ml-engineer', ads: [31] }, { id: 'chef', ads: [43] }, { id: 'data-analyst', ads: [30] }],
    skills: [{ id: 'sql', share: [25] }],
})

test('historical gaps follow the big-picture direction of each career: rising, falling, or none without one', () => {
    const result = buildMockMarketHistory(input(), months)
    assert.equal(result.count, 18)
    assert.equal(result.method, 'yoy-anchored-v2')
    assert.ok(result.cells['ml-engineer']['2026-04'].value < 31)
    assert.ok(result.cells.chef['2026-04'].value > 43)
    // no direction: only the seeded wave, within its size
    for(const cell of Object.values(result.cells['data-analyst']))
        assert.ok(Math.abs(cell.value - 30) <= 30 * 0.13)
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

test('a career never collected takes its JobStreet share of the collected postings; none without a share', () => {
    const trends = input()
    assert.equal(buildMockMarketHistory(trends, [...months, '2026-11']).cells.chef['2026-11'], undefined)
    assert.equal(buildMockMarketHistory({}).count, 0)
    trends.careers.push({ id: 'new-career', ads: [null] }, { id: 'no-share', ads: [null] })
    const result = buildMockMarketHistory(trends, months)
    // collected 31 + 43 + 30 = 104 postings for JobStreet shares 2 + 1 + 3 = 6: 1.5 / 6 of 104 = 26
    assert.equal(result.cells['new-career']['2026-10'].anchorValue, 26)
    assert.equal(result.cells['new-career']['2026-10'].mock, true)
    assert.equal(result.cells['no-share'], undefined)
    assert.deepEqual(buildMockMarketHistory(trends, months), result)
})

test('skill shares follow their big-picture direction, keep collected months and are repeatable', () => {
    const trends = { periods: [ '2026-10' ], bigPicture, skills: [ { id: 'sql', share: [ 40 ] }, { id: 'none', share: [ null ] } ] }
    const mock = buildMockSkillHistory(trends, [ '2026-04', '2026-09', '2026-10' ])
    assert.equal(mock.sql['2026-10'], undefined)
    assert.ok(mock.sql['2026-04'] > 40)
    assert.deepEqual(buildMockSkillHistory(trends, [ '2026-08' ]), buildMockSkillHistory(trends, [ '2026-08' ]))
    assert.equal(mock.none, undefined)
})
