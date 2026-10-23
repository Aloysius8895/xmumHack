import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSave, SAVE_VERSION } from './store.js'

test('AWS-loaded legacy saves use the same version migrations and validation as local saves', () =>
{
    const state = normalizeSave({
        version: 3,
        profile: { skills: [], summary: '' },
        logs: [],
        challenges: [],
        friends: [],
        player: { id: 'legacy', name: '' },
    })
    assert.equal(state.version, SAVE_VERSION)
    assert.equal(state.map, null)
    assert.deepEqual(state.careers, {})
    assert.deepEqual(state.customCareers, [])
    assert.deepEqual(state.customSkills, {})
    assert.equal(state.pendingTarget, null)
})

test('AWS-loaded saves newer than the server fail explicitly', () =>
{
    assert.throws(
        () => normalizeSave({ version: SAVE_VERSION + 1 }),
        /newer than this server/,
    )
})
