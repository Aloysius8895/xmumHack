import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

const requests = []
const answers = []
const jobs = new Map()
const server = http.createServer((request, response) =>
{
    let raw = ''
    request.on('data', (chunk) => raw += chunk)
    request.on('end', () =>
    {
        if(request.method === 'POST' && request.url === '/v1/ai/jobs')
        {
            const body = JSON.parse(raw)
            requests.push({ method: request.method, headers: request.headers, body })
            const jobId = `job-${jobs.size + 1}`
            jobs.set(jobId, answers.shift())
            response.writeHead(202, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ jobId, status: 'queued' }))
            return
        }
        const jobId = request.url.split('/').at(-1)
        const answer = jobs.get(jobId)
        response.writeHead(answer ? 200 : 404, { 'content-type': 'application/json' })
        response.end(JSON.stringify(answer ? { jobId, status: 'succeeded', ...answer } : { error: 'not-found' }))
    })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

const KEYS = [
    'AI_PROVIDER', 'AWS_BACKEND_URL', 'AWS_BACKEND_TOKEN', 'AWS_AI_MAX_WAIT_MS',
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'DEEPSEEK_API_KEY', 'AI_MOCK',
]
let fresh = 0

async function load(env)
{
    for(const key of KEYS)
        delete process.env[key]
    Object.assign(process.env, env)
    return import(`./ai.js?aws-provider-test=${fresh++}`)
}

const backend = {
    AI_PROVIDER: 'deepseek_direct',
    AWS_BACKEND_URL: `http://127.0.0.1:${server.address().port}`,
    AWS_BACKEND_TOKEN: 'server-only-token',
    ANTHROPIC_API_KEY: 'must-not-be-used',
}
const schema = {
    type: 'object',
    properties: { verdict: { type: 'string', enum: [ 'learned', 'vague' ] }, hours: { type: 'integer' } },
    required: [ 'verdict', 'hours' ],
    additionalProperties: false,
}

test.after(() => server.close())

test('direct provider is explicit and never exposes the official API key to Replit', async () =>
{
    const ai = await load({ AI_PROVIDER: 'deepseek_direct', DEEPSEEK_API_KEY: 'ignored-key' })
    assert.equal(ai.PROVIDER, 'deepseek_direct')
    assert.equal(ai.status().keyConfigured, false)
    await assert.rejects(ai.reply({ system: 's', messages: [{ role: 'user', content: 'Hi' }] }), { code: 'aws-backend-not-configured' })
    assert.equal(requests.length, 0)
})

test('structured output is requested through the AWS backend and validated locally', async () =>
{
    const ai = await load(backend)
    assert.deepEqual(ai.status(), {
        mock: false, provider: 'deepseek_direct', model: 'configured-in-aws', keyConfigured: true,
    })
    answers.push({ value: { verdict: 'learned', hours: '2', extra: 'removed' } })
    assert.deepEqual(await ai.ask({ system: 'Classify.', content: 'Studied SQL for 2h', schema }), {
        verdict: 'learned', hours: 2,
    })
    const sent = requests.at(-1)
    assert.equal(sent.body.provider, 'deepseek_direct')
    assert.equal(sent.body.mode, 'json')
    assert.deepEqual(sent.body.schema, schema)
    assert.equal(sent.headers.authorization, 'Bearer server-only-token')
    assert.equal(sent.headers['x-api-key'], undefined)
    assert.equal(sent.body.DEEPSEEK_API_KEY, undefined)
})

test('invalid structured output gets one corrected attempt', async () =>
{
    const ai = await load(backend)
    answers.push(
        { value: { verdict: 'maybe', hours: 1 } },
        { value: { verdict: 'vague', hours: 0 } },
    )
    assert.deepEqual(await ai.ask({ system: 's', content: 'c', schema }), { verdict: 'vague', hours: 0 })
    assert.equal(requests.at(-1).body.provider, 'deepseek_direct')
    assert.match(requests.at(-1).body.content, /previous result was rejected/)
})

test('plain responses use background jobs; files are refused without a silent provider switch', async () =>
{
    const ai = await load(backend)
    answers.push({ text: 'Start with SQL.' })
    assert.equal(await ai.reply({ system: 's', messages: [{ role: 'user', content: 'Hi' }] }), 'Start with SQL.')
    const before = requests.length
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }
    await assert.rejects(ai.reply({ system: 's', messages: [{ role: 'user', content: [image] }] }), { code: 'ai-no-file' })
    assert.equal(requests.length, before)
})
