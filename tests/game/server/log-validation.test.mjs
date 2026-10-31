import assert from 'node:assert/strict'
import test from 'node:test'

// Canned AI answers, set before the modules read it (like the other server tests)
process.env.AI_MOCK = '1'
const { createSave } = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const { submitLog, answerLog, publicLogValidation } = await import('../../../src/game/server/log-validation.js')

function learner()
{
    const save = createSave()
    save.lang = 'en'
    game.setTarget(save, { careerId: 'data-analyst', mode: 'general' })
    save.roadmap = game.buildRoadmap({ overview: 'SQL', stages: [
        { title: 'SQL', why: 'Practice', skillIds: ['sql'], requirementRefs: [], prerequisiteIndexes: [], tasks: [{ title: 'SQL joins', why: 'Practice', skillId: 'sql', effortHours: 10 }] },
    ] })
    return save
}

test('learning report waits for exactly two correct answers before awarding progress or points', async () =>
{
    const save = learner()
    const report = await submitLog(save, { content: 'Practised SQL joins for 2 hours', source: 'telegram', lang: 'en' })
    assert.equal(report.log, undefined)
    assert.equal(JSON.stringify(report).includes('answerIndex'), false)
    assert.equal(save.points, 0)
    assert.equal(save.logs.length, 0)
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 0)
    const quiz = report.quiz
    const first = answerLog(save, { quizId: quiz.id, step: 0, optionIndex: 1 })
    assert.equal(first.next, true)
    assert.equal(save.logs.length, 0)
    assert.equal(save.points, 0)
    assert.equal(game.view(save, {}).logValidation.step, 1)
    assert.throws(() => answerLog(save, { quizId: quiz.id, step: 0, optionIndex: 1 }), { code: 'log-quiz-stale' })
    const final = answerLog(save, { quizId: quiz.id, step: 1, optionIndex: 2 })
    assert.equal(final.passed, true)
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 20)
    assert.equal(save.logs.length, 1)
    assert.equal(save.logs[0].source, 'telegram')
    assert.equal(save.points, 40)
    assert.equal(publicLogValidation(save), null)
    assert.throws(() => answerLog(save, { quizId: quiz.id, step: 1, optionIndex: 2 }), { code: 'log-quiz-stale' })
})

test('failed and stale quizzes cannot record a report; vague reports stay uncounted', async () =>
{
    const save = learner()
    const content = 'Practised SQL joins for 2 hours'
    let quiz = (await submitLog(save, { content, source: 'web', lang: 'en' })).quiz
    assert.equal(answerLog(save, { quizId: quiz.id, step: 0, optionIndex: 0 }).passed, false)
    assert.equal(save.logs.length, 0)
    quiz = (await submitLog(save, { content, source: 'web', lang: 'en' })).quiz
    answerLog(save, { quizId: quiz.id, step: 0, optionIndex: 1 })
    save.roadmap.generatedAt = 'replanned'
    assert.throws(() => answerLog(save, { quizId: quiz.id, step: 1, optionIndex: 2 }), { code: 'log-quiz-stale' })
    assert.equal(save.logs.length, 0)
    const vague = await submitLog(learner(), { content: 'SQL', source: 'web', lang: 'en' })
    assert.equal(vague.quiz, undefined)
    assert.equal(vague.log.advanced.length, 0)
})
