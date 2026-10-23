import assert from 'node:assert/strict'
import test from 'node:test'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const requests = []
const answers = []
let fresh = 0
const schema = { type: 'object', properties: { hours: { type: 'integer' } }, required: [ 'hours' ], additionalProperties: false }

async function load(extra = {})
{
    for(const key of [ 'AI_PROVIDER', 'AWS_BACKEND_URL', 'AWS_BACKEND_TOKEN', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'AI_MOCK' ])
        delete process.env[key]
    Object.assign(process.env, { AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'deepseek-test-key', ANTHROPIC_API_KEY: 'wrong-key', ANTHROPIC_AUTH_TOKEN: 'wrong-token', ANTHROPIC_BASE_URL: 'https://wrong.example', ...extra })
    globalThis.fetch = async (url, options) =>
    {
        requests.push({ url: String(url), headers: new Headers(options.headers), body: JSON.parse(options.body), signal: options.signal })
        const answer = answers.shift()
        assert.ok(answer, 'unexpected API request')
        return typeof answer === 'function' ? answer(options) : new Response(JSON.stringify(answer.body ?? { id: 'msg', type: 'message', role: 'assistant', model: 'deepseek-flash', stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 }, content: answer }), { status: answer.status ?? 200, headers: { 'content-type': 'application/json' } })
    }
    return import(`./ai.js?deepseek-local=${fresh++}`)
}

const tool = (input) => [ { type: 'tool_use', id: 'call-1', name: 'submit_result', input } ]
test.after(() => { globalThis.fetch = originalFetch; process.env = originalEnv })

test('DeepSeek uses only its key and official endpoint; structured output is validated and corrected', async () =>
{
    const ai = await load()
    assert.deepEqual(ai.status(), { provider: 'deepseek', model: 'deepseek-flash', mock: false, keyConfigured: true })
    answers.push(tool({ hours: 'invalid' }), tool({ hours: '2', extra: 'drop' }))
    assert.deepEqual(await ai.ask({ system: 'Classify learning', content: 'Practised SQL for 2h', schema }), { hours: 2 })
    const sent = requests.at(-1)
    assert.equal(sent.url, 'https://api.deepseek.com/anthropic/v1/messages')
    assert.equal(sent.headers.get('x-api-key'), 'deepseek-test-key')
    assert.equal(sent.headers.get('authorization'), null)
    assert.equal(sent.body.model, 'deepseek-flash')
    assert.equal(sent.body.tools[0].strict, undefined)
    assert.equal(sent.body.output_config, undefined)
    assert.equal(sent.body.fallbacks, undefined)
    assert.deepEqual(sent.body.thinking, { type: 'disabled' })
    assert.match(JSON.stringify(sent.body.messages), /Not accepted/)
})

test('DeepSeek key is required and never falls back to configured Claude credentials', async () =>
{
    const ai = await load({ DEEPSEEK_API_KEY: '' })
    const before = requests.length
    assert.equal(ai.status().keyConfigured, false)
    await assert.rejects(ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ] }), { code: 'ai-auth' })
    assert.equal(requests.length, before)
})

test('DeepSeek image input survives and custom model is respected', async () =>
{
    const ai = await load({ DEEPSEEK_MODEL: 'deepseek-flash' })
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } }
    answers.push(tool({ hours: 1 }))
    await ai.ask({ system: 's', content: [ image, { type: 'text', text: 'Read screenshot' } ], schema })
    assert.deepEqual(requests.at(-1).body.messages[0].content[0], image)
})

test('DeepSeek refuses invalid PDFs before calling a model', async () =>
{
    const ai = await load()
    const before = requests.length
    await assert.rejects(ai.ask({ system: 's', content: [ { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from('invalid pdf').toString('base64') } } ], schema }), { code: 'ai-no-pdf' })
    assert.equal(requests.length, before)
})

test('authentication and rate-limit errors retain actionable game error codes', async () =>
{
    const ai = await load()
    answers.push({ status: 401, body: { error: { type: 'authentication_error', message: 'invalid key' } } })
    await assert.rejects(ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ] }), { code: 'ai-auth' })
    answers.push({ status: 429, body: { error: { type: 'rate_limit_error', message: 'busy' } } })
    await assert.rejects(ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ] }), { code: 'ai-busy' })
})

test('missing tool calls retry once and then fail', async () =>
{
    const ai = await load()
    answers.push([ { type: 'text', text: 'No tool' } ], [ { type: 'text', text: 'Still no tool' } ])
    await assert.rejects(ai.ask({ system: 's', content: 'c', schema }), { code: 'ai-error' })
})

function pdf(text = '')
{
    const stream = text ? `BT /F1 12 Tf 40 700 Td (${text}) Tj ET` : ''
    const objects = [ '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream` ]
    let data = '%PDF-1.4\n'
    const offsets = [ 0 ]
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${object}\nendobj\n` })
    const xref = Buffer.byteLength(data)
    data += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(data).toString('base64') } }
}

test('text PDFs become readable text for both structured tasks and mentor conversations', async () =>
{
    const ai = await load()
    answers.push(tool({ hours: 2 }))
    await ai.ask({ system: 's', content: [ pdf('SQL Python CV'), { type: 'text', text: 'Extract skills' } ], schema })
    assert.match(requests.at(-1).body.messages[0].content[0].text, /SQL Python CV/)
    assert.equal(requests.at(-1).body.messages[0].content[0].type, 'text')
    answers.push([ { type: 'text', text: 'Practise SQL.' } ])
    assert.equal(await ai.reply({ system: 's', messages: [ { role: 'user', content: [ pdf('SQL question') ] } ] }), 'Practise SQL.')
    const before = requests.length
    await assert.rejects(ai.ask({ system: 's', content: [ pdf() ], schema }), { code: 'ai-no-pdf' })
    assert.equal(requests.length, before)
})

function sse(events)
{
    return new Response(events.map(([ event, data ]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })
}

test('DeepSeek streams answer text and passes cancellation through to the SDK', async () =>
{
    const ai = await load()
    answers.push(() => sse([
        [ 'message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [], model: 'deepseek-flash', usage: { input_tokens: 1, output_tokens: 0 }, stop_reason: null, stop_sequence: null } } ],
        [ 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } ],
        [ 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Learn SQL.' } } ],
        [ 'content_block_stop', { type: 'content_block_stop', index: 0 } ],
        [ 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3 } } ],
        [ 'message_stop', { type: 'message_stop' } ],
    ]))
    const pieces = []
    assert.equal(await ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ], onText: (delta) => pieces.push(delta) }), 'Learn SQL.')
    assert.deepEqual(pieces, [ 'Learn SQL.' ])
    assert.equal(requests.at(-1).body.stream, true)
    const aborter = new AbortController()
    answers.push((options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })))
    const pending = ai.reply({ system: 's', messages: [ { role: 'user', content: 'Hi' } ], onText() {}, signal: aborter.signal })
    setTimeout(() => aborter.abort(), 20)
    await assert.rejects(pending, /abort/i)
    assert.equal(requests.at(-1).signal.aborted, true)
})
