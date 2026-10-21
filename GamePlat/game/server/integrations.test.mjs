import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-integrations-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'

const { handle } = await import('./app.js')
const store = await import('./store.js')
const game = await import('./game.js')

async function call(route, body, token = 'test-token')
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: token ? { authorization: `Bearer ${token}` } : {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('integrations need the bearer token', async () =>
{
    assert.equal((await call('/api/integrations/market', {}, null)).status, 401)
    assert.equal((await call('/api/integrations/market', {}, 'wrong')).status, 401)
})

test('market snapshots update the careers trend, change computed from postings', async () =>
{
    let result = await call('/api/integrations/market', { period: '2026-10', source: 'linkedin+indeed', careers: { 'data-analyst': { postings: 1000 }, 'not-a-career': { postings: 5 } } })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.careers, [ 'data-analyst' ])

    result = await call('/api/integrations/market', { period: '2026-11', careers: { 'data-analyst': { postings: 1100, note: 'More BI roles', topSkills: { sql: 700, unknown: 3 } } } })
    assert.equal(result.status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.monthly
    assert.equal(trend.live, true)
    assert.equal(trend.period, '2026-11')
    assert.equal(trend.change, 10)
    assert.equal(trend.postings, 1100)
    assert.deepEqual(trend.topSkills, { sql: 700 })

    assert.equal((await call('/api/integrations/market', { period: 'October', careers: {} })).status, 400)
})

test('chat messages from the bots are filed as logs and get a reply', async () =>
{
    const save = store.load()
    save.roadmap = { stages: [ { id: 's1', tasks: [ { id: 's1t1', skillId: 'sql', mp: 10, progress: 0 } ], prerequisites: [] } ] }
    store.save(save)

    const result = await call('/api/integrations/chat', { channel: 'telegram', text: 'Practised SQL joins for 2 hours', lang: 'en' })
    assert.equal(result.status, 200)
    assert.equal(typeof result.body.reply, 'string')
    assert.equal(result.body.log.source, 'telegram')
    assert.equal(store.load().roadmap.stages[0].tasks[0].progress, 20)
    assert.equal((await call('/api/integrations/chat', { channel: 'email', text: 'hi' })).status, 400)
})

test('daily digests set or raise the skill mastery shown on the pet skills', async () =>
{
    let result = await call('/api/integrations/digest', { date: '2026-10-21', summary: 'SQL joins', skills: [ { skillId: 'sql', mastery: 40 }, { skillId: 'nope', mastery: 90 } ] })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.digest.skills.map((item) => [ item.skillId, item.to ]), [ [ 'sql', 40 ] ])

    result = await call('/api/integrations/digest', { date: '2026-10-22', skills: [ { skillId: 'sql', delta: 75 } ] })
    assert.equal(result.body.digest.skills[0].to, 100) // clamped

    const save = store.load()
    assert.equal(save.mastery.sql, 100)
    assert.equal(save.digests.length, 2)
})

test('saves from version 2 get the mastery fields', () =>
{
    const file = path.join(process.env.SAVE_DIR, 'save.json')
    const old = { ...store.createSave(), version: 2 }
    delete old.mastery
    delete old.digests
    fs.writeFileSync(file, JSON.stringify(old))
    const save = store.load()
    assert.equal(save.version, 3)
    assert.deepEqual(save.mastery, {})
    assert.deepEqual(save.digests, [])
})
