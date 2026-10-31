import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'real-data-'))
test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

const { buildReference, referenceMarkets } = await import('../../../src/game/server/reference-market.js')
const { buildTrend } = await import('../../../src/game/server/reference-trend.js')
const { defaultInputs } = await import('../../../src/game/server/scenarios.js')
const { change, commonWindow, weigh } = await import('../../../src/data/scripts/jobstreet-yoy.mjs')
const { significant, stratumWeights, weightedShare } = await import('../../../src/data/scripts/weighting.mjs')
const { mycolTimeline } = await import('../../../src/game/server/official-signals.js')
const { renderMycolTimeline } = await import('../../../src/game/sources/Career/OfficialRecord.js')
const { t } = await import('../../../src/game/sources/Career/i18n.js')
const game = await import('../../../src/game/server/game.js')
const store = await import('../../../src/game/server/store.js')

const SHA = 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263'
const SHA_2024 = '4bdd026944f1c2527402ca5ee7b83d63b3a82e6acaa4c78898a9ee90430b45c7'
const reference = (patch = {}) => ({ source: { sha256: SHA, url: 'https://huggingface.co/datasets/seemarn/jobstreet', platform: 'JobStreet' },
    period: { from: '2025-03-04', to: '2025-05-08', partialMonths: [ '2025-03', '2025-05' ] }, postings: 200, months: { '2025-03': 90, '2025-04': 100, '2025-05': 10, undated: 0 },
    careers: { teacher: { postings: 12, byMonth: { '2025-03': 5, '2025-04': 6, '2025-05': 1 } }, chef: { postings: 0, byMonth: {} } }, ...patch })

test('a JobStreet reference keeps its monthly counts and totals, and refuses a file built from another dataset', () =>
{
    const built = buildReference(reference(), 'jobstreet-2025')
    assert.deepEqual(built.careers.teacher, { postings: 12, share: 6, byMonth: { '2025-03': 5, '2025-04': 6, '2025-05': 1 } })
    assert.deepEqual(built.months, [ '2025-03', '2025-04', '2025-05' ])
    assert.deepEqual(built.monthTotals, { '2025-03': 90, '2025-04': 100, '2025-05': 10 })
    assert.deepEqual(built.partialMonths, [ '2025-03', '2025-05' ])
    // the 2025 file is not accepted as the 2024 dataset
    assert.throws(() => buildReference(reference(), 'jobstreet-2024'), /reference-invalid/)
    assert.throws(() => buildReference(reference({ careers: { teacher: { postings: 1.5 } } }), 'jobstreet-2025'), /reference-invalid-career/)
    assert.deepEqual(referenceMarkets('off'), [])
    assert.deepEqual(referenceMarkets(path.join(process.env.SAVE_DIR, 'missing')), [])
})

test('weighting: the sample takes the DOSM mix, unknown postings keep weight 1, margins use the effective size', () =>
{
    // 80% professionals in the sample, 50% in DOSM: each professional counts 0.625, each manager 2.5
    const groups = [ ...Array(8).fill('professionals'), ...Array(2).fill('managers'), null ]
    const weights = stratumWeights(groups, { professionals: 0.5, managers: 0.5 })
    assert.deepEqual(weights, { professionals: 0.625, managers: 2.5 })
    const { postings, unknown } = weigh(groups.map((group, index) => ({ group, role: index < 8 ? 'a' : 'b', described: false, skills: [] })), { professionals: 0.5, managers: 0.5 })
    assert.equal(unknown, 1)
    assert.equal(postings.at(- 1).weight, 1)
    const share = weightedShare(postings.slice(0, 10), (posting) => posting.role === 'a')
    assert.equal(Math.round(share.share), 50)
    assert.ok(share.nEff < 10 && share.margin > 0)
    assert.equal(significant({ share: 10, margin: 1 }, { share: 11, margin: 1 }), false)
    assert.equal(significant({ share: 10, margin: 1 }, { share: 13, margin: 1 }), true)
})

test('year on year: the same window in both years, a change within the margins is no clear change', () =>
{
    assert.deepEqual(commonWindow([ { from: '2024-02-22', to: '2024-06-20' }, { from: '2025-03-04', to: '2025-05-08' } ]), { from: '03-04', to: '05-08' })
    assert.throws(() => commonWindow([ { from: '2024-02-01', to: '2024-02-20' }, { from: '2025-03-04', to: '2025-05-08' } ]), /do not overlap/)
    const rows = (hits, total) => Array.from({ length: total }, (_, index) => ({ role: index < hits ? 'x' : 'y', weight: 1 }))
    const big = change(rows(100, 1000), rows(300, 1000), (row) => row.role === 'x')
    assert.equal(big.significant, true)
    assert.ok(big.growth > 1)
    const small = change(rows(100, 1000), rows(105, 1000), (row) => row.role === 'x')
    assert.deepEqual([ small.significant, small.reason ], [ false, 'within-margin' ])
    assert.equal(change(rows(29, 1000), rows(100, 1000), (row) => row.role === 'x').reason, 'thin')
})

test('the JobStreet yearly change is checked on load and stays out of the scenario model', () =>
{
    const side = (adjustedShare) => ({ count: 100, share: adjustedShare, adjustedShare })
    const trend = buildTrend({ sources: [ { sha256: SHA_2024 }, { sha256: SHA } ], metrics: { careers: 'c', skills: 's' },
        window: { from: '2024-03-04', to: '2025-05-08', periods: [ { from: '2024-03-04', to: '2024-05-08' }, { from: '2025-03-04', to: '2025-05-08' } ] },
        careers: { teacher: { from: side(1), to: side(1.2), points: 0.2, growth: 0.1823 } }, skills: { excel: { from: side(1), to: side(1), growth: null, reason: 'thin' } } })
    assert.equal(trend.careers.teacher.growth, 0.1823)
    assert.equal(trend.skills.excel.reason, 'thin')
    assert.throws(() => buildTrend({ sources: [ { sha256: 'x' }, { sha256: SHA } ] }), /trend-invalid/)
    // the model reads collected momentum only: no growth comes from the JobStreet comparison
    const { momentum } = defaultInputs()
    for(const block of [ momentum.skills, momentum.careers ])
        for(const row of Object.values(block))
            assert.notEqual(row.basis?.source, 'jobstreet-yoy')
})

test('a career across the MyCOL editions: listed with its quote, not listed, or not covered', () =>
{
    const sources = {
        'mycol-2018-2019': { period: '2018/2019', url: 'https://x/a.pdf', scope: 'national, all sectors' },
        'mycol-2022-2023': { period: '2022/2023', url: 'https://x/b.pdf', scope: 'three pilot sectors only: aerospace' },
        'mycol-2016-2017': { period: '2016/2017', url: 'https://x/c.pdf', scope: 'national, all sectors' },
        'impact-phase2-vol2': { period: '2025', url: 'https://x/d.pdf' },
    }
    const signals = [ { kind: 'career', id: 'chef', signal: 'critical', sourceId: 'mycol-2018-2019', page: 11, quote: 'Chef de partie' } ]
    const timeline = mycolTimeline('chef', { signals, sources })
    assert.deepEqual(timeline.map((row) => [ row.period, row.status ]), [ [ '2016/2017', 'not-listed' ], [ '2018/2019', 'listed' ], [ '2022/2023', 'limited' ] ])
    assert.equal(timeline[1].page, 11)

    const html = renderMycolTimeline(timeline, { t, esc: String })
    assert.match(html, /<details>[\s\S]*Chef de partie[\s\S]*原文第 11 页/)
    assert.match(html, /该版未覆盖/)
    assert.equal(renderMycolTimeline([], { t, esc: String }), '')
})

test('the client view carries no authored market numbers', () =>
{
    const view = game.view(store.createSave(), { mock: true })
    for(const career of view.careers)
    {
        // Without collected postings (this test has none) heat is null, never a fixed 80/60/30
        assert.equal(career.market.heat, null, career.id)
        assert.equal(career.market.demand, undefined, career.id)
        assert.ok(Array.isArray(career.mycol), career.id)
    }
    for(const [ id, detail ] of Object.entries(view.skillDetails))
    {
        assert.equal(detail.heat, null, id)
        assert.equal(detail.demand, undefined, id)
    }
    assert.equal(view.trends.demo, false)
})

test('the national estimate weights our collected postings to the latest DOSM quarter, with margins', async () =>
{
    const { nationalEstimate } = await import('../../../src/game/server/national-estimate.js')
    const file = path.join(process.env.SAVE_DIR, 'dosm.json')
    fs.writeFileSync(file, JSON.stringify({ quarters: {
        '2025-Q1': { shares: { professionals: 0.9, managers: 0.1 } },
        '2026-Q2': { shares: { professionals: 0.5, managers: 0.5 } } } }))
    // 8 engineers (professionals) and 2 managers: weighted to 50 / 50, the managers' career share rises from 20% to 50%
    const posting = (title, role) => ({ title, role, descriptionAvailable: true, skills: role === 'product-manager' ? [ 'roadmapping' ] : [ 'python' ] })
    const window = { latest: { run: { id: 'r1' } }, postings: [ ...Array.from({ length: 8 }, () => posting('Software Engineer', 'software-engineer')),
        ...Array.from({ length: 2 }, () => posting('Sales Manager', 'product-manager')) ] }
    const estimate = nationalEstimate(window, file)
    assert.equal(estimate.quarter, '2026-Q2')
    assert.equal(estimate.careers['product-manager'].share, 50)
    assert.ok(estimate.careers['product-manager'].margin > 0)
    assert.equal(estimate.skills.roadmapping.share, 50)
    assert.equal(nationalEstimate({ postings: [] }, file), null)
})
