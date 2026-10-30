/** Run from src/game: node scripts/check-deepseek.mjs. Sends synthetic text only. */
import 'dotenv/config'
import assert from 'node:assert/strict'

try
{
    const ai = await import('../server/ai.js')
    const status = ai.status()
    console.log(JSON.stringify(status))
    assert.equal(status.provider, 'deepseek')
    assert.equal(status.mock, false)
    assert.equal(status.keyConfigured, true)
    const value = await ai.ask({
        system: 'Return the requested value using the provided tool.',
        content: 'Set ready to true.',
        schema: { type: 'object', properties: { ready: { type: 'boolean' } }, required: [ 'ready' ], additionalProperties: false },
        maxTokens: 128,
    })
    assert.equal(value.ready, true)
    let chunks = 0
    const answer = await ai.reply({ system: 'Reply with the word READY only.', messages: [ { role: 'user', content: 'Connection check.' } ], maxTokens: 64, onText: () => chunks++ })
    assert.ok(chunks > 0)
    assert.match(answer, /READY/)
    console.log(JSON.stringify({ structured: 'passed', streaming: 'passed', chunks }))
}
catch(error)
{
    // Do not print API responses, request headers or credential-bearing SDK objects.
    console.error(`DeepSeek check failed: ${error.code ?? error.status ?? error.name}`)
    process.exitCode = 1
}
