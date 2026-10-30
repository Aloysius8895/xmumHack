/**
 * PostgreSQL persistence (Replit Database or any Postgres), same shapes as aws-backend.js.
 * Tables mirror src/aws/lambda/schema.sql (game_saves, app_documents) and are created on first use.
 * Server-only: DATABASE_URL is a secret. Writes use optimistic versions like the AWS API.
 */
export class PgBackendError extends Error
{
    constructor(code, status = 502)
    {
        super(code)
        this.name = 'PgBackendError'
        this.code = code
        this.status = status
    }
}

export function enabled()
{
    return Boolean(process.env.DATABASE_URL)
}

const DOCUMENT_ID = /^[a-z][a-z0-9-]{0,40}$/

// Every statement in one place: the tests answer them by name
export const SQL = {
    schema: `CREATE TABLE IF NOT EXISTS game_saves (
                 player_id text PRIMARY KEY, version bigint NOT NULL DEFAULT 1, state jsonb NOT NULL,
                 updated_at timestamptz NOT NULL DEFAULT now());
             CREATE TABLE IF NOT EXISTS app_documents (
                 document_id text PRIMARY KEY, version bigint NOT NULL DEFAULT 1, payload jsonb NOT NULL,
                 updated_at timestamptz NOT NULL DEFAULT now());`,
    getSave: 'SELECT version, state FROM game_saves WHERE player_id = $1',
    lockSave: 'SELECT version FROM game_saves WHERE player_id = $1 FOR UPDATE',
    insertSave: 'INSERT INTO game_saves (player_id, version, state) VALUES ($1, 1, $2::jsonb) ON CONFLICT (player_id) DO NOTHING',
    updateSave: 'UPDATE game_saves SET version = $2, state = $3::jsonb, updated_at = now() WHERE player_id = $1',
    getDocument: 'SELECT version, payload FROM app_documents WHERE document_id = $1',
    lockDocument: 'SELECT version FROM app_documents WHERE document_id = $1 FOR UPDATE',
    insertDocument: 'INSERT INTO app_documents (document_id, version, payload) VALUES ($1, 1, $2::jsonb) ON CONFLICT (document_id) DO NOTHING',
    updateDocument: 'UPDATE app_documents SET version = $2, payload = $3::jsonb, updated_at = now() WHERE document_id = $1',
}

let pool = null
let ready = null

/** Tests (and scripts) can hand in their own pool: { query(text, params), connect() -> { query, release } } */
export function usePool(custom)
{
    pool = custom
    ready = null
}

async function database()
{
    if(!pool)
    {
        if(!enabled())
            throw new PgBackendError('pg-not-configured', 503)
        const { default: pg } = await import('pg')
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 10_000 })
        pool.on?.('error', () => {})   // idle client errors surface on the next query instead of crashing the server
    }
    ready ??= pool.query(SQL.schema).catch((error) =>
    {
        ready = null
        throw error
    })
    try
    {
        await ready
    }
    catch
    {
        throw new PgBackendError('pg-offline', 502)
    }
    return pool
}

async function read(statement, id)
{
    const db = await database()
    try
    {
        return (await db.query(statement, [ id ])).rows[0] ?? null
    }
    catch
    {
        throw new PgBackendError('pg-offline', 502)
    }
}

/** Versioned write: expectedVersion must match the stored one (0 = not stored yet) */
async function write({ lock, insert, update }, id, value, expectedVersion, conflict)
{
    if(!Number.isInteger(expectedVersion) || expectedVersion < 0)
        throw new PgBackendError('pg-bad-version', 400)
    const db = await database()
    let client
    try
    {
        client = await db.connect()
    }
    catch
    {
        throw new PgBackendError('pg-offline', 502)
    }
    try
    {
        await client.query('BEGIN')
        const current = (await client.query(lock, [ id ])).rows[0]
        const actual = current ? Number(current.version) : 0
        if(actual !== expectedVersion)
            throw new PgBackendError(conflict, 409)
        if(current)
            await client.query(update, [ id, actual + 1, JSON.stringify(value) ])
        else if((await client.query(insert, [ id, JSON.stringify(value) ])).rowCount !== 1)
            throw new PgBackendError(conflict, 409)   // another writer created it first
        await client.query('COMMIT')
        return actual + 1
    }
    catch(error)
    {
        await client.query('ROLLBACK').catch(() => {})
        throw error instanceof PgBackendError ? error : new PgBackendError('pg-offline', 502)
    }
    finally
    {
        client.release()
    }
}

export async function loadSave(playerId = 'main')
{
    const row = await read(SQL.getSave, playerId)
    return { playerId, version: row ? Number(row.version) : 0, state: row?.state ?? null }
}

export async function commitSave({ state, expectedVersion, metadata = {} })
{
    if(!state || typeof state !== 'object' || Array.isArray(state))
        throw new PgBackendError('pg-bad-save', 400)
    const version = await write({ lock: SQL.lockSave, insert: SQL.insertSave, update: SQL.updateSave }, 'main', state, expectedVersion, 'save-version-conflict')
    return { result: metadata.result, version }
}

export async function loadDocument(documentId)
{
    if(!DOCUMENT_ID.test(documentId))
        throw new PgBackendError('pg-bad-document', 400)
    const row = await read(SQL.getDocument, documentId)
    return { documentId, version: row ? Number(row.version) : 0, payload: row?.payload ?? null }
}

export async function saveDocument({ documentId, payload, expectedVersion })
{
    if(!DOCUMENT_ID.test(documentId) || !payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new PgBackendError('pg-bad-document', 400)
    const version = await write({ lock: SQL.lockDocument, insert: SQL.insertDocument, update: SQL.updateDocument }, documentId, payload, expectedVersion, 'document-version-conflict')
    return { version }
}
