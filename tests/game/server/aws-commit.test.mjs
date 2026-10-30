import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// Cloud mode against a stubbed AWS API, before the server modules read the environment
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-aws-commit-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'
process.env.AWS_BACKEND_URL = 'https://aws.example'
process.env.AWS_BACKEND_TOKEN = 'aws-token'

const commits = []
globalThis.fetch = async (url, options = {}) =>
{
    const { pathname } = new URL(url)
    let payload = { error: 'not-found' }
    if(pathname === '/v1/game/save')
        payload = { playerId: 'main', version: 3, state: null }
    if(pathname === '/v1/game/save/commit')
    {
        const body = JSON.parse(options.body)
        commits.push(body)
        payload = { result: body.metadata.result, version: body.expectedVersion + 1 }
    }
    return { ok: !payload.error, status: payload.error ? 404 : 200, json: async () => payload }
}

const { handle } = await import('../../../src/game/server/app.js')
const { SKILL_IDS } = await import('../../../src/game/server/careers.js')

async function call(route, body)
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: { authorization: 'Bearer test-token' } })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('cloud digests send AWS the applied changes, so unknown skills and big deltas behave as locally', async () =>
{
    const result = await call('/api/integrations/digest', {
        date: '2026-10-21',
        summary: 'SQL joins',
        skills: [ { skillId: 'sql', delta: 120 }, { skillId: 'nope', mastery: 90 } ],
    })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.digest.skills.map((item) => [ item.skillId, item.to ]), [ [ 'sql', 100 ] ])

    const commit = commits.at(-1)
    assert.equal(commit.operation, 'digest')
    assert.equal(commit.expectedVersion, 3)
    assert.deepEqual(commit.metadata.digest, {
        date: '2026-10-21',
        summary: 'SQL joins',
        skills: [ { skillId: 'sql', mastery: 100 } ],
        summaryOnly: false,
    })
})

test('summary-only cloud digests carry no skills', async () =>
{
    await call('/api/integrations/digest', { date: '2026-10-22', summaryOnly: true, skills: [ { skillId: 'sql', mastery: 50 } ] })
    assert.deepEqual(commits.at(-1).metadata.digest.skills, [])
    assert.equal(commits.at(-1).metadata.digest.summaryOnly, true)
})

test('the AWS template allows exactly the skill catalog of careers.js', () =>
{
    const template = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/aws/template.yaml'), 'utf8')
    const match = template.match(/CareersphereSkillIds:\s*\n\s*Type: String\s*\n\s*Default: (.+)/)
    assert.ok(match, 'CareersphereSkillIds default not found in aws/template.yaml')
    assert.deepEqual(match[1].trim().split(',').sort(), [ ...SKILL_IDS ].sort())
})
