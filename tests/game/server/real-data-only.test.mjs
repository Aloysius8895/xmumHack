import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'real-data-'))
test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

const { buildReference, referenceMarket } = await import('../../../src/game/server/reference-market.js')
const { mycolTimeline } = await import('../../../src/game/server/official-signals.js')
const { renderMycolTimeline } = await import('../../../src/game/sources/Career/OfficialRecord.js')
const { t } = await import('../../../src/game/sources/Career/i18n.js')
const game = await import('../../../src/game/server/game.js')
const store = await import('../../../src/game/server/store.js')

const SHA = 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263'
const reference = (patch = {}) => ({ source: { sha256: SHA, url: 'https://huggingface.co/datasets/seemarn/jobstreet', platform: 'JobStreet' },
    period: { from: '2025-03-03', to: '2025-05-08' }, postings: 200, months: { '2025-03': 90, '2025-04': 100, '2025-05': 10, undated: 0 },
    careers: { teacher: { postings: 12, byMonth: { '2025-03': 5, '2025-04': 6, '2025-05': 1 } }, chef: { postings: 0, byMonth: {} } }, ...patch })

test('the JobStreet reference keeps counts and shares, and refuses another file', () =>
{
    const built = buildReference(reference())
    assert.deepEqual(built.careers.teacher, { postings: 12, share: 6, byMonth: { '2025-03': 5, '2025-04': 6, '2025-05': 1 } })
    assert.deepEqual(built.months, [ '2025-03', '2025-04', '2025-05' ])
    // Listings stop on 05-08: May is a partial month
    assert.equal(built.partialMonth, '2025-05')
    assert.equal(buildReference(reference({ period: { from: '2025-03-01', to: '2025-05-31' } })).partialMonth, null)
    assert.equal(built.from, '2025-03-03')
    assert.throws(() => buildReference(reference({ source: { sha256: 'x'.repeat(64), url: 'https://huggingface.co/datasets/x' } })), /reference-invalid/)
    assert.throws(() => buildReference(reference({ careers: { teacher: { postings: 1.5 } } })), /reference-invalid-career/)
    assert.equal(referenceMarket('off'), null)
    assert.equal(referenceMarket(path.join(process.env.SAVE_DIR, 'missing.json')), null)
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
