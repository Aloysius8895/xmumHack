import test from 'node:test'
import assert from 'node:assert/strict'
import { CAREERS, SKILLS } from './careers.js'
import { SKILL_DETAILS } from './skill-details.js'
import { createSave } from './store.js'
import * as game from './game.js'

const ai = { mock: true, keyConfigured: false, model: 'test' }

function learner()
{
    const save = createSave()
    game.setTarget(save, { careerId: 'data-analyst', mode: 'general' })
    save.pet.affinity = 40
    save.roadmap = game.buildRoadmap({ overview: 'Test preparation', stages: [
        { title: 'SQL', why: 'Query records', skillIds: ['sql'], requirementRefs: [], prerequisiteIndexes: [],
            tasks: [{ title: 'Practice queries', why: 'Practice', skillId: 'sql', effortHours: 6 }],
            challenge: { topic: 'Legacy exam', description: 'Retired' } },
        { title: 'Charts', why: 'Present findings', skillIds: ['data-visualization'], requirementRefs: [], prerequisiteIndexes: [0],
            tasks: [{ title: 'Build a chart', why: 'Practice', skillId: 'data-visualization', effortHours: 4 }] },
    ] })
    return save
}

test('every catalog skill has complete localized card metadata', () =>
{
    assert.deepEqual(Object.keys(SKILL_DETAILS).sort(), Object.keys(SKILLS).sort())
    for(const career of CAREERS)
        for(const { id } of career.skills)
        {
            const detail = SKILL_DETAILS[id]
            assert.ok(['high', 'medium', 'low'].includes(detail.demand), id)
            assert.ok(Number.isInteger(detail.heat) && detail.heat >= 0 && detail.heat <= 100, id)
            assert.ok(Number.isInteger(detail.difficulty) && detail.difficulty >= 1 && detail.difficulty <= 5, id)
            assert.match(detail.icon, /^[a-z]+$/)
            for(const lang of ['zh', 'en', 'ms'])
                assert.ok(detail.description[lang].length > 10, `${id}: ${lang}`)
            assert.match(detail.resource.url, /^https:\/\//, `${id}: resource`)
            assert.ok(detail.resource.title.length > 3, `${id}: resource title`)
        }
})

test('affinity starts at the profile match and grows with learning progress', () =>
{
    // Nothing learned and an empty profile: 0 everywhere
    assert.equal(game.view(createSave(), ai).careers.every(({ affinity }) => affinity === 0), true)

    // Profile only: affinity equals the match of every career
    const save = learner()
    save.profile.skills = [ { id: 'data-visualization', name: 'Charts', level: 2, evidence: '', source: 'manual' } ]
    let state = game.view(save, ai)
    for(const career of state.careers)
        assert.equal(career.affinity, career.match.percent, career.id)
    const analyst = () => state.careers.find(({ id }) => id === 'data-analyst')
    assert.equal(analyst().affinity, 11) // data-visualization: level 2 × weight 2 of 35

    // The SQL task done: + level 3 × weight 3 of 35, the match itself doesn't move
    game.setTaskDone(save, 's1t1', true)
    state = game.view(save, ai)
    assert.equal(analyst().affinity, 37)
    assert.equal(analyst().match.percent, 11)
    assert.equal(state.pet.affinity, 37)
    assert.equal(state.pet.level, 2)

    // Daily digest mastery counts too
    save.mastery = { 'data-cleaning': 50 }
    assert.equal(game.view(save, ai).careers.find(({ id }) => id === 'data-analyst').affinity, 50)
})

test('task completion unlocks the next stage without an exam, including legacy roadmaps', () =>
{
    const save = learner()
    assert.equal(game.view(save, ai).roadmap.stages[1].status, 'locked')
    assert.equal(game.setTaskDone(save, 's1t1', true), true)
    const state = game.view(save, ai)
    assert.equal(state.roadmap.stages[0].status, 'cleared')
    assert.equal(state.roadmap.stages[1].status, 'active')
    assert.equal(save.pet.affinity, 40)
    assert.equal(save.profile.skills.length, 0)
    save.roadmap.stages[0].tasks[0].progress = 0
    save.roadmap.stages[0].cleared = true
    save.roadmap.stages[0].challenge = { topic: 'Old saved exam' }
    assert.equal(game.view(save, ai).roadmap.stages[1].status, 'active')
    assert.equal('challenge' in game.view(save, ai).roadmap.stages[0], false)
})

test('rounded task progress does not finish an incomplete stage', () =>
{
    const save = learner()
    save.roadmap.stages[0].tasks = [
        { id: 'a', mp: 1, progress: 99 }, { id: 'b', mp: 200, progress: 100 },
    ]
    const state = game.view(save, ai)
    assert.equal(state.roadmap.stages[0].status, 'active')
    assert.equal(state.roadmap.stages[1].status, 'locked')
})

test('logging retains existing task progress and points without adding new mastery or affinity rewards', () =>
{
    const save = learner()
    game.applyLog(save, { text: 'SQL practice, 2 hours', source: 'web', classification: {
        summary: 'SQL practice', items: [{ taskId: 's1t1', skillId: 'sql', hours: 2 }],
    } })
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 33)
    assert.equal(save.points, 66) // SQL is medium difficulty: 33 progress points × 2
    assert.equal(save.pet.affinity, 40)
    assert.deepEqual(save.profile.skills, [])
    assert.equal('mastery' in save.pet, false)
})

test('public state and rule exports contain no active exams', () =>
{
    const save = learner()
    save.challenges.push({ id: 'legacy', result: null, questions: [{ question: 'Retired' }] })
    const state = game.view(save, ai)
    for(const key of ['activeChallenge', 'challenges'])
        assert.equal(key in state, false)
    assert.equal(state.roadmap.stages.some((stage) => 'gymReady' in stage || 'challenge' in stage), false)
    assert.equal('canChallenge' in game, false)
    assert.equal('finishChallenge' in game, false)
    assert.ok(Object.keys(game.RULES).every((key) => !/gym|pass/i.test(key)))
    assert.equal(save.challenges.length, 1)
})

test('retired exam endpoints return 404 before reading or mutating a save', async () =>
{
    const { handle } = await import('./app.js')
    for(const action of ['start', 'submit', 'abandon'])
    {
        let body
        const response = { statusCode: 0, setHeader() {}, end(text) { body = JSON.parse(text) } }
        assert.equal(await handle({ method: 'POST', url: `/api/gym/${action}` }, response), true)
        assert.equal(response.statusCode, 404)
        assert.deepEqual(body, { error: 'not-found' })
    }
})

test('unticking a task ticked by mistake puts its progress back', () =>
{
    const save = learner()
    const task = save.roadmap.stages[0].tasks[0] // 6 MP
    task.progress = 0
    game.setTaskDone(save, task.id, true)
    assert.equal(task.progress, 100)
    game.setTaskDone(save, task.id, false)
    assert.equal(task.progress, 0)

    // Hours logged while it was ticked still count once unticked
    game.setTaskDone(save, task.id, true)
    game.applyLog(save, { text: 'SQL', source: 'web', classification: { verdict: 'learned', summary: '', items: [{ taskId: task.id, skillId: 'sql', hours: 3 }] } })
    assert.equal(task.progress, 100)
    game.setTaskDone(save, task.id, false)
    assert.equal(task.progress, 50)
})
