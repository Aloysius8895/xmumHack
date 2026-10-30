import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-register-'))
process.env.AI_MOCK = '1'

const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')

async function call(route, body = {})
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('a username seen for the first time is a new user, the same name again (any case) is not', async () =>
{
    store.reset()
    const first = await call('/api/register', { name: '  Ali   Baba ' })
    assert.equal(first.status, 200)
    assert.equal(first.body.newUser, true)
    assert.equal(first.body.state.player.name, 'Ali Baba')

    assert.equal((await call('/api/register', { name: 'ali baba' })).body.newUser, false)
    assert.equal((await call('/api/register', { name: 'Mei' })).body.newUser, true)
    assert.equal((await call('/api/register', { name: 'Ali Baba' })).body.newUser, false)
    assert.deepEqual(store.load().users.map((user) => user.name), [ 'Ali Baba', 'Mei' ])
})

test('an empty username is refused', async () =>
{
    store.reset()
    assert.equal((await call('/api/register', { name: '   ' })).body.error, 'empty-name')
})

test('a save from before usernames counts its leaderboard name as an existing user', () =>
{
    const save = store.normalizeSave({ ...store.createSave(), version: 4, users: undefined, player: { id: 'abc', name: 'Old Player' } })
    assert.deepEqual(save.users, [ { name: 'Old Player', registeredAt: null } ])
    assert.deepEqual(store.normalizeSave({ ...store.createSave(), version: 4, users: undefined }).users, [])
})
