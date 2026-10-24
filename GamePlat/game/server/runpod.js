// OpenAI-compatible RunPod vLLM endpoint. Credentials stay on the game server.
import { deepseekInput } from './deepseek-input.js'
import { AiError } from './ai.js'

function failure(code, message)
{
    return new AiError(code, message)
}

async function input(content)
{
    const converted = await deepseekInput(content)
    if(!Array.isArray(converted))
        return converted
    return converted.map((block) =>
    {
        if(block.type === 'text')
            return { type: 'text', text: block.text }
        if(block.type === 'image' && block.source?.type === 'base64')
            return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } }
        throw failure('ai-no-file', 'RunPod input contains an unsupported attachment')
    })
}

export async function runpodReply({ system, messages, maxTokens, schema = null, signal = null })
{
    const key = process.env.RUNPOD_API_KEY?.trim()
    const base = process.env.RUNPOD_BASE_URL?.trim()
    const model = process.env.RUNPOD_MODEL?.trim()
    if(!key || !base || !model)
        throw failure('ai-auth', 'RunPod requires RUNPOD_API_KEY, RUNPOD_BASE_URL and RUNPOD_MODEL')
    let url
    try { url = new URL(`${base.replace(/\/+$/, '')}/chat/completions`) }
    catch { throw failure('ai-auth', 'RUNPOD_BASE_URL must be an OpenAI-compatible base URL') }
    if(url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && [ 'localhost', '127.0.0.1', '[::1]' ].includes(url.hostname))))
        throw failure('ai-auth', 'RunPod requires HTTPS (HTTP is allowed only for local testing)')
    const timeout = Number(process.env.RUNPOD_TIMEOUT_MS || 240000)
    if(!Number.isInteger(timeout) || timeout < 1 || timeout > 900000)
        throw failure('ai-auth', 'RUNPOD_TIMEOUT_MS must be between 1 and 900000')
    const converted = await Promise.all(messages.map(async (message) => ({ role: message.role, content: await input(message.content) })))
    let response
    try
    {
        response = await fetch(url, {
            method: 'POST',
            redirect: 'error',
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({
                model, stream: false, max_tokens: maxTokens,
                messages: [ { role: 'system', content: system }, ...converted ],
                ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } } : {}),
            }),
            signal: signal ? AbortSignal.any([ signal, AbortSignal.timeout(timeout) ]) : AbortSignal.timeout(timeout),
        })
    }
    catch(error)
    {
        if(signal?.aborted)
            throw error
        throw failure('ai-offline', 'RunPod request failed or timed out')
    }
    if(!response.ok)
    {
        await response.body?.cancel()
        throw failure([ 401, 403 ].includes(response.status) ? 'ai-auth' : [ 429, 503 ].includes(response.status) ? 'ai-busy' : 'ai-error', `RunPod HTTP ${response.status}`)
    }
    let result
    try { result = await response.json() }
    catch { throw failure('ai-error', 'RunPod returned an invalid JSON response') }
    const choice = result?.choices?.[0]
    if(choice?.finish_reason === 'length')
        throw failure('ai-truncated', 'RunPod response reached max_tokens')
    if(choice?.message?.refusal || choice?.finish_reason === 'content_filter')
        throw failure('ai-refused', 'RunPod refused the request')
    if(typeof choice?.message?.content !== 'string' || !choice.message.content.trim())
        throw failure('ai-error', 'RunPod returned no answer')
    return choice.message.content.trim()
}
