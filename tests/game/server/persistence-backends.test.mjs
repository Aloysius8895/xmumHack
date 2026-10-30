import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'persistence-backends-'))
const persistence = await import('../../../src/game/server/persistence.js')
const pg = await import('../../../src/game/server/pg-backend.js')

const env = (values) =>
{
    for(const key of [ 'AWS_BACKEND_URL', 'AWS_BACKEND_TOKEN', 'DATABASE_URL' ])
        delete process.env[key]
    Object.assign(process.env, values)
}

test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

test('AWS first, then PostgreSQL, then local files', () =>
{
    env({})
    assert.equal(persistence.backend(), 'file')
    assert.equal(persistence.cloudEnabled(), false)
    env({ DATABASE_URL: 'postgres://example.invalid/db' })
    assert.equal(persistence.backend(), 'postgres')
    assert.equal(persistence.cloudEnabled(), true)
    env({ DATABASE_URL: 'postgres://example.invalid/db', AWS_BACKEND_URL: 'https://example.invalid', AWS_BACKEND_TOKEN: 'token' })
    assert.equal(persistence.backend(), 'aws')
})

test('documents the AWS API does not know go to PostgreSQL, else to local files', () =>
{
    env({ AWS_BACKEND_URL: 'https://example.invalid', AWS_BACKEND_TOKEN: 'token', DATABASE_URL: 'postgres://example.invalid/db' })
    assert.equal(persistence.documentBackend('market'), 'aws')
    assert.equal(persistence.documentBackend('market-window'), 'postgres')
    env({ AWS_BACKEND_URL: 'https://example.invalid', AWS_BACKEND_TOKEN: 'token' })
    assert.equal(persistence.documentBackend('market-window'), 'file')
})

test('with PostgreSQL configured, a database failure is returned, not replaced by the local file', async () =>
{
    env({ DATABASE_URL: 'postgres://example.invalid/db' })
    pg.usePool({ query: async () => { throw new Error('down') }, connect: async () => { throw new Error('down') } })
    await assert.rejects(persistence.loadSave(), { code: 'pg-offline' })
    await assert.rejects(persistence.loadDocument('trends'), { code: 'pg-offline' })
    env({})
})

test('local mode keeps working without any database', async () =>
{
    env({})
    const loaded = await persistence.loadSave()
    assert.equal(loaded.version, 0)
    assert.deepEqual((await persistence.loadDocument('trends')).payload, { months: [] })
})
