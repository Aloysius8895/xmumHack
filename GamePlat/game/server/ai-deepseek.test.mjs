import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

// A local stand-in for DeepSeek's Anthropic-compatible endpoint: records the requests, answers from a queue
const requests = []
const answers = []
const server = http.createServer((request, response) =>
{
    let body = ''
    request.on('data', (chunk) => body += chunk)
    request.on('end', () =>
    {
        requests.push({ url: request.url, headers: request.headers, body: JSON.parse(body) })
        const answer = answers.shift()
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'deepseek-flash', stop_reason: answer.stop ?? 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: answer.content }))
    })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

process.env.AI_PROVIDER = 'deepseek'
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${server.address().port}`
process.env.ANTHROPIC_API_KEY = 'claude-key-must-not-leave'
delete process.env.DEEPSEEK_API_KEY
delete process.env.AI_MOCK
const ai = await import('./ai.js')

const schema = {
    type: 'object',
    properties: {
        verdict: { type: 'string', enum: [ 'learned', 'vague' ] },
        hours: { type: 'integer' },
    },
    required: [ 'verdict', 'hours' ],
    additionalProperties: false,
}
const call = (input, id = 'tool1') => ({ content: [ { type: 'tool_use', id, name: 'submit_result', input } ], stop: 'tool_use' })

test.after(() => server.close())

test('without DEEPSEEK_API_KEY nothing is sent, not even the Claude key', async () =>
{
    await assert.rejects(ai.ask({ system: 's', content: 'c', schema }), { code: 'ai-auth' })
    assert.equal(requests.length, 0)
    process.env.DEEPSEEK_API_KEY = 'deepseek-key'
})

test('status reports DeepSeek and its model', () =>
{
    assert.deepEqual(ai.status(), { mock: false, provider: 'deepseek', model: 'deepseek-flash', keyConfigured: true })
})

test('structured answers come from a forced tool call, fixed and checked against the schema', async () =>
{
    answers.push(call({ verdict: 'learned', hours: '2', extra: 'dropped' }))
    assert.deepEqual(await ai.ask({ system: 'Classify.', content: 'Studied SQL 2h', schema }), { verdict: 'learned', hours: 2 })

    const sent = requests.at(- 1)
    assert.equal(sent.url, '/v1/messages')
    assert.equal(sent.headers['x-api-key'], 'deepseek-key')
    assert.equal(sent.headers.authorization, undefined)
    assert.equal(sent.body.model, 'deepseek-flash')
    assert.deepEqual(sent.body.tool_choice, { type: 'tool', name: 'submit_result' })
    assert.deepEqual(sent.body.tools[0].input_schema, schema)
    assert.deepEqual(sent.body.thinking, { type: 'disabled' })
    assert.equal(sent.body.output_config, undefined)
})

test('a result outside the schema is sent back once with the problem, then accepted', async () =>
{
    answers.push(call({ verdict: 'maybe', hours: 1 }, 'first'), call({ verdict: 'vague', hours: 0 }, 'second'))
    assert.deepEqual(await ai.ask({ system: 's', content: 'c', schema }), { verdict: 'vague', hours: 0 })
    const retry = requests.at(- 1).body.messages
    assert.equal(retry.length, 3)
    assert.equal(retry[2].content[0].tool_use_id, 'first')
    assert.match(retry[2].content[0].content, /result\.verdict must be one of learned, vague/)
})

test('two wrong results end in ai-error', async () =>
{
    answers.push(call({ verdict: 'learned' }), call({ verdict: 'learned' }))
    await assert.rejects(ai.ask({ system: 's', content: 'c', schema }), { code: 'ai-error', message: /result\.hours is missing/ })
})

test('plain replies and images work, PDF files are refused before any request', async () =>
{
    answers.push({ content: [ { type: 'text', text: '  Start with SQL.  ' } ] })
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }
    assert.equal(await ai.reply({ system: 's', messages: [ { role: 'user', content: [ image, { type: 'text', text: 'What is this?' } ] } ] }), 'Start with SQL.')
    assert.deepEqual(requests.at(- 1).body.messages[0].content[0], image)

    const count = requests.length
    const pdf = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } }
    await assert.rejects(ai.reply({ system: 's', messages: [ { role: 'user', content: [ pdf, { type: 'text', text: 'CV' } ] } ] }), { code: 'ai-no-pdf' })
    await assert.rejects(ai.ask({ system: 's', content: [ pdf ], schema }), { code: 'ai-no-pdf' })
    assert.equal(requests.length, count)
})
