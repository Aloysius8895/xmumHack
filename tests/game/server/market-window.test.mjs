import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'market-window-save-'))
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'market-window-data-'))
process.env.CRAWLER_DATA_DIR = directory
const mw = await import('../../../src/game/server/market-window.js')

test.after(() =>
{
    fs.rmSync(directory, { recursive: true, force: true })
    fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true })
})

const scope = { roles: [ 'data-analyst', 'ml-engineer' ], skills: [ 'sql', 'python' ], sources: [ { id: 'linkedin', type: 'public' } ] }
const job = (id, { role = 'data-analyst', skills = [ 'sql' ], described = true, hash = 'a'.repeat(64) } = {}) => ({
    id: `crawler-${id}`, role, title: 'Data Analyst', company: `Employer ${id}`, location: 'Kuala Lumpur', url: `https://www.linkedin.com/jobs/view/${id}`,
    postedAt: null, postedDate: null, descriptionAvailable: described, listingHash: hash,
    skills: skills.map((skill) => ({ id: skill })), sources: [ { source: 'linkedin', sourceId: id, url: null } ],
})
const payload = (at, jobs, { seen, delta, runId = `run-${at}`, scopeHash = 'scope-a' } = {}) => ({
    run: { id: runId, status: 'complete', scopeHash, startedAt: new Date(Date.parse(at) - 60_000).toISOString(), finishedAt: at, trigger: 'refresh', since: null },
    scope, summary: { trend: { status: 'insufficient_history', roles: [] }, quality: { tasks: [] } }, jobs, ...(seen ? { seen, delta } : {}),
})

test('a run adds its postings, sets the watermark from its start and builds the month', () =>
{
    const window = mw.mergeRun(null, payload('2026-10-10T00:00:00.000Z', [ job('1'), job('2', { skills: [ 'python' ] }), job('3', { described: false }) ]))
    assert.equal(window.postings.length, 3)
    assert.equal(window.lastSuccessfulCollectionAt, '2026-10-09T23:59:00.000Z')
    const month = window.months[0]
    assert.equal(month.period, '2026-10')
    assert.equal(month.denominator, 2)
    assert.deepEqual(month.shares, { sql: 50, python: 50 })
    assert.equal(month.thin, true, 'two described postings are too few to compare')
    assert.deepEqual(mw.knownListings(window), { 'linkedin:1': 'a'.repeat(64), 'linkedin:2': 'a'.repeat(64), 'linkedin:3': 'a'.repeat(64) })
})

test('an increment: new postings join, seen ones stay fresh, others age out after 30 days', () =>
{
    let window = mw.mergeRun(null, payload('2026-09-01T00:00:00.000Z', [ job('old') ]))
    window = mw.mergeRun(window, payload('2026-09-20T00:00:00.000Z', [ job('1'), job('2') ]))
    window = mw.mergeRun(window, payload('2026-10-10T00:00:00.000Z', [ job('3') ], {
        seen: [ { source: 'linkedin', sourceId: '1' } ], delta: { new: 1, changed: 0, unchanged: 1, skippedDetails: 1, undatedAds: 1 },
    }))
    assert.deepEqual(window.postings.map((posting) => posting.key).sort(), [ 'linkedin:1', 'linkedin:2', 'linkedin:3' ], 'posting "old" was last seen 39 days before')
    assert.equal(window.postings.find((posting) => posting.key === 'linkedin:1').lastSeenAt, '2026-10-10T00:00:00.000Z')
    assert.equal(window.postings.find((posting) => posting.key === 'linkedin:1').firstSeenAt, '2026-09-20T00:00:00.000Z')
    assert.equal(window.months.find((month) => month.period === '2026-10').postings, 2, 'October observed postings 1 (seen again) and 3')
    assert.deepEqual(window.runs.at(-1), { id: 'run-2026-10-10T00:00:00.000Z', trigger: 'refresh', since: null, startedAt: '2026-10-09T23:59:00.000Z', finishedAt: '2026-10-10T00:00:00.000Z', new: 1, changed: 0, unchanged: 1, skippedDetails: 1, undatedAds: 1, sources: [ 'linkedin' ] })
})

test('a listing seen without its detail page never erases the known description and skills', () =>
{
    let window = mw.mergeRun(null, payload('2026-10-01T00:00:00.000Z', [ job('1', { skills: [ 'sql', 'python' ] }) ]))
    window = mw.mergeRun(window, payload('2026-10-02T00:00:00.000Z', [ job('1', { described: false, skills: [], hash: 'b'.repeat(64) }) ]))
    const posting = window.postings[0]
    assert.equal(posting.descriptionAvailable, true)
    assert.deepEqual(posting.skills, [ 'sql', 'python' ])
    assert.equal(posting.listingHash, 'b'.repeat(64))
})

test('the same advert on two platforms is one posting', () =>
{
    const both = { ...job('1'), sources: [ { source: 'linkedin', sourceId: '1', url: null }, { source: 'indeed', sourceId: 'x', url: null } ] }
    let window = mw.mergeRun(null, payload('2026-10-01T00:00:00.000Z', [ job('1') ]))
    window = mw.mergeRun(window, payload('2026-10-02T00:00:00.000Z', [ both ]))
    assert.equal(window.postings.length, 1)
    assert.equal(window.postings[0].sources.length, 2)
})

test('a new collection scope restarts the months but keeps the observed postings', () =>
{
    let window = mw.mergeRun(null, payload('2026-09-25T00:00:00.000Z', [ job('1') ]))
    window = mw.mergeRun(window, payload('2026-10-01T00:00:00.000Z', [ job('2') ], { scopeHash: 'scope-b' }))
    assert.deepEqual(window.months.map((month) => month.period), [ '2026-10' ])
    assert.equal(window.postings.length, 2)
})

test('file storage: atomic writes, legacy single-run file becomes the first window', async () =>
{
    const legacy = { latest: payload('2026-10-05T00:00:00.000Z', [ job('L') ]), receipts: [ { id: 'legacy-run', hash: 'h' } ],
        months: [ { period: '2026-09', counts: { 'data-analyst': 4 }, shares: { sql: 40 } } ] }
    fs.writeFileSync(path.join(directory, 'market.json'), JSON.stringify({ sha256: mw.hash(legacy), data: legacy }))
    mw.resetCache()
    const window = mw.readWindow()
    assert.equal(window.postings[0].key, 'linkedin:L')
    assert.deepEqual(window.months.map((month) => month.period), [ '2026-09', '2026-10' ])
    assert.deepEqual(window.receipts, [ { id: 'legacy-run', hash: 'h' } ])

    await mw.updateWindow((current) => ({ result: null, window: mw.mergeRun(current, payload('2026-10-06T00:00:00.000Z', [ job('M') ])) }))
    mw.resetCache()
    assert.equal(mw.readWindow().postings.length, 2, 'the merged window was written and reads back')
    assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith('.tmp')).length, 0)
})
