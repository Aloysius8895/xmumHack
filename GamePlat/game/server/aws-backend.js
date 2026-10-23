/**
 * Server-only client for the authenticated AWS business API.
 * Never import this file into browser code: AWS_BACKEND_TOKEN is a server secret.
 */
const BASE_URL = (process.env.AWS_BACKEND_URL ?? '').replace(/\/+$/, '')
const TOKEN = process.env.AWS_BACKEND_TOKEN ?? ''

export const enabled = Boolean(BASE_URL && TOKEN)

export class AwsBackendError extends Error
{
    constructor(code, status = 502)
    {
        super(code)
        this.name = 'AwsBackendError'
        this.code = code
        this.status = status
    }
}

export async function request(path, { method = 'GET', body, signal } = {})
{
    if(!enabled)
        throw new AwsBackendError('aws-backend-not-configured', 503)

    let response
    try
    {
        response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: {
                authorization: `Bearer ${TOKEN}`,
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: signal ?? AbortSignal.timeout(20_000),
        })
    }
    catch(error)
    {
        if(error?.name === 'AbortError' || error?.name === 'TimeoutError')
            throw new AwsBackendError('aws-backend-timeout', 504)
        throw new AwsBackendError('aws-backend-offline', 502)
    }

    let payload
    try
    {
        payload = await response.json()
    }
    catch
    {
        throw new AwsBackendError('aws-backend-invalid-response', 502)
    }
    if(!response.ok)
        throw new AwsBackendError(payload.error ?? 'aws-backend-error', response.status)
    return payload
}

export async function loadSave(playerId = 'main')
{
    return request(`/v1/game/save?playerId=${encodeURIComponent(playerId)}`)
}

export async function commitSave({ state, expectedVersion, operation = 'save', metadata = {} })
{
    return request('/v1/game/save/commit', {
        method: 'POST',
        body: { playerId: 'main', state, expectedVersion, operation, metadata },
    })
}

export async function loadDocument(documentId)
{
    return request(`/v1/documents/${encodeURIComponent(documentId)}`)
}

export async function saveDocument({ documentId, payload, expectedVersion })
{
    return request('/v1/documents', {
        method: 'PUT',
        body: { documentId, payload, expectedVersion },
    })
}

export async function completeAI({ provider, mode, system, messages, content, schema, maxTokens, signal })
{
    const started = await request('/v1/ai/jobs', {
        method: 'POST',
        body: { provider, mode, system, messages, content, schema, maxTokens },
        signal,
    })
    const deadline = Date.now() + Number(process.env.AWS_AI_MAX_WAIT_MS || 240_000)
    while(Date.now() < deadline)
    {
        if(signal?.aborted)
            throw new AwsBackendError('ai-cancelled', 499)
        await new Promise((resolve, reject) =>
        {
            const timer = setTimeout(resolve, 800)
            const onAbort = () =>
            {
                clearTimeout(timer)
                reject(new AwsBackendError('ai-cancelled', 499))
            }
            signal?.addEventListener('abort', onAbort, { once: true })
            if(signal)
                setTimeout(() => signal.removeEventListener('abort', onAbort), 850)
        })
        const job = await request(`/v1/ai/jobs/${encodeURIComponent(started.jobId)}`, { signal })
        if(job.status === 'succeeded')
            return job
        if(job.status === 'failed')
            throw new AwsBackendError(job.error ?? 'ai-error', 502)
    }
    throw new AwsBackendError('ai-timeout', 504)
}
