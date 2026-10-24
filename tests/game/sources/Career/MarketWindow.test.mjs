import test from 'node:test'
import assert from 'node:assert/strict'
import { marketMonthWindow } from '../../../../src/game/sources/Career/MarketWindow.js'

test('October shows April through October, even without career history', () => {
    assert.deepEqual(marketMonthWindow(7, new Date('2026-10-24T04:00:00Z')), [
        '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ])
})

test('November advances the seven-month window independently of collection dates', () => {
    assert.deepEqual(marketMonthWindow(7, new Date('2026-11-01T04:00:00Z')), [
        '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
    ])
})

test('calendar arithmetic crosses years and supports the selected range', () => {
    assert.deepEqual(marketMonthWindow(7, new Date('2027-01-15T04:00:00Z')), [
        '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01',
    ])
    assert.deepEqual(marketMonthWindow(3, new Date('2027-01-15T04:00:00Z')), ['2026-11', '2026-12', '2027-01'])
})

test('the month changes at midnight in Malaysia regardless of the browser timezone', () => {
    assert.equal(marketMonthWindow(7, new Date('2026-10-31T15:59:59Z')).at(-1), '2026-10')
    assert.equal(marketMonthWindow(7, new Date('2026-10-31T16:00:00Z')).at(-1), '2026-11')
})
