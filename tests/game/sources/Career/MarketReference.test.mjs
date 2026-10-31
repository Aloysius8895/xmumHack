import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MAX_RANGE_MONTHS, chosenRange, limitRange, monthsBetween, rangeLength, referenceView, yearOnYearColumn, yearOnYearText } from '../../../../src/game/sources/Career/MarketReference.js'
import { t } from '../../../../src/game/sources/Career/i18n.js'

const esc = (value) => String(value)
const reference = { id: 'jobstreet-2024', postings: 1000, from: '2024-02-22', to: '2024-06-20', url: 'https://huggingface.co/datasets/x', licence: 'CC BY 4.0', author: 'A',
    months: [ '2024-02', '2024-03' ], monthTotals: { '2024-02': 200, '2024-03': 800 }, partialMonths: [ '2024-02' ],
    careers: { accountant: { byMonth: { '2024-02': 20, '2024-03': 40 } }, teacher: { byMonth: { '2024-03': 8 } } } }
const careers = [ { id: 'accountant', careerId: 'accountant' }, { id: 'teacher', careerId: 'teacher' }, { id: 'custom-x', careerId: 'custom-x' } ]

test('the range menus cover every month and swap a reversed choice', () =>
{
    assert.deepEqual(monthsBetween('2024-11', '2025-02'), [ '2024-11', '2024-12', '2025-01', '2025-02' ])
    const months = monthsBetween('2024-02', '2026-10')
    assert.equal(months.length, 33)
    assert.deepEqual(chosenRange(months, {}, [ '2026-04', '2026-10' ]).shown.length, 7)
    const swapped = chosenRange(months, { marketFrom: '2024-06', marketTo: '2024-03' }, [ '2026-04', '2026-10' ])
    assert.deepEqual([ swapped.from, swapped.to, swapped.shown.length ], [ '2024-03', '2024-06', 4 ])
    // the menus refuse more than nine months, in either order
    assert.equal(MAX_RANGE_MONTHS, 9)
    assert.equal(rangeLength('2024-02', '2024-10'), 9)
    assert.equal(rangeLength('2024-11', '2024-02'), 10)
    // past nine months the month just chosen stays and the other end moves to the limit, never a dead end
    assert.deepEqual(limitRange('from', '2024-02', '2026-10'), { from: '2024-02', to: '2024-10', adjusted: 'to' })
    assert.deepEqual(limitRange('to', '2026-10', '2024-02'), { from: '2026-02', to: '2026-10', adjusted: 'from' })
    assert.deepEqual(limitRange('to', '2024-10', '2026-04'), { from: '2024-10', to: '2025-06', adjusted: 'to' })
    assert.deepEqual(limitRange('to', '2026-10', '2026-04'), { from: '2026-04', to: '2026-10', adjusted: null })
})

test('JobStreet months show the career share of that month, a zero when absent, nothing for an unknown career', () =>
{
    const view = referenceView([ reference ], [ '2024-02', '2024-03', '2024-04' ], careers, { t, esc, label: (m) => m, withYear: (m) => m })
    assert.equal(view.isReference('2024-03'), true)
    assert.equal(view.isReference('2024-04'), false)
    assert.match(view.cell(careers[0], '2024-02'), /<span>10%<\/span>/)        // 20 of 200
    assert.match(view.cell(careers[0], '2024-03'), /<span>5\.0%<\/span>/)      // 40 of 800
    assert.match(view.cell(careers[1], '2024-02'), /<span>0\.0%<\/span>/)      // listed career, none that month
    assert.match(view.cell(careers[2], '2024-03'), /is-empty/)
    assert.match(view.head('2024-02'), /2024-02\*<small>JobStreet/)          // partial month
    assert.match(view.notes, /CC BY 4\.0/)
    // out of range: no column, no note
    assert.equal(referenceView([ reference ], [ '2026-10' ], careers, { t, esc, label: String, withYear: String }).notes, '')
})

test('the 2024→2025 column needs both years on screen and says when a sample is too small', () =>
{
    const side = (weightedShare, margin) => ({ weightedShare, margin })
    const trend = { window: { periods: [ { from: '2024-03-04', to: '2024-05-08' } ] }, careers: {
        accountant: { growth: Math.log(0.94), significant: true, from: side(6.32, 0.2), to: side(5.92, 0.2) }, teacher: { growth: null, reason: 'thin' },
        auditor: { growth: Math.log(1.02), significant: false, from: side(0.5, 0.1), to: side(0.51, 0.2) } } }
    assert.equal(yearOnYearColumn(trend, 1, { t, esc }), null)
    const column = yearOnYearColumn(trend, 2, { t, esc })
    assert.match(column.cell(careers[0]), /↓ -6%/)
    assert.match(column.cell(careers[1]), /—/)
    assert.equal(yearOnYearText(trend.careers.teacher, { t }).text, t('market.yoy.thin'))
    // within the margins: no arrow
    assert.equal(yearOnYearText(trend.careers.auditor, { t }).arrow, '≈')
    assert.match(yearOnYearText(trend.careers.auditor, { t }).text, /±0\.10/)
})

test('every new text exists in the three languages', () =>
{
    const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/i18n.js', import.meta.url), 'utf8')
    for(const key of [ 'market.range.from', 'market.range.to', 'market.range.tooLong', 'market.national.value', 'market.national.none', 'market.national.note', 'market.reference.cell', 'market.reference.note', 'market.yoy.title',
        'market.yoy.thin', 'market.yoy.detail', 'market.yoy.unclear', 'market.yoy.note', 'careers.yoy' ])
    {
        const line = source.split('\n').find((row) => row.includes(`'${key}':`))
        assert.ok(line, key)
        for(const lang of [ 'zh', 'en', 'ms' ])
            assert.match(line, new RegExp(`${lang}: '[^']+'`), `${key}.${lang}`)
    }
})

test('simulated skill shares keep collected months and follow a repeatable path', async () =>
{
    const { buildMockSkillHistory } = await import('../../../../src/game/sources/Career/MockMarketHistory.js')
    const trends = { periods: [ '2026-10' ], skills: [ { id: 'sql', share: [ 40 ] }, { id: 'none', share: [ null ] } ] }
    const mock = buildMockSkillHistory(trends, [ '2026-08', '2026-09', '2026-10' ])
    assert.equal(mock.sql['2026-10'], undefined)            // collected: kept
    assert.ok(mock.sql['2026-08'] > 0 && mock.sql['2026-09'] > 0)
    assert.deepEqual(buildMockSkillHistory(trends, [ '2026-08' ]), buildMockSkillHistory(trends, [ '2026-08' ]))
    assert.equal(mock.none, undefined)                      // nothing to anchor on
})
