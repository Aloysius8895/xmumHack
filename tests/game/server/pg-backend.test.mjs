import assert from 'node:assert/strict'
import test from 'node:test'
import * as pg from '../../../src/game/server/pg-backend.js'

// In-memory stand-in for a pg Pool: answers pg-backend's statements by name, rows keyed by id
function fakePool({ offline = false } = {})
{
    const tables = { saves: new Map(), documents: new Map() }
    const log = []
    const byText = Object.fromEntries(Object.entries(pg.SQL).map(([ name, text ]) => [ text, name ]))
    const run = async (text, params = []) =>
    {
        if(offline)
            throw new Error('connection refused')
        const name = byText[text] ?? text
        log.push(name)
        const table = /Save/i.test(name) ? tables.saves : tables.documents
        const [ id, a, b ] = params
        switch(name)
        {
            case 'schema': case 'BEGIN': case 'COMMIT': case 'ROLLBACK': return { rows: [], rowCount: 0 }
            case 'getSave': { const row = table.get(id); return { rows: row ? [ { version: String(row.version), state: row.value } ] : [] } }
            case 'getDocument': { const row = table.get(id); return { rows: row ? [ { version: String(row.version), payload: row.value } ] : [] } }
            case 'lockSave': case 'lockDocument': { const row = table.get(id); return { rows: row ? [ { version: String(row.version) } ] : [] } }
            case 'insertSave': case 'insertDocument':
                if(table.has(id)) return { rows: [], rowCount: 0 }
                table.set(id, { version: 1, value: JSON.parse(a) })
                return { rows: [], rowCount: 1 }
            case 'updateSave': case 'updateDocument':
                table.set(id, { version: a, value: JSON.parse(b) })
                return { rows: [], rowCount: 1 }
            default: throw new Error(`unexpected statement ${name}`)
        }
    }
    return { tables, log, query: run, connect: async () => ({ query: run, release() {} }) }
}

test('enabled only with DATABASE_URL', () =>
{
    const before = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    assert.equal(pg.enabled(), false)
    process.env.DATABASE_URL = 'postgres://example.invalid/db'
    assert.equal(pg.enabled(), true)
    if(before === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = before
})

test('creates the tables once, then reads an empty save as version 0', async () =>
{
    const pool = fakePool()
    pg.usePool(pool)
    assert.deepEqual(await pg.loadSave(), { playerId: 'main', version: 0, state: null })
    await pg.loadSave()
    assert.equal(pool.log.filter((name) => name === 'schema').length, 1)
})

test('saves with optimistic versions and rejects a stale writer', async () =>
{
    pg.usePool(fakePool())
    const first = await pg.commitSave({ state: { points: 1 }, expectedVersion: 0, metadata: { result: { ok: true } } })
    assert.deepEqual(first, { result: { ok: true }, version: 1 })
    assert.equal((await pg.commitSave({ state: { points: 2 }, expectedVersion: 1 })).version, 2)
    await assert.rejects(pg.commitSave({ state: { points: 3 }, expectedVersion: 1 }), { code: 'save-version-conflict', status: 409 })
    assert.deepEqual(await pg.loadSave(), { playerId: 'main', version: 2, state: { points: 2 } })
})

test('a second creator of the same row loses with a conflict', async () =>
{
    const pool = fakePool()
    pg.usePool(pool)
    pool.tables.documents.set('market-window', { version: 1, value: { a: 1 } })
    // A writer that read "not stored yet" before the other one inserted
    const realConnect = pool.connect
    pool.connect = async () =>
    {
        const client = await realConnect()
        return { ...client, query: async (text, params) => text === pg.SQL.lockDocument ? { rows: [] } : client.query(text, params) }
    }
    await assert.rejects(pg.saveDocument({ documentId: 'market-window', payload: { b: 2 }, expectedVersion: 0 }), { code: 'document-version-conflict' })
    assert.deepEqual(pool.tables.documents.get('market-window').value, { a: 1 })
})

test('documents round-trip and ids are validated', async () =>
{
    pg.usePool(fakePool())
    assert.deepEqual(await pg.loadDocument('market-window'), { documentId: 'market-window', version: 0, payload: null })
    assert.deepEqual(await pg.saveDocument({ documentId: 'market-window', payload: { months: [] }, expectedVersion: 0 }), { version: 1 })
    assert.deepEqual((await pg.loadDocument('market-window')).payload, { months: [] })
    await assert.rejects(pg.loadDocument('../etc'), { code: 'pg-bad-document' })
    await assert.rejects(pg.saveDocument({ documentId: 'x', payload: [], expectedVersion: 0 }), { code: 'pg-bad-document' })
    await assert.rejects(pg.saveDocument({ documentId: 'x', payload: {}, expectedVersion: -1 }), { code: 'pg-bad-version' })
})

test('an unreachable database is an explicit error, never a silent fallback', async () =>
{
    pg.usePool(fakePool({ offline: true }))
    await assert.rejects(pg.loadSave(), { code: 'pg-offline', status: 502 })
    await assert.rejects(pg.commitSave({ state: {}, expectedVersion: 0 }), { code: 'pg-offline' })
})
