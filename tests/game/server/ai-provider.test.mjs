import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

// Local stand-in for the provider endpoint (Replit's proxy here): records the requests, answers from a queue
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
        response.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'm', stop_reason: answer.stop ?? 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: answer.content }))
    })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
test.after(() => server.close())

const KEYS = [ 'AI_PROVIDER', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'REPLIT_MODEL', 'CLAUDE_MODEL', 'AI_INTEGRATIONS_ANTHROPIC_API_KEY', 'AI_INTEGRATIONS_ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'AI_MOCK', 'AWS_BACKEND_URL', 'AWS_BACKEND_TOKEN' ]
let fresh = 0

// ai.js picks its provider when loaded: a new module instance per environment
async function load(env)
{
    for(const key of KEYS)
        delete process.env[key]
    Object.assign(process.env, env)
    return import(`../../../src/game/server/ai.js?case=${fresh++}`)
}

const replit = { AI_INTEGRATIONS_ANTHROPIC_API_KEY: 'replit-key', AI_INTEGRATIONS_ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}` }

test('provider: explicit AWS setting wins; direct DeepSeek key is never auto-selected', async () =>
{
    assert.equal((await load({ DEEPSEEK_API_KEY: 'd', ...replit, ANTHROPIC_API_KEY: 'a' })).PROVIDER, 'replit')
    assert.equal((await load({ DEEPSEEK_API_KEY: '', ...replit, ANTHROPIC_API_KEY: 'a' })).PROVIDER, 'replit')
    assert.equal((await load({ ANTHROPIC_API_KEY: 'a' })).PROVIDER, 'anthropic')
    assert.equal((await load({})).PROVIDER, 'anthropic')
    assert.equal((await load({ AWS_BACKEND_URL: 'https://api.example', AWS_BACKEND_TOKEN: 'server-token' })).PROVIDER, 'bedrock')
    assert.equal((await load({ AI_PROVIDER: 'deepseek_direct', AWS_BACKEND_URL: 'https://api.example', AWS_BACKEND_TOKEN: 'server-token' })).PROVIDER, 'deepseek_direct')
    await assert.rejects(load({ AWS_BACKEND_URL: 'https://api.example', AWS_BACKEND_TOKEN: '' }), /must be configured together/)
    // Forced with AI_PROVIDER, whatever keys are there
    assert.equal((await load({ AI_PROVIDER: 'anthropic', DEEPSEEK_API_KEY: 'd' })).PROVIDER, 'anthropic')
    assert.equal((await load({ AI_PROVIDER: 'Replit', DEEPSEEK_API_KEY: 'd', ...replit })).PROVIDER, 'replit')
})

test('Replit: Claude Opus 5 by default, configured key, strict forced tool, PDF files passed on', async () =>
{
    const ai = await load({ ...replit, ANTHROPIC_API_KEY: 'own-claude-key' })
    assert.deepEqual(ai.status(), { mock: false, provider: 'replit', model: 'claude-opus-5', keyConfigured: true })

    const schema = { type: 'object', properties: { title: { type: 'string' } }, required: [ 'title' ], additionalProperties: false }
    answers.push({ content: [ { type: 'tool_use', id: 't', name: 'submit_result', input: { title: 'Data Analyst' } } ], stop: 'tool_use' })
    const pdf = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } }
    assert.deepEqual(await ai.ask({ system: 's', content: [ pdf, { type: 'text', text: 'Read the CV' } ], schema }), { title: 'Data Analyst' })

    const sent = requests.at(- 1)
    assert.equal(sent.url, '/v1/messages')
    assert.equal(sent.headers['x-api-key'], 'replit-key')
    assert.equal(sent.headers['anthropic-beta'], undefined)
    assert.equal(sent.body.model, 'claude-opus-5')
    assert.equal(sent.body.tools[0].strict, true)
    assert.deepEqual(sent.body.tool_choice, { type: 'tool', name: 'submit_result' })
    assert.deepEqual(sent.body.thinking, { type: 'disabled' })
    assert.deepEqual(sent.body.messages[0].content[0], pdf)

    answers.push({ content: [ { type: 'text', text: 'Hello' } ] })
    assert.equal(await ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ] }), 'Hello')
    assert.equal(requests.at(- 1).body.betas, undefined)
})

test('Replit forced without its variables: a key error, the own Claude key is not used instead', async () =>
{
    const ai = await load({ AI_PROVIDER: 'replit', ANTHROPIC_API_KEY: 'own-claude-key' })
    assert.equal(ai.status().keyConfigured, false)
    const count = requests.length
    await assert.rejects(ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ] }), { code: 'ai-auth' })
    assert.equal(requests.length, count)
})

test('REPLIT_MODEL picks another model of Replit\'s list', async () =>
{
    assert.equal((await load({ ...replit, REPLIT_MODEL: 'claude-sonnet-5' })).MODEL, 'claude-sonnet-5')
})
