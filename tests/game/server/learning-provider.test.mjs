import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

const requests = [], answers = [], jobs = new Map()
const server = http.createServer((request, response) =>
{
    let raw = ''
    request.on('data', chunk => raw += chunk)
    request.on('end', () =>
    {
        response.setHeader('content-type', 'application/json')
        if(request.method === 'POST')
        {
            requests.push(JSON.parse(raw))
            const jobId = `learning-${jobs.size}`
            jobs.set(jobId, answers.shift())
            response.writeHead(202)
            return response.end(JSON.stringify({ jobId, status: 'queued' }))
        }
        response.end(JSON.stringify({ jobId: request.url.split('/').at(-1), status: 'succeeded', value: jobs.get(request.url.split('/').at(-1)) }))
    })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
process.env.AI_PROVIDER = 'deepseek_direct'
process.env.AWS_BACKEND_URL = `http://127.0.0.1:${server.address().port}`
process.env.AWS_BACKEND_TOKEN = 'synthetic-learning-test-token'
delete process.env.AI_MOCK
test.after(() => server.close())

const { generateRoadmap } = await import('../../../src/game/server/features.js')
const { learningContext } = await import('../../../src/game/server/learning-rules.js')
const text = { zh: '解释和检查', en: 'Explain and verify', ms: 'Terangkan dan sahkan' }
const task = { title: text, why: text, effortHours: 2, skillId: 'python', learningActivity: 'verification', deliverable: text, completionCriteria: text, evidenceRefs: [ 'aei:python', 'invented-source' ] }
const target = { careerId: 'ml-engineer', mode: 'general' }
const profile = { skills: [], summary: '' }
// The player's choice for this learning cycle, as setLearningMode stores it
const context = learningContext({ target, profile, scenario: { preset: 'extreme' }, learning: { mode: 'extreme' } })
const layout = [ { kind: 'core', branch: null, skillIds: [ 'python' ], basis: [ text ], gains: {} } ]

test('the actual provider path receives AEI policy and cannot change the No-Regret layout or cite invented evidence', async () =>
{
    answers.push({ stages: [ { title: text, why: text, requirementRefs: [], tasks: [ task ] } ] })
    const result = await generateRoadmap({ target, profile, gaps: [], lang: 'en', layout, learning: context })
    assert.equal(result.stages[0].kind, 'core')
    assert.deepEqual(result.stages[0].skillIds, [ 'python' ])
    assert.deepEqual(result.stages[0].tasks[0].evidenceRefs, [ 'aei:python' ])
    assert.ok(requests[0].system.includes('snapshot cannot establish development SPEED'))
    assert.ok(requests[0].system.includes('"effectiveScenario":"extreme"'))
    assert.ok(requests[0].system.includes('"isTrendEvidence":false'))
    answers.push({ stages: [ { title: text, why: text, requirementRefs: [], tasks: [ { ...task, skillId: 'sql' } ] } ] })
    const mismatched = await generateRoadmap({ target, profile, gaps: [], lang: 'en', layout, learning: context })
    assert.ok(mismatched.stages[0].tasks.every(item => item.skillId === 'python'), 'out-of-stage skill falls back to an appropriate task')
})

test('the same generator accepts adjustment requests and returns a patch rather than a replacement roadmap', async () =>
{
    answers.push({ summary: text, updates: [ { taskId: 's1t2', title: text, why: text, deliverable: text, completionCriteria: text, effortHours: 3 } ], additions: [] })
    const patch = await generateRoadmap({ target, profile, gaps: [], lang: 'en', learning: context,
        adjustment: { editableTasks: [ { id: 's1t2', skillId: 'python', progress: 0 } ], latestReview: { understanding: 'needs_practice' } } })
    assert.equal(patch.stages, undefined)
    assert.equal(patch.updates[0].taskId, 's1t2')
    assert.ok(requests.at(-1).content.includes('needs_practice'))
})

test('provider-backed checkpoints evaluate the actual studied task and keep rubric and mastery private', async () =>
{
    const { createCheckpoint, reviewCheckpoint, learningView } = await import('../../../src/game/server/adaptive-learning.js')
    const save = { target, profile, lang: 'en', logs: [], points: 8, mastery: { python: 10 }, learning: { mode: 'extreme', reviews: [] },
        roadmap: { generatedAt: new Date().toISOString(), stages: [ { id: 's1', skillIds: [ 'python' ], tasks: [ { id: 's1t1', title: text, why: text, skillId: 'python', mp: 2, progress: 50 } ] } ] } }
    answers.push({ progressQuestion: { ...text, en: 'What Python work did you complete this week, and how long did it take?' },
        difficultyQuestion: { ...text, en: 'Which step in checking your Python output was difficult?' },
        question: text, privateRubric: 'Must explain validation using an independent expected result.' })
    await createCheckpoint(save)
    const view = learningView(save)
    assert.equal(view.checkpoint.question, 'Explain and verify')
    assert.match(view.checkpoint.progressQuestion, /Python work/)
    assert.match(view.checkpoint.difficultyQuestion, /checking your Python output/)
    assert.ok(!JSON.stringify(view).includes('privateRubric'))
    answers.push({ understanding: 'needs_practice', nextAction: 'reinforce', feedback: text })
    const review = await reviewCheckpoint(save, { checkpointId: view.checkpoint.id, progress: 'Built a function', difficulty: 'Checking the output', answer: 'I checked that it runs without errors.' })
    assert.equal(review.understanding, 'needs_practice')
    assert.ok(requests.at(-1).content.includes('Must explain validation'))
    assert.equal(save.points, 8)
    assert.equal(save.mastery.python, 10)
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 50)
})

test('no-study check-ins generate scheduling questions through the provider and cannot certify understanding', async () =>
{
    const { createCheckpoint, reviewCheckpoint, learningView } = await import('../../../src/game/server/adaptive-learning.js')
    const save = { target, profile, lang: 'en', logs: [], points: 0, learning: { mode: 'moderate', reviews: [] },
        roadmap: { generatedAt: new Date().toISOString(), stages: [ { id: 's1', skillIds: [ 'python' ], tasks: [ { id: 's1t1', title: text, skillId: 'python', progress: 0 } ] } ] } }
    answers.push({ progressQuestion: text, difficultyQuestion: text, question: text, privateRubric: 'Model output cannot override the no-study rule.' })
    await createCheckpoint(save)
    assert.equal(JSON.parse(requests.at(-1).content).feedbackOnly, true)
    assert.equal(learningView(save).checkpoint.feedbackOnly, true)
    const requestCount = requests.length
    await createCheckpoint(save)
    assert.equal(requests.length, requestCount, 'reopening the same check-in reuses its generated questions')
    const review = await reviewCheckpoint(save, { checkpointId: save.learning.checkpoint.id, progress: 'No study', difficulty: 'No time', answer: 'I understand everything.' })
    assert.equal(review.understanding, 'insufficient_evidence')
    assert.equal(save.points, 0)
})

test('refresh requests a new question from the provider and preserves the old question if regeneration fails or repeats', async () =>
{
    const { createCheckpoint } = await import('../../../src/game/server/adaptive-learning.js')
    const save = { target, profile, lang: 'en', logs: [], points: 5, learning: { mode: 'moderate', reviews: [] },
        roadmap: { generatedAt: new Date().toISOString(), stages: [ { id: 's1', skillIds: [ 'python' ], tasks: [ { id: 's1t1', title: text, skillId: 'python', progress: 50 } ] } ] } }
    const first = { progressQuestion: text, difficultyQuestion: text, question: text, privateRubric: 'first rubric' }
    answers.push(first)
    await createCheckpoint(save)
    const previous = structuredClone(save.learning.checkpoint)
    const second = { ...first, question: { ...text, en: 'How would you detect a wrong result using a separate example?' }, privateRubric: 'second rubric' }
    answers.push(second)
    await createCheckpoint(save, { refresh: true, checkpointId: previous.id })
    const refreshed = structuredClone(save.learning.checkpoint)
    assert.notEqual(refreshed.id, previous.id)
    assert.equal(refreshed.privateRubric, 'second rubric')
    const request = JSON.parse(requests.at(-1).content)
    assert.equal(request.refresh, true)
    assert.deepEqual(request.previousQuestions.question, previous.question)
    assert.equal(request.previousQuestions.privateRubric, undefined)
    answers.push(second)
    await assert.rejects(createCheckpoint(save, { refresh: true, checkpointId: refreshed.id }), /checkpoint-refresh-unchanged/)
    assert.deepEqual(save.learning.checkpoint, refreshed)
    answers.push(null, null)
    await assert.rejects(createCheckpoint(save, { refresh: true, checkpointId: refreshed.id }))
    assert.deepEqual(save.learning.checkpoint, refreshed)
    assert.equal(save.points, 5)
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 50)
})
