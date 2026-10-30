/**
 * Persistence boundary used by the game API.
 * Order: configured AWS, then PostgreSQL (DATABASE_URL, e.g. Replit Database), then local JSON for development.
 * A configured backend is the sole source of truth and failures are returned rather than silently downgraded.
 */
import * as aws from './aws-backend.js'
import * as pg from './pg-backend.js'
import * as store from './store.js'

// The AWS business API only knows these documents (src/aws/lambda/app.py)
const AWS_DOCUMENTS = new Set([ 'market', 'trends' ])

export function backend()
{
    return aws.enabled() ? 'aws' : pg.enabled() ? 'postgres' : 'file'
}

export function cloudEnabled()
{
    return backend() !== 'file'
}

export async function loadSave()
{
    const remote = { aws, postgres: pg }[backend()]
    if(!remote)
        return { state: store.load(), version: 0 }
    const saved = await remote.loadSave()
    return {
        state: saved.state === null ? store.createSave() : store.normalizeSave(saved.state),
        version: saved.version,
    }
}

export async function commitSave(state, expectedVersion, operation = 'save', metadata = {})
{
    const remote = { aws, postgres: pg }[backend()]
    if(!remote)
    {
        store.save(state)
        return { result: metadata.result ?? {}, version: expectedVersion + 1 }
    }
    return remote.commitSave({ state, expectedVersion, operation, metadata })
}

const defaults = {
    market: { latest: null, previous: null, history: [] },
    trends: { months: [] },
}

/** Where a document lives: AWS only for the documents its API knows, then PostgreSQL, then local files */
export function documentBackend(documentId)
{
    const chosen = backend()
    if(chosen === 'aws' && !AWS_DOCUMENTS.has(documentId))
        return pg.enabled() ? 'postgres' : 'file'
    return chosen
}

export async function loadDocument(documentId)
{
    const where = documentBackend(documentId)
    if(where === 'file')
    {
        if(!(documentId in defaults))
            throw new Error(`no local file for document ${documentId}`)
        return { payload: documentId === 'market' ? store.loadMarket() : store.loadTrends(), version: 0 }
    }
    const result = await (where === 'aws' ? aws : pg).loadDocument(documentId)
    return { payload: result.payload ?? structuredClone(defaults[documentId] ?? null), version: result.version }
}

export async function saveDocument(documentId, payload, expectedVersion)
{
    const where = documentBackend(documentId)
    if(where === 'file')
    {
        if(documentId === 'market')
            store.saveMarket(payload)
        else if(documentId === 'trends')
            store.saveTrends(payload)
        else
            throw new Error(`no local file for document ${documentId}`)
        return { version: expectedVersion + 1 }
    }
    return (where === 'aws' ? aws : pg).saveDocument({ documentId, payload, expectedVersion })
}
