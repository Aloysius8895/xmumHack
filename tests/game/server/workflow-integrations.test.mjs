import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-integration-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'
const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')

async function call(route, body)
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: { authorization: 'Bearer test-token' } })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('historical IDs track novelty without reducing repeated weekly sample counts', async () =>
{
    const payload = { period: '2030-01-07', careers: { 'data-analyst': { postings: 1, topSkills: { sql: 1 } } }, collection: { source: 'jsearch', complete: true, expectedQueries: 12, successfulQueries: 12, country: 'my', window: 'week', numPages: 1, records: [ { careerId: 'data-analyst', id: 'job-A' } ] } }
    let result = await call('/api/integrations/market', payload)
    assert.equal(result.status, 200)
    assert.equal(result.body.collection.newJobs, 1)
    result = await call('/api/integrations/market', payload)
    assert.equal(result.body.collection.newJobs, 0)
    assert.equal(store.loadMarket().history.length, 1)
    result = await call('/api/integrations/market', { ...payload, period: '2030-01-14' })
    assert.equal(result.body.collection.seenJobs, 1)
    const saved = store.loadMarket()
    assert.deepEqual(saved.history.map((week) => week.careers['data-analyst'].postings), [ 1, 1 ])
    assert.equal(saved.latest.careers['data-analyst'].change, 0)
    assert.ok(!JSON.stringify(saved.jobArchive).includes('job-A'), 'persist fingerprints only')
    const before = JSON.stringify(saved)
    result = await call('/api/integrations/market', { ...payload, collection: { ...payload.collection, complete: false } })
    assert.equal(result.status, 400)
    assert.equal(JSON.stringify(store.loadMarket()), before)
    result = await call('/api/integrations/market', { ...payload, collection: { ...payload.collection, records: [] } })
    assert.equal(result.status, 400)
    assert.equal(JSON.stringify(store.loadMarket()), before)
})

test('concurrent retries of the same Telegram report create one quiz, then two answers award progress once', async () =>
{
    const save = store.createSave()
    save.roadmap = { stages: [ { id: 's1', tasks: [ { id: 's1t1', skillId: 'sql', mp: 10, progress: 0 } ], prerequisites: [] } ] }
    store.save(save)
    const payload = { channel: 'telegram', from: 'tg:123', messageId: 'tg:42', text: 'Practised SQL joins for 2 hours', lang: 'en' }
    const results = await Promise.all([ call('/api/integrations/chat', payload), call('/api/integrations/chat', payload) ])
    assert.ok(results.every((result) => result.status === 200))
    assert.equal(results[1].body.duplicate, true)
    assert.equal(store.load().logs.length, 0)
    assert.equal(results[0].body.quiz.id, results[1].body.quiz.id)
    const quizId = results[0].body.quiz.id
    const answer = (step, optionIndex, messageId) => call('/api/integrations/log-validate', { channel: 'telegram', from: 'tg:123', messageId, action: 'submit', quizId, step, optionIndex })
    assert.equal((await answer(0, 1, 'tg:43')).body.next, true)
    assert.equal(store.load().logs.length, 0)
    assert.equal((await answer(0, 1, 'tg:44')).status, 409)
    const done = await answer(1, 2, 'tg:45')
    assert.equal(done.body.passed, true)
    assert.equal(store.load().logs.length, 1)
    assert.equal(store.load().roadmap.stages[0].tasks[0].progress, 20)
    assert.equal(store.load().points, done.body.log.points)
    assert.equal((await answer(1, 2, 'tg:46')).status, 409)
    assert.equal((await call('/api/integrations/chat', { ...payload, text: 'different message' })).status, 409)
})

test('daily digest retries cannot add mastery twice; summary-only ignores all deltas', async () =>
{
    const body = { date: '2030-01-01', summary: 'SQL practice', skills: [ { skillId: 'sql', delta: 5 } ] }
    await call('/api/integrations/digest', body)
    await call('/api/integrations/digest', body)
    assert.equal(store.load().mastery.sql, 5)
    await call('/api/integrations/digest', { ...body, date: '2030-01-02', summaryOnly: true, skills: [ { skillId: 'sql', delta: 50 } ] })
    assert.equal(store.load().mastery.sql, 5)
    assert.deepEqual(store.load().digests[0].skills, [])
    // Display history is bounded, but replay protection must survive that trimming.
    for(let day = 1; day <= 65; day++)
        await call('/api/integrations/digest', { date: new Date(Date.UTC(2031, 0, day)).toISOString().slice(0, 10), summary: 'report', skills: [] })
    assert.ok(!store.load().digests.some((digest) => digest.date === body.date))
    await call('/api/integrations/digest', body)
    assert.equal(store.load().mastery.sql, 5)
})

test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))
