import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-live-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'

const { handle } = await import('../../../src/game/server/app.js')
const live = await import('../../../src/game/server/live.js')

const server = http.createServer(async (request, response) =>
{
    if(!(await handle(request, response)))
    {
        response.statusCode = 404
        response.end()
    }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
test.after(() => server.close())

/**
 * An open /api/events stream: next() resolves with the next event { event, data }
 */
async function listen()
{
    const controller = new AbortController()
    const response = await fetch(`${base}/api/events`, { signal: controller.signal })
    assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    return {
        async next()
        {
            while(!buffer.includes('\n\n'))
            {
                const { value, done } = await reader.read()
                if(done)
                    throw new Error('stream closed')
                buffer += value
            }
            const end = buffer.indexOf('\n\n')
            const block = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const field = (name) => block.split('\n').find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2)
            return { event: field('event'), data: JSON.parse(field('data') ?? 'null') }
        },
        close: () => controller.abort(),
    }
}

function post(route, body, headers = {})
{
    return fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
}

test('a Telegram progress report reaches an open game tab right away', async () =>
{
    const stream = await listen()
    assert.equal((await stream.next()).event, 'hello')

    const response = await post('/api/integrations/digest', { date: '2026-10-24', summary: 'SQL joins', skills: [ { skillId: 'sql', mastery: 40 } ] }, { authorization: 'Bearer test-token', 'x-career-client': 'spoofed' })
    assert.equal(response.status, 200)
    const change = await stream.next()
    assert.equal(change.event, 'change')
    assert.equal(change.data.origin, null, 'integrations never claim to be a tab')
    stream.close()
})

test('a change made in a tab names that tab, so it can skip reloading its own state', async () =>
{
    const stream = await listen()
    await stream.next()
    await post('/api/lang', { lang: 'en' }, { 'x-career-client': 'tab-123' })
    const change = await stream.next()
    assert.deepEqual([ change.event, change.data.origin ], [ 'change', 'tab-123' ])
    stream.close()
})

test('failed writes and reads send nothing, closed tabs are forgotten', async () =>
{
    const stream = await listen()
    const hello = await stream.next()
    await post('/api/integrations/digest', { date: 'bad', skills: [] }, { authorization: 'Bearer test-token' })
    await fetch(`${base}/api/state`)
    await post('/api/lang', { lang: 'zh' })
    const change = await stream.next()
    assert.equal(change.data.revision, hello.data.revision + 1, 'only the successful write counted')

    stream.close()
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(live.listeners(), 0)
})
