/**
 * AI access for every AI feature (see features.js). Provider, unless AI_PROVIDER names one:
 * DEEPSEEK_API_KEY set > DeepSeek, otherwise Replit AI Integrations if Replit provisioned them, otherwise Claude
 * with your own ANTHROPIC_API_KEY.
 *
 * Claude (anthropic): one request per feature with a JSON schema output (output_config.format), adaptive thinking
 * (always on for Claude Opus 5.5) and server-side refusal fallback.
 * Replit AI Integrations (replit): Claude through Replit's proxy (AI_INTEGRATIONS_ANTHROPIC_*), whose model list stops
 * at Claude Opus 5 and whose support of beta features isn't documented, so it takes the plain Messages API path below.
 * DeepSeek (deepseek): its Anthropic-compatible endpoint (https://api.deepseek.com/anthropic), no schema output, no PDF.
 * Both: the JSON comes from a forced tool call (thinking off) checked against the schema here, with one corrected
 * retry; on DeepSeek a PDF is refused with ai-no-pdf (images and text files work).
 * AI_MOCK=1 answers with canned data instead, for demos without an API key.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import Anthropic from '@anthropic-ai/sdk'

function pickProvider()
{
    const chosen = (process.env.AI_PROVIDER ?? '').trim().toLowerCase()
    if([ 'deepseek', 'replit', 'anthropic' ].includes(chosen))
        return chosen
    if(process.env.DEEPSEEK_API_KEY)
        return 'deepseek'
    if(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY)
        return 'replit'
    return 'anthropic'
}

export const PROVIDER = pickProvider()
const DEEPSEEK = PROVIDER === 'deepseek'
const REPLIT = PROVIDER === 'replit'
const COMPATIBLE = DEEPSEEK || REPLIT // Plain Messages API, JSON through a forced tool call
export const MODEL = {
    deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
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

    if(DEEPSEEK)
    {
        // Its own key only: without it the SDK would fall back to ANTHROPIC_API_KEY and send the Claude key to DeepSeek
        if(!process.env.DEEPSEEK_API_KEY)
            throw new AiError('ai-auth', 'DEEPSEEK_API_KEY is not set')
        client = new Anthropic({
            apiKey: process.env.DEEPSEEK_API_KEY,
            authToken: null,
            baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/anthropic',
        })
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
        // Credentials come from ANTHROPIC_API_KEY (GamePlat/game/.env) or an `ant auth login` profile
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
        keyConfigured: Boolean(DEEPSEEK ? process.env.DEEPSEEK_API_KEY
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

// DeepSeek reads text and images, not documents: a PDF is refused up front with a clear code (Claude reads them)
function checkContent(messages)
{
    if(!DEEPSEEK)
        return
    for(const message of messages)
        if(Array.isArray(message.content) && message.content.some((block) => block.type === 'document'))
            throw new AiError('ai-no-pdf', `${MODEL} cannot read PDF files`)
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
 */
export async function reply({ system, messages, effort = 'low', maxTokens = 2000 })
{
    let response
    try
    {
        if(COMPATIBLE)
        {
            checkContent(messages)
            response = await getClient().messages.create({ model: MODEL, max_tokens: maxTokens, system, messages, thinking: { type: 'disabled' } })
        }
        else
        {
            response = await getClient().beta.messages.create({
                model: MODEL,
                max_tokens: maxTokens,
                betas: [ 'server-side-fallback-2026-07-01' ],
                fallbacks: 'default',
                system,
                messages,
                output_config: { effort },
            })
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
        checkContent(messages)
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
