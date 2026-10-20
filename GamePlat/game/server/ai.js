/**
 * Claude access for every AI feature (see features.js)
 *
 * One request per feature with a JSON schema output (output_config.format), adaptive thinking (always on for
 * Claude Opus 5.5) and server-side refusal fallback. AI_MOCK=1 answers with canned data instead, for demos
 * without an API key.
 */
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5'
export const MOCK = process.env.AI_MOCK === '1'

export class AiError extends Error
{
    constructor(code, message)
    {
        super(message ?? code)
        this.code = code // ai-auth | ai-busy | ai-offline | ai-refused | ai-truncated | ai-error
    }
}

let client = null

function getClient()
{
    // Credentials come from ANTHROPIC_API_KEY (GamePlat/game/.env) or an `ant auth login` profile
    if(!client)
        client = new Anthropic()
    return client
}

export function status()
{
    return { mock: MOCK, model: MODEL, keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }
}

export const LANGUAGES = {
    zh: 'Simplified Chinese',
    en: 'English',
    ms: 'Bahasa Melayu (Malay)',
}

/**
 * Ask for a JSON object matching schema
 * content: string or content blocks (documents/images first, then text)
 */
export async function ask({ system, content, schema, effort = 'medium', maxTokens = 16000 })
{
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
        if(error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
            throw new AiError('ai-auth', error.message)
        if(error instanceof Anthropic.RateLimitError)
            throw new AiError('ai-busy', error.message)
        if(error instanceof Anthropic.APIConnectionError)
            throw new AiError('ai-offline', error.message)
        if(error instanceof Anthropic.APIError)
            throw new AiError('ai-error', `${error.status} ${error.message}`)
        if(error instanceof Error && /credentials|apiKey|authToken/i.test(error.message))
            throw new AiError('ai-auth', error.message)
        throw error
    }

    if(response.stop_reason === 'refusal')
        throw new AiError('ai-refused', response.stop_details?.explanation ?? 'refused')
    if(response.stop_reason === 'max_tokens')
        throw new AiError('ai-truncated', 'response cut by max_tokens')

    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
    try
    {
        return JSON.parse(text)
    }
    catch
    {
        throw new AiError('ai-error', 'response is not valid JSON')
    }
}
