import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { validateStorage } from '../../../src/game/server/storage-config.js'

test('paid file storage requires its configured mounted directory', () =>
{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-storage-'))
    const env = { REQUIRE_PERSISTENT_STORAGE: '1', PERSISTENT_DATA_DIR: root, SAVE_DIR: path.join(root, 'game') }
    assert.doesNotThrow(() => validateStorage('file', env))
    assert.throws(() => validateStorage('file', { ...env, SAVE_DIR: `${root}-other` }), /mounted/)
    assert.throws(() => validateStorage('file', { ...env, SAVE_DIR: '' }), /mounted/)
    assert.doesNotThrow(() => validateStorage('postgres', env))
    assert.doesNotThrow(() => validateStorage('file', {}))
})
