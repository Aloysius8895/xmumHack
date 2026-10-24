/**
 * AI access for every AI feature (see features.js). AI_PROVIDER selects a
 * provider explicitly. AWS-backed providers are called only by this server and
 * never expose AWS_BACKEND_TOKEN to the browser.
 *
 * DeepSeek (deepseek): official compatible API, local schema validation and streamed replies.
 * Claude (anthropic): one request per feature with a JSON schema output (output_config.format), adaptive thinking
 * (always on for Claude Opus 5.5) and server-side refusal fallback.
 * Replit AI Integrations (replit): Claude through Replit's proxy (AI_INTEGRATIONS_ANTHROPIC_*), whose model list stops
 * at Claude Opus 5 and whose support of beta features isn't documented, so it takes the plain Messages API path below.
 * Bedrock (bedrock) and optional DeepSeek direct (deepseek_direct) run through
 * the authenticated AWS Lambda API. Failures never fall back to another vendor.
 * AI_MOCK=1 answers with canned data instead, for demos without an API key.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import Anthropic from '@anthropic-ai/sdk'

function pickProvider()
{
    const chosen = (process.env.AI_PROVIDER ?? '').trim().toLowerCase()
    const supported = [ 'runpod', 'deepseek', 'bedrock', 'deepseek_direct', 'replit', 'anthropic' ]
    if(chosen && !supported.includes(chosen))
        throw new Error(`Unknown AI_PROVIDER: ${chosen}`)
    const hasAwsUrl = Boolean(process.env.AWS_BACKEND_URL)
    const hasAwsToken = Boolean(process.env.AWS_BACKEND_TOKEN)
    if(hasAwsUrl !== hasAwsToken)
        throw new Error('AWS_BACKEND_URL and AWS_BACKEND_TOKEN must be configured together')
    if(chosen)
        return chosen
    if(hasAwsUrl)
        return 'bedrock'
    if(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY)
        return 'replit'
    return 'anthropic'
}

export const PROVIDER = pickProvider()
const AWS_PROXY = PROVIDER === 'bedrock' || PROVIDER === 'deepseek_direct'
const REPLIT = PROVIDER === 'replit'
const DEEPSEEK = PROVIDER === 'deepseek'
const COMPATIBLE = REPLIT || DEEPSEEK // Plain Messages API, JSON through a forced tool call
export const MODEL = {
    runpod: process.env.RUNPOD_MODEL || '',
    deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    bedrock: 'configured-in-aws',
    deepseek_direct: 'configured-in-aws',
    replit: process.env.REPLIT_MODEL || 'claude-opus-5', // Most capable Claude in Replit's list
    anthropic: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
}[PROVIDER]
export const MOCK = process.env.AI_MOCK === '1'

// Requests flagged demo: true (the in-game guided tour) get the canned answers too, fast and the same every run
export const demo = new AsyncLocalStorage()

export function isMock()
{
    return MOCK || demo.getStore() === true
}

export class AiError extends Error
{
    constructor(code, message)
    {
        super(message ?? code)
        this.code = code // ai-auth | ai-busy | ai-offline | ai-refused | ai-truncated | ai-no-pdf | ai-error
    }
}

let client = null

function getClient()
{
    if(client)
        return client

    if(AWS_PROXY)
        throw new AiError('ai-auth', 'AWS-backed AI must use the AWS Lambda proxy')
    else if(DEEPSEEK)
    {
        const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
        if(!apiKey)
            throw new AiError('ai-auth', 'DeepSeek selected but DEEPSEEK_API_KEY is not configured')
        client = new Anthropic({ apiKey, authToken: null, baseURL: 'https://api.deepseek.com/anthropic', timeout: 120000, maxRetries: 0 })
    }
    else if(REPLIT)
    {
        // Set by Replit once AI Integrations are enabled for the Repl, both needed (no fallback to other keys)
        if(!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || !process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL)
            throw new AiError('ai-auth', 'Replit AI Integrations are not set up (AI_INTEGRATIONS_ANTHROPIC_API_KEY / _BASE_URL)')
        client = new Anthropic({
            apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
            authToken: null,
            baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
        })
    }
    else
    {
        // Credentials come from ANTHROPIC_API_KEY (src/game/.env) or an `ant auth login` profile
        client = new Anthropic()
    }
    return client
}

export function status()
{
    return {
        mock: MOCK,
        provider: PROVIDER,
        model: MODEL,
        keyConfigured: Boolean(PROVIDER === 'runpod' ? process.env.RUNPOD_API_KEY?.trim() && process.env.RUNPOD_BASE_URL?.trim() && MODEL
            : AWS_PROXY ? process.env.AWS_BACKEND_URL && process.env.AWS_BACKEND_TOKEN
            : DEEPSEEK ? process.env.DEEPSEEK_API_KEY?.trim()
            : REPLIT ? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
            : process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    }
}

export const LANGUAGES = {
    zh: 'Simplified Chinese',
    en: 'English',
    ms: 'Bahasa Melayu (Malay)',
}

// SDK errors as AiError codes the client can explain (missing key, rate limit, offline...)
function classify(error)
{
    if(error instanceof AiError)
        return error
    if(error?.code && error?.name === 'AwsBackendError')
        return new AiError(error.code, error.message)
    if(error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
        return new AiError('ai-auth', error.message)
    if(error instanceof Anthropic.RateLimitError)
        return new AiError('ai-busy', error.message)
    if(error instanceof Anthropic.APIConnectionError)
        return new AiError('ai-offline', error.message)
    if(error instanceof Anthropic.APIError)
        return new AiError('ai-error', `${error.status} ${error.message}`)
    if(error instanceof Error && /credentials|apiKey|authToken/i.test(error.message))
        return new AiError('ai-auth', error.message)
    return error
}

function checkStop(response)
{
    if(response.stop_reason === 'refusal')
        throw new AiError('ai-refused', response.stop_details?.explanation ?? 'refused')
    if(response.stop_reason === 'max_tokens')
        throw new AiError('ai-truncated', 'response cut by max_tokens')
}

function responseText(response)
{
    checkStop(response)
    return response.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
}

function awsText(value)
{
    if(typeof value === 'string')
        return value
    if(Array.isArray(value) && value.every((block) => block?.type === 'text' && typeof block.text === 'string'))
        return value.map((block) => block.text).join('\n')
    throw new AiError('ai-no-file', 'AWS AI currently accepts text-only inputs')
}

/**
 * The value against the subset of JSON schema the features use (object, array, string, integer, number, boolean,
 * enum, required, additionalProperties: false). Fixes what is safe to fix in place (numbers sent as strings, extra
 * keys dropped) and returns the first real problem, or null when it matches. Containers here, scalars in conformSlot.
 */
function conform(value, schema, path)
{
    if(schema.type === 'object')
    {
        if(!value || typeof value !== 'object' || Array.isArray(value))
            return `${path} must be an object`
        for(const key of schema.required ?? [])
            if(!(key in value))
                return `${path}.${key} is missing`
        for(const key of Object.keys(value))
        {
            if(!schema.properties?.[key])
            {
                if(schema.additionalProperties === false)
                    delete value[key]
                continue
            }
            const problem = conformSlot(value, key, schema.properties[key], `${path}.${key}`)
            if(problem)
                return problem
        }
        return null
    }
    if(schema.type === 'array')
    {
        if(!Array.isArray(value))
            return `${path} must be an array`
        for(let i = 0; i < value.length; i++)
        {
            const problem = conformSlot(value, i, schema.items, `${path}[${i}]`)
            if(problem)
                return problem
        }
        return null
    }
    return null
}

// One slot of a container (scalars are fixed through it: a string "3" becomes 3), then its own content
export function conformSlot(container, key, schema, path)
{
    let value = container[key]
    if((schema.type === 'integer' || schema.type === 'number') && typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)))
        value = container[key] = Number(value)
    if(schema.type === 'integer' && !Number.isInteger(value))
        return `${path} must be an integer`
    if(schema.type === 'number' && typeof value !== 'number')
        return `${path} must be a number`
    if(schema.type === 'string' && typeof value !== 'string')
        return `${path} must be a string`
    if(schema.type === 'boolean' && typeof value !== 'boolean')
        return `${path} must be true or false`
    if(schema.enum && !schema.enum.includes(value))
        return `${path} must be one of ${schema.enum.slice(0, 40).join(', ')}`
    return conform(value, schema, path)
}

/**
 * Plain text reply to a conversation (messages: [ { role: 'user' | 'assistant', content } ], ends with the user)
 * onText(delta): local providers stream pieces; the AWS job backend emits its completed answer once.
 * signal: AbortSignal that cancels the call (player left the dialogue)
 */
export async function reply({ system, messages, effort = 'low', maxTokens = 2000, onText = null, signal = null })
{
    if(PROVIDER === 'runpod')
    {
        const { runpodReply } = await import('../../../runpod/provider.js')
        const text = await runpodReply({ system, messages, maxTokens, signal })
        if(onText)
            onText(text)
        return text
    }
    if(DEEPSEEK)
    {
        const { deepseekInput } = await import('./deepseek-input.js')
        messages = await Promise.all(messages.map(async (message) => ({ ...message, content: await deepseekInput(message.content) })))
    }
    if(AWS_PROXY)
    {
        try
        {
            const { completeAI } = await import('./aws-backend.js')
            const response = await completeAI({
                provider: PROVIDER,
                mode: 'text',
                system,
                messages: messages.map((message) => ({ role: message.role, content: awsText(message.content) })),
                maxTokens,
                signal,
            })
            if(onText)
                onText(response.text)
            return response.text
        }
        catch(error)
        {
            throw classify(error)
        }
    }

    let params
    if(COMPATIBLE)
    {
        params = { model: MODEL, max_tokens: maxTokens, system, messages, thinking: { type: 'disabled' } }
    }
    else
    {
        params = {
            model: MODEL,
            max_tokens: maxTokens,
            betas: [ 'server-side-fallback-2026-07-01' ],
            fallbacks: 'default',
            system,
            messages,
            output_config: { effort },
        }
    }

    let response
    try
    {
        const messagesApi = COMPATIBLE ? getClient().messages : getClient().beta.messages
        if(onText)
        {
            const stream = messagesApi.stream(params, { signal: signal ?? undefined })
            stream.on('text', (delta) => onText(delta))
            response = await stream.finalMessage()
        }
        else
        {
            response = await messagesApi.create(params, { signal: signal ?? undefined })
        }
    }
    catch(error)
    {
        throw classify(error)
    }
    return responseText(response).trim()
}

/**
 * Ask for a JSON object matching schema
 * content: string or content blocks (documents/images first, then text)
 */
export async function ask({ system, content, schema, effort = 'medium', maxTokens = 16000 })
{
    if(PROVIDER === 'runpod')
    {
        const { runpodReply } = await import('../../../runpod/provider.js')
        let problem = 'invalid JSON'
        const messages = [ { role: 'user', content } ]
        for(let attempt = 0; attempt < 2; attempt++)
        {
            const text = await runpodReply({ system, messages, schema, maxTokens })
            let holder
            try { holder = { result: JSON.parse(text) } }
            catch { problem = 'invalid JSON' }
            if(holder)
            {
                problem = conformSlot(holder, 'result', schema, 'result')
                if(!problem)
                    return holder.result
            }
            messages.push({ role: 'assistant', content: text }, { role: 'user', content: `Correct the result: ${problem}. Return only JSON matching the schema.` })
        }
        throw new AiError('ai-error', `structured output rejected: ${problem}`)
    }
    if(DEEPSEEK)
    {
        const { deepseekInput } = await import('./deepseek-input.js')
        content = await deepseekInput(content)
    }
    if(AWS_PROXY)
        return askWithAws({ system, content, schema, maxTokens })
    if(COMPATIBLE)
        return askWithTool({ system, content, schema, maxTokens })

    let response
    try
    {
        response = await getClient().beta.messages.create({
            model: MODEL,
            max_tokens: maxTokens,
            betas: [ 'server-side-fallback-2026-07-01' ],
            fallbacks: 'default',
            system,
            messages: [ { role: 'user', content } ],
            output_config: {
                effort,
                format: { type: 'json_schema', schema },
            },
        })
    }
    catch(error)
    {
        throw classify(error)
    }

    const text = responseText(response)
    try
    {
        return JSON.parse(text)
    }
    catch
    {
        throw new AiError('ai-error', 'response is not valid JSON')
    }
}

async function askWithAws({ system, content, schema, maxTokens })
{
    const prompt = awsText(content)
    let lastProblem = 'no structured result'
    for(let attempt = 0; attempt < 2; attempt++)
    {
        try
        {
            const { completeAI } = await import('./aws-backend.js')
            const response = await completeAI({
                provider: PROVIDER,
                mode: 'json',
                system: `${system}\n\nReturn one result that matches the supplied schema.`,
                content: attempt === 0 ? prompt : `${prompt}\n\nThe previous result was rejected: ${lastProblem}. Return a corrected result.`,
                schema,
                maxTokens,
            })
            const holder = { result: response.value }
            lastProblem = conformSlot(holder, 'result', schema, 'result')
            if(!lastProblem)
                return holder.result
        }
        catch(error)
        {
            throw classify(error)
        }
    }
    throw new AiError('ai-error', `structured output rejected: ${lastProblem}`)
}

/**
 * DeepSeek and Replit: the schema as the input of a tool the model must call (strict on Claude, which then keeps to it),
 * the call checked here; a wrong result is sent back once with what is wrong so it can correct it
 */
const SUBMIT = 'submit_result'

async function askWithTool({ system, content, schema, maxTokens })
{
    const messages = [ { role: 'user', content } ]
    let problem = null
    try
    {
        for(let attempt = 0; attempt < 2; attempt++)
        {
            const response = await getClient().messages.create({
                model: MODEL,
                max_tokens: maxTokens,
                system: `${system}\n\nGive your answer by calling the ${SUBMIT} tool once, with every field its schema requires.`,
                messages,
                tools: [ { name: SUBMIT, description: 'Submit the complete result of the task.', input_schema: schema, ...(REPLIT ? { strict: true } : {}) } ],
                tool_choice: { type: 'tool', name: SUBMIT },
                thinking: { type: 'disabled' },
            })
            checkStop(response)

            const call = response.content.find((block) => block.type === 'tool_use' && block.name === SUBMIT)
            if(!call)
            {
                problem = 'no tool call'
                continue
            }
            const holder = { result: call.input }
            problem = conformSlot(holder, 'result', schema, 'result')
            if(!problem)
                return holder.result

            messages.push(
                { role: 'assistant', content: response.content },
                { role: 'user', content: [ { type: 'tool_result', tool_use_id: call.id, content: `Not accepted: ${problem}. Call ${SUBMIT} again with the corrected, complete result.` } ] },
            )
        }
    }
    catch(error)
    {
        throw classify(error)
    }
    throw new AiError('ai-error', `structured output rejected: ${problem}`)
}
