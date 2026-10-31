import assert from 'node:assert/strict'
import test from 'node:test'
import { momentumFrom, comparableMonths, slope, label, MIN_MONTHS, loadMockMonths } from '../../../src/game/server/skill-momentum.js'

const month = (period, share, { thin = false, denominator = 80, sources = [ 'linkedin' ], postings = 100, counts = { 'data-analyst': 20 } } = {}) =>
    ({ period, shares: { sql: share, python: 30 }, counts, postings, denominator, thin, sources })

test('slope is the least-squares fit', () =>
{
    assert.equal(slope([ { x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 } ]), 2)
    assert.equal(slope([ { x: 1, y: 1 } ]), null)
})

test('three rising months are rising, with the annualised log growth', () =>
{
    const result = momentumFrom({ months: [ month('2026-07', 20), month('2026-08', 22), month('2026-09', 24.2) ] })
    assert.equal(result.skills.sql.label, 'rising')
    assert.ok(Math.abs(result.skills.sql.growth - Math.log(1.1) * 12) < 0.001)
    assert.equal(result.skills.sql.confidence, 'medium')
    assert.equal(result.skills.python.label, 'stable')
    assert.deepEqual(result.basis, { months: 3, realMonths: 3, mockMonths: 0, from: '2026-07', through: '2026-09', sources: [ 'linkedin' ], metric: 'share_of_described_postings' })
})

test('falling shares are declining only with enough months', () =>
{
    const falling = [ month('2026-07', 30), month('2026-08', 25), month('2026-09', 20) ]
    assert.equal(momentumFrom({ months: falling }).skills.sql.label, 'declining')
    for(let count = 1; count < MIN_MONTHS; count++)
    {
        const few = momentumFrom({ months: falling.slice(- count) }).skills.sql
        assert.equal(few.growth, null)
        assert.equal(few.label, 'current', 'a single snapshot is current demand, never declining')
        assert.equal(few.confidence, 'low')
    }
})

test('thin months, other source sets and legacy months without a sample size are not compared', () =>
{
    const months = [
        { period: '2026-05', shares: { sql: 10 }, counts: {} },              // legacy: no denominator
        month('2026-06', 12, { sources: [ 'linkedin', 'ricebowl' ] }),
        month('2026-07', 14, { thin: true, denominator: 12 }),
        month('2026-08', 16),
        month('2026-09', 18),
    ]
    assert.deepEqual(comparableMonths(months).map((entry) => entry.period), [ '2026-08', '2026-09' ])
    assert.equal(momentumFrom({ months }).skills.sql.label, 'current')
})

test('career momentum uses the share of postings, not the count', () =>
{
    const months = [
        month('2026-07', 20, { postings: 100, counts: { 'data-analyst': 20 } }),
        month('2026-08', 20, { postings: 200, counts: { 'data-analyst': 40 } }),   // twice the adverts, same share
        month('2026-09', 20, { postings: 400, counts: { 'data-analyst': 80 } }),
    ]
    assert.equal(momentumFrom({ months }).careers['data-analyst'].label, 'stable')
})

test('official signals travel with the id', () =>
{
    const official = [ { kind: 'skill', id: 'sql', signal: 'critical', source: 'MyCOL 2024/2025', publishedAt: '2025' } ]
    const result = momentumFrom({ months: [ month('2026-09', 20) ] }, { official })
    assert.deepEqual(result.skills.sql.official, official)
    assert.deepEqual(result.skills.python.official, [])
})

test('no window at all is an empty, current-demand result', () =>
{
    const result = momentumFrom(null)
    assert.deepEqual(result.skills, {})
    assert.equal(result.basis.months, 0)
    assert.equal(label(null), 'current')
})

test('mock months fill in before the real ones, marked, with the confidence of the real months only', () =>
{
    const mock = [ '2026-06', '2026-07', '2026-08', '2026-09' ].map((period, index) => ({ period, mock: true, shares: { sql: 20 + index, python: 10 }, counts: {}, postings: 100 }))
    const result = momentumFrom({ months: [ month('2026-09', 30), month('2026-10', 24.2) ] }, { mockMonths: mock })
    // 2026-09 is real: its mock month is dropped
    assert.deepEqual(result.basis.realMonths, 2)
    assert.deepEqual(result.basis.mockMonths, 3)
    assert.equal(result.basis.from, '2026-06')
    assert.equal(result.skills.sql.mock, true)
    assert.equal(result.skills.sql.mockMonths, 3)
    assert.equal(result.skills.sql.confidence, 'low')
    assert.notEqual(result.skills.sql.growth, null)
})

test('mock months are no longer read once three real months compare, and never after the latest real one', () =>
{
    const mock = [ '2026-06', '2026-11' ].map((period) => ({ period, mock: true, shares: { sql: 50 }, counts: {}, postings: 100 }))
    const real = [ month('2026-07', 20), month('2026-08', 22), month('2026-09', 24.2) ]
    const enough = momentumFrom({ months: real }, { mockMonths: mock })
    assert.equal(enough.basis.mockMonths, 0)
    assert.equal(enough.skills.sql.mock, undefined)
    assert.deepEqual(enough.skills.sql, momentumFrom({ months: real }).skills.sql)
    const two = momentumFrom({ months: real.slice(1) }, { mockMonths: mock })
    assert.equal(two.basis.through, '2026-09')
    assert.equal(two.basis.mockMonths, 1)
})

test('the mock month file is generated, marked and anchored on collected data', () =>
{
    const months = loadMockMonths()
    if(!months.length)
        return
    for(const row of months)
    {
        assert.equal(row.mock, true)
        assert.match(row.period, /^\d{4}-\d{2}$/)
        assert.equal(row.thin, false)
    }
})
