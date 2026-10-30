import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-expert-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'
const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
let sequence = 0

async function call(body = {}, token = 'test-token')
{
    const request = Readable.from([ Buffer.from(JSON.stringify({ channel: 'telegram', from: 'tg:123', messageId: `tg:${++sequence}`, action: 'enter', ...body })) ])
    Object.assign(request, { method: 'POST', url: '/api/integrations/expert', headers: token ? { authorization: `Bearer ${token}` } : {} })
    let payload
    const response = { setHeader() {}, end(text) { payload = JSON.parse(text) } }
    await handle(request, response)
    return { status: response.statusCode, body: payload }
}

function target(id = 'data-analyst')
{
    const save = store.createSave()
    save.lang = 'en'
    game.setTarget(save, { careerId: id, mode: 'general' })
    store.save(save)
}

test.beforeEach(() => store.save(store.createSave()))

test('expert integration requires authentication and a valid Telegram sender/event', async () =>
{
    assert.equal((await call({}, null)).status, 401)
    assert.equal((await call({ channel: 'whatsapp' })).status, 400)
    assert.equal((await call({ from: 'not-a-telegram-user' })).status, 400)
    assert.equal((await call({ messageId: '' })).status, 400)
})

test('/expert introduces the expert of the saved target, with a public-record disclaimer', async () =>
{
    target()
    const result = await call({ careerId: 'ml-engineer' })
    assert.equal(result.status, 200)
    assert.equal(result.body.careerId, 'data-analyst')
    assert.equal(result.body.expert.name, 'Hans Rosling')
    assert.match(result.body.reply, /Hans Rosling/)
    assert.match(result.body.reply, /public|real person/i)
    assert.deepEqual(result.body.history, [])
    assert.equal(result.body.active, true)
})

test('missing target and unsupported careers explain the problem without entering expert mode', async () =>
{
    assert.equal((await call()).body.active, false)
    target('frontend-developer')
    const result = await call()
    assert.equal(result.body.active, false)
    assert.match(result.body.reply, /no.*expert|expert.*available/i)
})

test('expert questions use persona cards, keep bounded history and never award progress', async () =>
{
    target()
    const before = store.load()
    const result = await call({ action: 'ask', careerId: 'data-analyst', text: 'How should I read this data?', history: [ { role: 'user', content: 'Earlier question' }, { role: 'assistant', content: 'Earlier answer' } ] })
    assert.equal(result.status, 200)
    assert.match(result.body.reply, /Hans Rosling/)
    assert.equal(result.body.history[0].content, 'Earlier question')
    assert.equal(result.body.history.at(-2).content, 'How should I read this data?')
    const after = store.load()
    for(const key of [ 'points', 'logs', 'mastery', 'roadmap', 'digests' ])
        assert.deepEqual(after[key], before[key])
})

test('changing the web target switches expert, introduces them and drops the previous persona history', async () =>
{
    target('ml-engineer')
    const result = await call({ action: 'ask', careerId: 'data-analyst', text: 'How do I begin?', history: [ { role: 'user', content: 'Old Rosling question' }, { role: 'assistant', content: 'Old Rosling answer' } ] })
    assert.equal(result.body.careerId, 'ml-engineer')
    assert.match(result.body.reply, /Andrej Karpathy/)
    assert.equal(result.body.history.length, 2)
    assert.ok(!JSON.stringify(result.body.history).includes('Old Rosling'))
})

test('retried expert messages reuse the response without duplicating turns; conflicting replays fail', async () =>
{
    target()
    const body = { action: 'ask', messageId: 'tg:stable', careerId: 'data-analyst', text: 'What first?' }
    const first = await call(body)
    const retry = await call({ ...body, history: first.body.history })
    assert.equal(retry.body.duplicate, true)
    assert.deepEqual(retry.body.history, first.body.history)
    assert.equal((await call({ ...body, text: 'Different question' })).status, 409)
})

test('long conversations retain only the last three exchanges and the delivery cache stays bounded', async () =>
{
    target()
    const history = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `turn ${index}` }))
    const result = await call({ action: 'ask', careerId: 'data-analyst', text: 'Next question', history })
    assert.equal(result.body.history.length, 6)
    assert.equal(result.body.history[0].role, 'user')
    assert.equal(result.body.history.at(-1).role, 'assistant')
    const saved = store.load()
    const first = Object.entries(saved.telegramExpertReceipts)[0]
    saved.telegramExpertReceipts = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [ `old-${index}`, first[1] ]))
    store.save(saved)
    await call()
    assert.equal(Object.keys(store.load().telegramExpertReceipts).length, 64)
})
