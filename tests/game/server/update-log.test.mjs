import assert from 'node:assert/strict'
import test from 'node:test'
import { relevantCareers, snapshot, updateLog, windowShares } from '../../../src/game/server/update-log.js'
import { createSave } from '../../../src/game/server/store.js'

// data-analyst needs sql, data-cleaning, data-visualization, excel, statistics, python, communication
const posting = (n, role, skills, firstSeenAt = '2026-10-01T00:00:00.000Z', described = true) =>
    ({ key: `linkedin:${n}`, role, skills: described ? skills : [], descriptionAvailable: described, firstSeenAt, lastSeenAt: firstSeenAt })
const window = (postings, finishedAt) => ({ postings, latest: { run: { finishedAt }, scope: { sources: [ { id: 'linkedin' } ] } } })
const many = (count, offset, role, skills, at) => Array.from({ length: count }, (_, i) => posting(offset + i, role, skills, at))
const signal = (id, period) => ({ id, kind: 'career', signal: 'critical', sourceId: `mycol-${period}`, source: 'MyCOL', period, url: 'https://x', page: 3, quote: 'q' })

const player = () =>
{
    const save = createSave()
    save.target = { careerId: 'data-analyst', mode: 'general' }
    save.roadmap = { stages: [ { id: 's1', skillIds: [ 'sql', 'python' ], tasks: [] } ] }
    return save
}
const forecast = { careers: [ { careerId: 'data-scientist' }, { careerId: 'data-analyst' }, { careerId: 'ml-engineer' }, { careerId: 'chef' } ] }

test('shares are over described postings only', () =>
{
    const shares = windowShares(window([ posting(1, 'data-analyst', [ 'sql' ]), posting(2, 'data-analyst', [ 'sql', 'excel' ]), posting(3, 'data-analyst', [], undefined, false) ], 'x'))
    assert.equal(shares.denominator, 2)
    assert.deepEqual(shares.shares, { sql: 100, excel: 50 })
})

test('the target comes first, then the best matches', () =>
{
    assert.deepEqual(relevantCareers(player(), forecast), [ 'data-analyst', 'data-scientist', 'ml-engineer', 'chef' ])
    assert.deepEqual(relevantCareers(createSave(), forecast), [ 'data-scientist', 'data-analyst', 'ml-engineer' ])
})

test('before the first snapshot there is no log', () =>
{
    assert.deepEqual(updateLog(player(), forecast, { window: window([], null), signals: [] }), { baseline: false, changes: [], count: 0 })
})

test('lists relevant share moves, new adverts and new official signals; drops noise', () =>
{
    const before = window([ ...many(20, 0, 'data-analyst', [ 'sql' ]), ...many(20, 100, 'data-analyst', [ 'excel' ]) ], '2026-10-01T00:00:00.000Z')
    const save = player()
    save.dataView = snapshot(before, [ signal('data-analyst', '2023-2024') ], '2026-10-02T00:00:00.000Z')
    assert.equal(save.dataView.denominator, 40)

    const later = '2026-10-05T00:00:00.000Z'
    // 40 old + 10 new sql adverts: sql 50% -> 60%, excel 50% -> 40%; one new python advert is 1/51 (2 points, kept)
    const after = window([ ...before.postings, ...many(10, 200, 'data-analyst', [ 'sql' ], later), posting(300, 'data-analyst', [ 'python', 'excel' ], later) ], later)
    const signals = [ signal('data-analyst', '2023-2024'), signal('data-analyst', '2024-2025'), signal('teacher', '2024-2025') ]
    const log = updateLog(save, forecast, { window: after, signals })

    const shares = log.changes.filter((change) => change.kind === 'skill-share')
    assert.deepEqual(shares.map((change) => change.skillId).sort(), [ 'excel', 'python', 'sql' ])
    const sql = shares.find((change) => change.skillId === 'sql')
    assert.equal(sql.from, 50)
    assert.equal(sql.to, 58.8)
    assert.deepEqual(sql.sample, { from: 40, to: 51 })
    assert.ok(sql.careers.includes('data-analyst'))
    // sorted by the size of the move
    assert.equal(shares[0].skillId, 'sql')

    assert.deepEqual(log.changes.filter((change) => change.kind === 'new-postings'), [ { kind: 'new-postings', careerId: 'data-analyst', added: 11, sample: true } ])
    // only new signals of careers that concern the player
    assert.deepEqual(log.changes.filter((change) => change.kind === 'official').map((change) => change.period), [ '2024-2025' ])
    assert.deepEqual(log.affectedRoadmapSkills.sort(), [ 'python', 'sql' ])
    assert.equal(log.count, log.changes.length)
})

test('moves under 2 points or measured on fewer than 30 postings are not listed', () =>
{
    const before = window(many(40, 0, 'data-analyst', [ 'sql' ]), '2026-10-01T00:00:00.000Z')
    const save = player()
    save.dataView = snapshot(before, [])
    const small = window([ ...before.postings, ...many(40, 100, 'data-analyst', [ 'sql' ]), posting(500, 'data-analyst', [ 'excel' ], '2026-10-04T00:00:00.000Z') ], '2026-10-04T00:00:00.000Z')
    const log = updateLog(save, forecast, { window: small, signals: [] })
    // sql 100% -> 98.8% and excel 0 -> 1.2%: both under 2 points
    assert.equal(log.changes.filter((change) => change.kind === 'skill-share').length, 0)

    const thin = player()
    thin.dataView = snapshot(window(many(10, 0, 'data-analyst', [ 'sql' ]), '2026-10-01T00:00:00.000Z'), [])
    const grown = updateLog(thin, forecast, { window: window(many(40, 0, 'data-analyst', [ 'excel' ]), '2026-10-04T00:00:00.000Z'), signals: [] })
    assert.equal(grown.changes.filter((change) => change.kind === 'skill-share').length, 0)
})
