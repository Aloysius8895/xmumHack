import assert from 'node:assert/strict'
import test from 'node:test'
import { demo } from '../../../src/game/server/ai.js'
import { SKILLS } from '../../../src/game/server/careers.js'
import { mapLearningDirection } from '../../../src/game/server/features.js'
import { createSave } from '../../../src/game/server/store.js'
import { snapshot, updateLog } from '../../../src/game/server/update-log.js'

test('without the AI the learning direction is mapped by keywords, to catalog skills only', async () =>
{
    const result = await demo.run(true, () => mapLearningDirection({ text: '我想学 Python 和 SQL，还有跳舞' }))
    assert.deepEqual(result.skillIds.sort(), [ 'python', 'sql' ])
    assert.ok(result.skillIds.every((id) => SKILLS[id]))
    assert.deepEqual(await demo.run(true, () => mapLearningDirection({ text: '跳舞' })), { skillIds: [], unmatched: [] })
})

test('the skills of the learning direction are followed by the update log, whichever career needs them', () =>
{
    const posting = (n, skills, at) => ({ key: `linkedin:${n}`, role: 'chef', skills, descriptionAvailable: true, firstSeenAt: at, lastSeenAt: at })
    const many = (count, offset, skills, at) => Array.from({ length: count }, (_, i) => posting(offset + i, skills, at))
    const window = (postings, finishedAt) => ({ postings, latest: { run: { finishedAt } } })
    const save = createSave()
    save.learningDirection = { text: 'cad', skillIds: [ 'cad' ], unmatched: [] }
    const before = window(many(40, 0, [ 'menu-planning' ], '2026-10-01T00:00:00.000Z'), '2026-10-01T00:00:00.000Z')
    save.dataView = snapshot(before, [])
    const after = window([ ...before.postings, ...many(10, 100, [ 'cad' ], '2026-10-03T00:00:00.000Z') ], '2026-10-03T00:00:00.000Z')
    // no target and no forecast: only the learning direction makes cad relevant
    const change = updateLog(save, { careers: [] }, { window: after, signals: [] }).changes.find((row) => row.skillId === 'cad')
    assert.deepEqual([ change.from, change.to, change.careers ], [ 0, 20, [] ])
})
