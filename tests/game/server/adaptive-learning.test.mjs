import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-learning-'))
process.env.AI_MOCK = '1'
process.env.CRAWLER_DATA_DIR = 'off'
delete process.env.AWS_BACKEND_URL
delete process.env.AWS_BACKEND_TOKEN
delete process.env.DATABASE_URL

const learning = await import('../../../src/game/server/adaptive-learning.js')
const rules = await import('../../../src/game/server/learning-rules.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const features = await import('../../../src/game/server/features.js')
const { handle } = await import('../../../src/game/server/app.js')
test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

async function learner()
{
    const save = store.createSave()
    game.setTarget(save, { careerId: 'ml-engineer', mode: 'general' })
    save.roadmap = game.buildRoadmap(await features.generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: 'zh' }))
    save.roadmap.stages[0].tasks[0].progress = 100
    save.roadmap.stages[0].tasks[1].progress = 40
    save.points = 39
    save.mastery.python = 15
    return save
}
const text = rules.localized('一个解释', 'An explanation', 'Penjelasan')
const update = (taskId) => ({ taskId, title: text, why: text, deliverable: text, completionCriteria: text, effortHours: 3 })
const draft = (updates = [], additions = []) => ({ summary: text, updates, additions })
async function call(method, url, body)
{
    const request = Readable.from(body ? [ Buffer.from(JSON.stringify(body)) ] : [])
    Object.assign(request, { method, url, headers: {} })
    let payload
    const response = { statusCode: 200, setHeader() {}, end(value) { payload = JSON.parse(value) } }
    await handle(request, response)
    return { status: response.statusCode, ...payload }
}

test('a snapshot never becomes a speed prediction; thin, missing and zero mappings remain visible', () =>
{
    const save = { target: { careerId: 'ml-engineer' } }
    const evidence = rules.aeiEvidence(save, { source: { name: 'fixture' }, skills: {
        python: { automation: 0, augmentation: 0, tasks: [ 'one' ], note: 'weak match' },
    } })
    assert.equal(evidence.comparablePeriods, false)
    assert.equal(evidence.skills.find(row => row.skillId === 'python').zeroIsNotSafety, true)
    assert.equal(evidence.skills.find(row => row.skillId === 'python').thinMapping, true)
    assert.equal(evidence.skills.find(row => row.skillId === 'sql').automation, null)
    assert.equal(rules.learningContext(save).trendClassification, 'insufficient_evidence')
    assert.equal(rules.effectiveMode(save), 'moderate')
})

test('user scenario stays independent of AEI analysis and changes model tasks without removing foundations', async () =>
{
    const save = await learner()
    learning.setLearningMode(save, 'extreme')
    await learning.analyzeEvidence(save)
    assert.equal(rules.effectiveMode(save), 'extreme')
    assert.equal(save.learning.analysis.recommendedScenario, 'moderate')
    const plan = await features.generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: 'zh', learning: rules.learningContext(save) })
    assert.equal(plan.stages[0].tasks[0].learningActivity, 'foundation')
    assert.equal(plan.stages[0].tasks[1].learningActivity, 'verification')
    assert.throws(() => learning.setLearningMode(save, 'fast'), /bad-learning-mode/)
    learning.setLearningMode(save, null)
    assert.equal(rules.effectiveMode(save), 'moderate')
})

test('preview and apply protect artifacts, active tasks, prerequisites, target, mastery, points and IDs', async () =>
{
    const save = await learner(), before = structuredClone(save)
    const editable = save.roadmap.stages[0].tasks[2]
    const pending = learning.buildPreview(save, draft([ update(editable.id) ]))
    assert.deepEqual(save.roadmap, before.roadmap, 'preview does not apply edits')
    learning.applyPreview(save, pending.id)
    assert.deepEqual(save.roadmap.stages[0].tasks.slice(0, 2), before.roadmap.stages[0].tasks.slice(0, 2))
    assert.equal(save.roadmap.stages[0].tasks[2].id, editable.id)
    assert.deepEqual(save.roadmap.stages.map(stage => stage.prerequisites), before.roadmap.stages.map(stage => stage.prerequisites))
    for(const key of [ 'target', 'points', 'mastery', 'logs', 'pet' ]) assert.deepEqual(save[key], before[key])
    assert.equal(save.learning.history.length, 1)
    assert.throws(() => learning.applyPreview(save, pending.id), /learning-preview-stale/, 'no double apply')
})

test('malformed changes, duplicate IDs and edits to tasks with progress are rejected atomically', async () =>
{
    for(const id of [ 's1t1', 's1t2', 'nonexistent' ])
    {
        const save = await learner(), before = structuredClone(save.roadmap)
        assert.throws(() => learning.buildPreview(save, draft([ update(id) ])), /protected-learning-task/)
        assert.deepEqual(save.roadmap, before)
        assert.equal(save.learning.pending, null)
    }
    const save = await learner()
    assert.throws(() => learning.buildPreview(save, draft([ update('s1t3'), update('s1t3') ])), /protected-learning-task/)
    assert.throws(() => learning.buildPreview(save, draft([ { ...update('s1t3'), effortHours: -1 } ])), /bad-learning-plan/)
    assert.throws(() => learning.buildPreview(save, draft([], [ { ...update(null), stageId: 's1', skillId: 'made-up' } ])), /bad-learning-plan/)
})

test('progress, profile, target or scenario changes invalidate confirmation', async () =>
{
    for(const mutate of [ save => save.roadmap.stages[0].tasks[2].progress = 20,
        save => save.profile.skills.push({ id: 'python', level: 1 }), save => save.target.mode = 'customise' ])
    {
        const save = await learner(), pending = learning.buildPreview(save, draft([ update('s1t3') ]))
        mutate(save)
        assert.throws(() => learning.applyPreview(save, pending.id), /learning-preview-stale/)
    }
    const save = await learner(), pending = learning.buildPreview(save, draft())
    learning.setLearningMode(save, 'extreme')
    assert.throws(() => learning.applyPreview(save, pending.id), /learning-preview-stale/)
})

test('weekly checkpoint hides the rubric and unanswered understanding is not scored as failure', async () =>
{
    const save = await learner(), before = structuredClone(save.roadmap)
    await learning.createCheckpoint(save)
    const publicView = learning.learningView(save)
    assert.ok(publicView.checkpoint.question)
    assert.equal(JSON.stringify(publicView).includes('privateRubric'), false)
    const result = await learning.reviewCheckpoint(save, { checkpointId: publicView.checkpoint.id, progress: '', difficulty: 'No time this week', answer: '' })
    assert.equal(result.understanding, 'insufficient_evidence')
    assert.equal(result.nextAction, 'adjust_pace')
    assert.equal(save.points, 39)
    assert.deepEqual(save.roadmap, before)
    const view = learning.learningView(save, Date.parse(result.at) + 6 * 86400000)
    assert.equal(view.checkpointDue, false)
    assert.equal(learning.learningView(save, Date.parse(result.at) + 7 * 86400000).checkpointDue, true)
    assert.equal(JSON.stringify(view).includes('No time this week'), false, 'raw answers stay out of public state')
})

test('no-study check-in records scheduling feedback without assessing ability; stale/invalid replies are rejected', async () =>
{
    const save = await learner()
    for(const stage of save.roadmap.stages) for(const task of stage.tasks) task.progress = 0
    await learning.createCheckpoint(save)
    assert.equal(save.learning.checkpoint.feedbackOnly, true)
    const noStudy = await learning.reviewCheckpoint(save, { checkpointId: save.learning.checkpoint.id, progress: '', difficulty: 'No time this week', answer: '' })
    assert.equal(noStudy.understanding, 'insufficient_evidence')
    assert.equal(noStudy.nextAction, 'adjust_pace')
    assert.equal(save.points, 39)
    save.roadmap.stages[0].tasks[0].progress = 20
    await learning.createCheckpoint(save)
    const id = save.learning.checkpoint.id
    await assert.rejects(learning.reviewCheckpoint(save, { checkpointId: id, progress: '', difficulty: '', answer: '' }), /bad-checkpoint-response/)
    await assert.rejects(learning.reviewCheckpoint(save, { checkpointId: id, progress: '', difficulty: '', answer: 'x'.repeat(2001) }), /bad-checkpoint-response/)
    save.roadmap.stages[0].tasks[0].progress = 30
    await assert.rejects(learning.reviewCheckpoint(save, { checkpointId: id, progress: 'studied', difficulty: '', answer: 'explanation' }), /checkpoint-stale/)
})

test('save migration preserves old fast choices and existing progress', async () =>
{
    const save = await learner()
    save.version = 6
    delete save.learning
    save.scenario = { preset: 'fast' }
    save.roadmap.chosenBranch = 'fast'
    save.roadmap.forecastBasis = { branches: { moderate: [ 'python' ], fast: [ 'sql' ] } }
    save.roadmap.stages[0].branch = 'fast'
    save.roadmap.stages[0].gains = { python: { moderate: 1, fast: 2 } }
    save.roadmap.stages[0].title.en = 'fast is a word in user-visible text'
    save.careers['data-analyst'] = { roadmap: structuredClone(save.roadmap) }
    const before = structuredClone(save.roadmap)
    const migrated = store.normalizeSave(save)
    assert.equal(migrated.learning.mode, 'extreme')
    assert.equal(migrated.roadmap.chosenBranch, 'extreme')
    assert.deepEqual(migrated.roadmap.forecastBasis.branches, { moderate: [ 'python' ], extreme: [ 'sql' ] })
    assert.equal(migrated.roadmap.stages[0].gains.python.extreme, 2)
    assert.equal(migrated.careers['data-analyst'].roadmap.stages[0].branch, 'extreme')
    assert.equal(migrated.roadmap.stages[0].title.en, before.stages[0].title.en)
    assert.deepEqual(migrated.roadmap.stages[0].tasks, before.stages[0].tasks)
    assert.equal(save.roadmap.chosenBranch, 'fast', 'migration does not mutate its input')
})

test('API scenario, review and confirm flow never applies a preview before confirmation', async () =>
{
    const save = await learner()
    store.save(save)
    assert.equal((await call('POST', '/api/learning/scenario', { mode: 'invalid' })).status, 400)
    assert.equal((await call('POST', '/api/learning/scenario', { mode: 'extreme' })).state.learning.mode, 'extreme')
    assert.equal((await call('POST', '/api/learning/analyze', {})).state.learning.trendClassification, 'insufficient_evidence')
    const started = await call('POST', '/api/learning/checkpoint', {})
    const reviewed = await call('POST', '/api/learning/review', { checkpointId: started.state.learning.checkpoint.id, progress: 'A project', difficulty: '', answer: 'A concrete explanation' })
    assert.equal(reviewed.status, 200)
    const preview = await call('POST', '/api/learning/preview', {})
    assert.equal(preview.state.learning.pending.requiresConfirmation, true)
    assert.deepEqual(store.load().roadmap, save.roadmap)
    const applied = await call('POST', '/api/learning/apply', { previewId: preview.state.learning.pending.id })
    assert.equal(applied.status, 200)
    assert.equal(applied.state.roadmap.learningScenario, 'extreme')
    assert.equal(applied.state.points, save.points)
    assert.equal(applied.state.learning.pending, null)
    assert.equal((await call('POST', '/api/learning/apply', { previewId: preview.state.learning.pending.id })).status, 409)
})

test('existing roadmap generation also requires a preview and legacy scenarios stay in sync', async () =>
{
    const save = await learner()
    store.save(save)
    const generated = await call('POST', '/api/roadmap', {})
    assert.equal(generated.requiresConfirmation, true)
    assert.deepEqual(store.load().roadmap, save.roadmap)
    assert.equal((await call('POST', '/api/scenario', { preset: 'fast' })).state.learning.mode, 'extreme')
    assert.equal((await call('POST', '/api/learning/discard', {})).state.learning.pending, null)
})

test('explicit refresh replaces the checkpoint, retains study/reviews, rejects old answers and caches normal reopening', async () =>
{
    const save = await learner()
    store.save(save)
    const started = await call('POST', '/api/learning/checkpoint', {})
    const old = started.state.learning.checkpoint
    const refreshed = await call('POST', '/api/learning/checkpoint', { refresh: true, checkpointId: old.id })
    assert.equal(refreshed.status, 200)
    const current = refreshed.state.learning.checkpoint
    assert.notEqual(current.id, old.id)
    assert.notEqual(current.question, old.question)
    assert.equal(refreshed.state.points, save.points)
    assert.deepEqual(store.load().roadmap, save.roadmap)
    assert.deepEqual(store.load().learning.reviews, save.learning.reviews)
    assert.equal((await call('POST', '/api/learning/checkpoint', {})).state.learning.checkpoint.id, current.id)
    assert.equal((await call('POST', '/api/learning/checkpoint', { refresh: true, checkpointId: old.id })).status, 409)
    assert.equal((await call('POST', '/api/learning/review', { checkpointId: old.id, progress: 'done', difficulty: '', answer: 'an old answer' })).status, 409)
})


test('integration: resetting a scenario clears both controls and preserves the applied roadmap', async () =>
{
    const save = await learner()
    store.save(save)
    await call('POST', '/api/scenario', { preset: 'extreme' })
    const before = structuredClone(store.load().roadmap)
    const reset = await call('POST', '/api/scenario', { preset: null })
    assert.equal(reset.status, 200)
    assert.equal(store.load().scenario, null)
    assert.equal(store.load().learning.mode, null)
    assert.equal(reset.state.learning.mode, 'moderate')
    assert.equal(reset.state.learning.userOverride, null)
    assert.deepEqual(store.load().roadmap, before)
})

test('integration: adaptive prompts use the customised target and local priority evidence', () =>
{
    const save = store.createSave()
    save.target = { careerId: 'ml-engineer', mode: 'customise', posting: { requirements: [
        { skillId: 'python', level: 2, priority: 'must', kind: 'skill' },
    ] } }
    const context = rules.learningContext(save)
    assert.deepEqual(context.evidence.skills.map(row => row.skillId), ['python'])
    const priority = context.modelAnalysis.skillPriority
    const ids = new Set([...priority.core, ...priority.later, ...Object.values(priority.branches).flat()])
    assert.deepEqual([...ids], ['python'])
    assert.equal(priority.assumptions.demand, 'momentum')
    assert.ok(priority.approach.moderate.python.activities.foundation > 0)
    assert.ok(priority.approach.extreme.python.activities.foundation > 0)
    assert.equal(context.modelAnalysis.isTrendEvidence, false)
})
