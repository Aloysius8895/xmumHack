import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'no-regret-'))
process.env.AI_MOCK = '1'
test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const { SKILLS } = await import('../../../src/game/server/careers.js')
const { aeiOnlyInputs, noRegretSkeleton, presetOf, skeletonChanges, skeletonStages } = await import('../../../src/game/server/no-regret.js')

async function call(route, body = {})
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

// Data analyst: sql and data-cleaning gain most under both presets; communication (strong automation and augmentation)
// leads under moderate, data-visualization (a little augmentation) under extreme; excel declines under both
const exposure = (automation, augmentation) => ({ automation, augmentation, tasks: [ 't' ] })
const inputs = { official: [], momentum: { skills: {}, careers: {}, basis: {} }, exposure: { source: {}, skills: {
    sql: exposure(0, 0.9), 'data-cleaning': exposure(0.05, 0.6), communication: exposure(0.4, 1.0), 'data-visualization': exposure(0, 0.05),
    statistics: exposure(0, 0), excel: exposure(0.9, 0), python: exposure(0, 0) } } }
const analyst = () =>
{
    const save = store.createSave()
    save.target = { careerId: 'data-analyst', mode: 'general' }
    return save
}

test('core: the skills high under both presets, the biggest mean gain first', () =>
{
    const skeleton = noRegretSkeleton(analyst(), inputs)
    assert.deepEqual(skeleton.core, [ 'sql', 'data-cleaning' ])
    assert.match(skeleton.reasons.sql.zh, /两个情景下都排在前面（温和 \+14\.2 分，极端 \+16\.7 分）/)
})

test('branches: each preset orders the rest by its own gains; a skill declining under both goes last', () =>
{
    const skeleton = noRegretSkeleton(analyst(), inputs)
    assert.equal(skeleton.identical, false)
    assert.equal(skeleton.branches.moderate[0], 'communication')
    assert.equal(skeleton.branches.extreme[0], 'data-visualization')
    assert.ok(skeleton.branches.extreme.indexOf('communication') > skeleton.branches.moderate.indexOf('communication'))
    assert.deepEqual(skeleton.later, [ 'excel' ])
    assert.match(skeleton.reasons.excel.zh, /两个情景下都在下降/)
})

test('the same order under both presets is one path; requirements met give an empty skeleton', () =>
{
    const flat = { ...inputs, exposure: { source: {}, skills: {} } }
    const same = noRegretSkeleton(analyst(), flat)
    assert.equal(same.identical, true)
    assert.ok(Object.values(same.reasons).every((reason) => !/更重要/.test(reason.zh)))
    assert.ok(skeletonStages(same).every((stage) => stage.kind !== 'branch'))

    const done = analyst()
    done.profile.skills = [ 'sql', 'data-cleaning', 'data-visualization', 'excel', 'statistics', 'python', 'communication' ].map((id) => ({ id, name: id, level: 3 }))
    const empty = noRegretSkeleton(done, inputs)
    assert.equal(empty.empty, 'requirements-met')
    assert.deepEqual(skeletonStages(empty), [])
    assert.equal(noRegretSkeleton(store.createSave(), inputs), null)
})

test('roadmap: core in a line, both branches after the core, the branch not followed is an alternative', () =>
{
    const skeleton = noRegretSkeleton(analyst(), inputs)
    const layout = skeletonStages(skeleton)
    const plan = { overview: { zh: '', en: '', ms: '' }, chosenBranch: 'moderate', forecastBasis: skeleton,
        stages: layout.map((stage) => ({ ...stage, title: { zh: 'x', en: 'x', ms: 'x' }, why: { zh: 'y', en: 'y', ms: 'y' }, requirementRefs: [],
            tasks: [ { title: { zh: 't', en: 't', ms: 't' }, why: { zh: 'w', en: 'w', ms: 'w' }, effortHours: 3, skillId: stage.skillIds[0] } ] })) }
    const roadmap = game.buildRoadmap(plan)
    const kinds = roadmap.stages.map((stage) => `${stage.kind}:${stage.branch ?? '-'}:${stage.prerequisites.join(',')}`)
    assert.deepEqual(kinds, [ 'core:-:', 'core:-:s1', 'branch:moderate:s2', 'branch:moderate:s3', 'branch:extreme:s2', 'branch:extreme:s5', 'later:-:' ])
    // every stage covers catalog skills and carries a reason for each
    for(const stage of roadmap.stages)
    {
        assert.ok(stage.skillIds.every((id) => SKILLS[id]))
        assert.equal(stage.basis.length, stage.skillIds.length)
    }
    const save = analyst()
    save.roadmap = roadmap
    const statuses = () => game.view(save, { mock: true }).roadmap.stages.map((stage) => stage.status)
    assert.deepEqual(statuses(), [ 'active', 'locked', 'locked', 'locked', 'alternative', 'alternative', 'locked' ])
    // the later stage waits for the chosen branch: clear the core and the moderate branch
    for(const stage of save.roadmap.stages.slice(0, 4))
        stage.cleared = true
    assert.equal(statuses()[6], 'active')
    save.roadmap.chosenBranch = 'extreme'
    assert.deepEqual(statuses().slice(2), [ 'alternative', 'alternative', 'active', 'locked', 'locked' ])
})

test('a roadmap planned before No-Regret keeps its statuses', () =>
{
    const save = analyst()
    save.roadmap = game.buildRoadmap({ overview: 'old', stages: [ 0, 1 ].map((index) => ({ title: 'x', why: 'y', skillIds: [ 'sql' ], requirementRefs: [],
        prerequisiteIndexes: index ? [ 0 ] : [], tasks: [ { title: 't', why: 'w', effortHours: 2, skillId: 'sql' } ] })) })
    assert.equal(save.roadmap.stages[0].kind, undefined)
    assert.deepEqual(game.view(save, { mock: true }).roadmap.stages.map((stage) => stage.status), [ 'active', 'locked' ])
})

test('re-plan: a changed core is suggested, unchanged data or a skill learnt is not', () =>
{
    const before = noRegretSkeleton(analyst(), inputs)
    const shifted = noRegretSkeleton(analyst(), { ...inputs, exposure: { source: {}, skills: { ...inputs.exposure.skills, sql: exposure(0.95, 0) } } })
    assert.ok(skeletonChanges(before, shifted).includes('sql'))
    assert.deepEqual(skeletonChanges(before, before), [])

    const save = analyst()
    save.roadmap = { stages: [], chosenBranch: 'moderate', forecastBasis: { core: [ 'excel' ], branches: { moderate: [], extreme: [] }, later: [], identical: true } }
    assert.ok(game.view(save, { mock: true }).replanSuggested.changedSkills.includes('excel'))
    // a basis from before prompt 06 (demand term in) reports its changes as a method change
    assert.equal(game.view(save, { mock: true }).replanSuggested.reason, 'method-changed')
    // the basis of the current data, read on AEI only as the roadmap is: nothing to suggest
    const current = noRegretSkeleton(save, aeiOnlyInputs())
    save.roadmap.forecastBasis = { core: current.core, branches: current.branches, later: current.later, identical: current.identical, demand: 'neutral' }
    assert.equal(game.view(save, { mock: true }).replanSuggested, null)
})

test('switching scenario saves a preference; moving the formal branch requires preview confirmation', async () =>
{
    store.reset()
    await call('/api/profile/skills', { skills: [ { id: 'python', name: 'Python', level: 1 } ] })
    await call('/api/target', { careerId: 'data-analyst', mode: 'general' })
    await call('/api/scenario', { preset: 'moderate' })
    const planned = await call('/api/roadmap', {})
    assert.equal(planned.status, 200)
    const stages = JSON.stringify(store.load().roadmap.stages)
    assert.equal(store.load().roadmap.chosenBranch, 'moderate')
    await call('/api/scenario', { preset: 'extreme' })
    assert.equal(store.load().roadmap.chosenBranch, 'moderate')
    assert.equal(JSON.stringify(store.load().roadmap.stages), stages)
    const preview = await call('/api/roadmap/branch', { branch: 'extreme' })
    assert.equal(preview.body.requiresConfirmation, true)
    assert.equal(store.load().roadmap.chosenBranch, 'moderate')
    await call('/api/learning/apply', { previewId: preview.body.state.learning.pending.id })
    assert.equal(store.load().roadmap.chosenBranch, 'extreme')
    assert.equal(JSON.stringify(store.load().roadmap.stages), stages)
    const back = await call('/api/roadmap/branch', { branch: 'moderate' })
    await call('/api/learning/apply', { previewId: back.body.state.learning.pending.id })
    await call('/api/scenario', { preset: 'extreme' })
    assert.equal(store.load().roadmap.chosenBranch, 'moderate')
    assert.equal((await call('/api/roadmap/branch', { branch: 'slow' })).status, 400)
    assert.equal(presetOf({ scenario: 'custom', k: 2.5, H: 3 }), 'extreme')
    assert.equal(presetOf({ scenario: 'custom', k: 1.3, H: 3 }), 'moderate')
})
