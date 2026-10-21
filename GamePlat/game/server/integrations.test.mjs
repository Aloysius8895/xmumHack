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

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    assert.equal(trend.live, true)
    assert.equal(trend.period, '2026-11')
    assert.equal(trend.change, 10)
    assert.equal(trend.postings, 1100)
    assert.deepEqual(trend.topSkills, { sql: 700 })

    assert.equal((await call('/api/integrations/market', { period: 'October', careers: {} })).status, 400)
})

test('weekly snapshots are kept as history, the same week is a correction', async () =>
{
    // Earlier monthly snapshots (previous test) are migrated into the history and sort before the weeks
    for(const [ period, postings ] of [ [ '2026-12-07', 20 ], [ '2026-12-21', 30 ], [ '2026-12-14', 25 ], [ '2026-12-21', 24 ] ])
        assert.equal((await call('/api/integrations/market', { period, careers: { 'data-analyst': { postings } } })).status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    assert.equal(trend.period, '2026-12-21')
    assert.equal(trend.postings, 24, 'second push of the week replaced the first')
    assert.deepEqual(trend.history.map((point) => point.period), [ '2026-10', '2026-11', '2026-12-07', '2026-12-14', '2026-12-21' ])
    assert.deepEqual(trend.history.slice(2).map((point) => point.postings), [ 20, 25, 24 ])
    assert.equal(trend.history.at(- 2).change, 25, 'week pushed late compares with the week before it: 25 vs 20')
    assert.equal(trend.change, - 4, '24 vs 25 of the week before')

    // Only the last 26 periods are kept
    for(let week = 0; week < 30; week++)
    {
        const day = new Date(Date.UTC(2027, 0, 4 + week * 7)).toISOString().slice(0, 10)
        await call('/api/integrations/market', { period: day, careers: { 'data-analyst': { postings: week } } })
    }
    const market = store.loadMarket()
    assert.equal(market.history.length, 26)
    assert.equal(market.latest.period, market.history.at(- 1).period)
    assert.equal(market.previous.period, market.history.at(- 2).period)
})

test('backfilled weeks are kept but never compared', async () =>
{
    for(const [ period, postings, backfilled ] of [ [ '2028-01-03', 5, true ], [ '2028-01-10', 8, true ], [ '2028-01-17', 30, false ], [ '2028-01-24', 33, false ] ])
        assert.equal((await call('/api/integrations/market', { period, backfilled, careers: { 'data-analyst': { postings } } })).status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    const weeks = trend.history.slice(- 4)
    assert.deepEqual(weeks.map((point) => point.backfilled), [ true, true, false, false ])
    assert.deepEqual(weeks.map((point) => point.change), [ null, null, null, 10 ], 'only live week vs live week is compared')
    assert.equal(trend.change, 10)
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
