import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

process.env.AI_PROVIDER = 'runpod'
delete process.env.AWS_BACKEND_URL
delete process.env.AWS_BACKEND_TOKEN
process.env.RUNPOD_API_KEY = 'test-secret'
process.env.RUNPOD_MODEL = 'test-model'
const requests = []
const answers = []
const server = http.createServer(async (request, response) =>
{
    let body = ''
    for await(const chunk of request) body += chunk
    requests.push({ url: request.url, headers: request.headers, body: JSON.parse(body) })
    const answer = answers.shift()
    response.writeHead(answer.status ?? 200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(answer.body ?? { choices: [ { finish_reason: answer.finish ?? 'stop', message: { content: answer.text } } ] }))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
process.env.RUNPOD_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`
const ai = await import('../../../src/game/server/ai.js')
test.after(() => server.close())

test('RunPod routes existing replies and structured features through the configured backend', async () =>
{
    assert.equal(ai.status().provider, 'runpod')
    assert.equal(ai.status().keyConfigured, true)
    answers.push({ text: 'Hello' })
    const chunks = []
    assert.equal(await ai.reply({ system: 'mentor', messages: [ { role: 'user', content: 'Hi' } ], onText: (text) => chunks.push(text) }), 'Hello')
    assert.deepEqual(chunks, [ 'Hello' ])
    assert.equal(requests[0].url, '/v1/chat/completions')
    assert.equal(requests[0].headers.authorization, 'Bearer test-secret')
    assert.equal(requests[0].body.model, 'test-model')
    assert.deepEqual(requests[0].body.messages[0], { role: 'system', content: 'mentor' })
    const schema = { type: 'object', properties: { score: { type: 'integer' } }, required: [ 'score' ], additionalProperties: false }
    answers.push({ text: '{"wrong":1}' }, { text: '{"score":3}' })
    assert.deepEqual(await ai.ask({ system: 'grade', content: 'report', schema }), { score: 3 })
    assert.deepEqual(requests.at(-1).body.response_format.json_schema.schema, schema)
    assert.match(requests.at(-1).body.messages.at(-1).content, /Correct the result/)
    answers.push({ text: 'not JSON' }, { text: 'still not JSON' })
    await assert.rejects(ai.ask({ system: 'grade', content: 'report', schema }), { code: 'ai-error' })
})

test('RunPod maps failures and never falls back to another provider', async () =>
{
    const args = { system: 's', messages: [ { role: 'user', content: 'hi' } ] }
    for(const [ status, code ] of [ [ 401, 'ai-auth' ], [ 429, 'ai-busy' ], [ 500, 'ai-error' ] ])
    {
        answers.push({ status })
        await assert.rejects(ai.reply(args), { code })
    }
    answers.push({ text: 'cut', finish: 'length' })
    await assert.rejects(ai.reply(args), { code: 'ai-truncated' })
    answers.push({ body: { choices: [] } })
    await assert.rejects(ai.reply(args), { code: 'ai-error' })
    delete process.env.RUNPOD_API_KEY
    const count = requests.length
    assert.equal(ai.status().keyConfigured, false)
    await assert.rejects(ai.reply(args), { code: 'ai-auth' })
    assert.equal(requests.length, count)
})
