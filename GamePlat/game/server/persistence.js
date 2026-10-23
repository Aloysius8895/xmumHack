/**
 * Persistence boundary used by the game API.
 * Local JSON remains available for development; configured AWS is the sole
 * source of truth and failures are returned rather than silently downgraded.
 */
import * as aws from './aws-backend.js'
import * as store from './store.js'

export function cloudEnabled()
{
    return aws.enabled()
}

export async function loadSave()
{
    if(!cloudEnabled())
        return { state: store.load(), version: 0 }
    const saved = await aws.loadSave()
    return {
        state: saved.state === null ? store.createSave() : store.normalizeSave(saved.state),
        version: saved.version,
    }
}

export async function commitSave(state, expectedVersion, operation = 'save', metadata = {})
{
    if(!cloudEnabled())
    {
        store.save(state)
        return { result: metadata.result ?? {}, version: expectedVersion + 1 }
    }
    return aws.commitSave({ state, expectedVersion, operation, metadata })
}

const defaults = {
    market: { latest: null, previous: null, history: [] },
    trends: { months: [] },
}

export async function loadDocument(documentId)
{
    if(!cloudEnabled())
        return { payload: documentId === 'market' ? store.loadMarket() : store.loadTrends(), version: 0 }
    const result = await aws.loadDocument(documentId)
    return { payload: result.payload ?? structuredClone(defaults[documentId]), version: result.version }
}

export async function saveDocument(documentId, payload, expectedVersion)
{
    if(!cloudEnabled())
    {
        if(documentId === 'market')
            store.saveMarket(payload)
        else
            store.saveTrends(payload)
        return { version: expectedVersion + 1 }
    }
    return aws.saveDocument({ documentId, payload, expectedVersion })
}
