import assert from 'node:assert/strict'
import test from 'node:test'
import { migrate } from '../../../src/game/server/scripts/migrate-to-pg.js'

// A database with the pg-backend shapes, in memory
function database()
{
    const saves = new Map(), documents = new Map()
    return {
        saves, documents,
        loadSave: async () => ({ version: saves.get('main')?.version ?? 0, state: saves.get('main')?.state ?? null }),
        commitSave: async ({ state, expectedVersion }) => { assert.equal(expectedVersion, 0); saves.set('main', { version: 1, state }); return { version: 1 } },
        loadDocument: async (id) => ({ version: documents.get(id)?.version ?? 0, payload: documents.get(id)?.payload ?? null }),
        saveDocument: async ({ documentId, payload, expectedVersion }) => { assert.equal(expectedVersion, 0); documents.set(documentId, { version: 1, payload }); return { version: 1 } },
    }
}
const local = { load: () => ({ points: 7 }), loadMarket: () => ({ latest: null }), loadTrends: () => ({ months: [] }) }

test('copies every local item once, then leaves the database untouched', async () =>
{
    const db = database()
    const first = await migrate({ database: db, local, localWindow: () => ({ postings: [ 1 ] }), log: () => {} })
    assert.deepEqual(first, { save: 'copied', market: 'copied', trends: 'copied', 'market-window': 'copied' })
    assert.deepEqual(db.saves.get('main').state, { points: 7 })
    const second = await migrate({ database: db, local: { ...local, load: () => ({ points: 99 }) }, localWindow: () => ({ postings: [] }), log: () => {} })
    assert.deepEqual(second, { save: 'already in database, kept', market: 'already in database, kept', trends: 'already in database, kept', 'market-window': 'already in database, kept' })
    assert.deepEqual(db.saves.get('main').state, { points: 7 }, 'the database copy wins over a later local change')
})

test('missing local data is reported, not written as empty', async () =>
{
    const db = database()
    const report = await migrate({ database: db, local, localWindow: () => null, log: () => {} })
    assert.equal(report['market-window'], 'no local data')
    assert.equal(db.documents.has('market-window'), false)
})
