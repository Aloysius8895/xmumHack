import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-scenarios-'))
process.env.CRAWLER_DATA_DIR = 'off'
process.env.AI_MOCK = '1'

const sc = await import('../../../src/game/server/scenarios.js')
const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')

test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

const none = { momentum: { skills: {}, careers: {}, basis: {} }, exposure: { skills: {}, source: null } }
const inputs = ({ growth = {}, exposure = {} } = {}) => ({
    momentum: { skills: Object.fromEntries(Object.entries(growth).map(([ id, g ]) => [ id, { growth: g, months: 4, confidence: 'medium', official: [] } ])), careers: {}, basis: { metric: 'share', from: '2026-06', through: '2026-09' } },
    exposure: { skills: Object.fromEntries(Object.entries(exposure).map(([ id, [ a, u ] ]) => [ id, { automation: a, augmentation: u, tasks: [ 'task' ] } ])), source: { name: 'test' } },
})
// Excel mostly replaced, statistics mostly augmented (illustrative test numbers)
const ai = inputs({ exposure: { excel: [ 0.8, 0.1 ], statistics: [ 0.1, 0.8 ], 'data-visualization': [ 0.5, 0.3 ] } })
const career = { id: 'test-career', skills: [ { id: 'excel', level: 2, weight: 2 }, { id: 'statistics', level: 3, weight: 3 }, { id: 'python', level: 2, weight: 1 } ] }
const aina = [ { id: 'excel', level: 2 }, { id: 'statistics', level: 2 }, { id: 'python', level: 1 }, { id: 'communication', level: 2 }, { id: 'data-visualization', level: 1 } ]
const save = (skills = aina, extra = {}) => ({ profile: { skills, summary: '' }, scenario: { preset: 'moderate' }, ...extra })
const { moderate, extreme } = sc.PRESETS

test('adoption grows with speed and horizon; the presets give about 30% and 62%', () =>
{
    assert.ok(sc.adoption(1.6, 3) > sc.adoption(0.6, 3))
    assert.ok(sc.adoption(0.6, 5) > sc.adoption(0.6, 3))
    assert.ok(sc.adoption(3, 5) < 1 && sc.adoption(0.2, 1) > 0)
    assert.equal(Math.round(sc.adoption(moderate.k, moderate.H) * 100), 30)
    assert.equal(Math.round(sc.adoption(extreme.k, extreme.H) * 100), 62)
})

test('faster adoption lowers a replaced skill and raises an augmented one', () =>
{
    assert.ok(sc.skillValue('excel', extreme, ai).value < sc.skillValue('excel', moderate, ai).value)
    assert.ok(sc.skillValue('statistics', extreme, ai).value > sc.skillValue('statistics', moderate, ai).value)
    assert.equal(sc.skillValue('excel', extreme, ai).status, 'declining')
    assert.equal(sc.skillValue('statistics', extreme, ai).status, 'rising')
})

test('change test: one skill\'s demand trend moves the careers that need it, and only those', () =>
{
    const before = sc.forecast(save(), { scenario: 'moderate', ...moderate }, ai)
    const after = sc.forecast(save(), { scenario: 'moderate', ...moderate }, { ...ai, momentum: inputs({ growth: { sql: 0.4 } }).momentum })
    const score = (result, id) => result.careers.find((entry) => entry.careerId === id).score
    assert.notEqual(score(after, 'data-analyst'), score(before, 'data-analyst'), 'data analysts need SQL')
    assert.equal(score(after, 'chef'), score(before, 'chef'), 'chefs do not')
})

test('the two presets give the same profile different scores', () =>
{
    const ranks = sc.compare(save(), ai)
    assert.ok(Object.values(ranks).some((entry) => entry.moderate.score !== entry.extreme.score))
    assert.ok(Object.values(ranks).every((entry) => entry.moderate.rank >= 1 && entry.extreme.rank >= 1))
})

test('the score is the weighted sum of its two parts', () =>
{
    for(const entry of sc.forecast(save(), { scenario: 'extreme', ...extreme }, ai).careers)
        assert.ok(Math.abs(entry.score - 100 * (0.6 * entry.fit + 0.4 * entry.outlook)) <= 1, entry.careerId)
})

test('"what would raise it": learning the top gap adds what was promised', () =>
{
    const result = sc.forecastCareer(career, aina, extreme, ai)
    const top = result.raise[0]
    assert.equal(top.skillId, 'statistics')
    const learned = aina.map((skill) => skill.id === top.skillId ? { ...skill, level: 3 } : skill)
    assert.ok(Math.abs(sc.forecastCareer(career, learned, extreme, ai).score - result.score - top.gain) <= 1)
})

test('no exposure or trend data: neutral values marked as without source, no error', () =>
{
    const value = sc.skillValue('excel', extreme, none)
    assert.equal(value.value, 1)
    assert.deepEqual(value.sources, { demand: null, exposure: null })
    assert.equal(value.confidence, 'low')
    assert.equal(sc.forecastCareer(career, aina, extreme, none).confidence, 'low')
    assert.doesNotThrow(() => sc.forecast(save(), { scenario: 'extreme', ...extreme }, {}))
})

test('a thin profile is flagged and still ranked the same way every time', () =>
{
    const thin = sc.forecast(save([ { id: 'excel', level: 1 } ]), { scenario: 'moderate', ...moderate }, ai)
    assert.ok(thin.careers.every((entry) => entry.thinProfile))
    assert.deepEqual(thin.careers.map((entry) => entry.careerId), sc.forecast(save([ { id: 'excel', level: 1 } ]), { scenario: 'moderate', ...moderate }, ai).careers.map((entry) => entry.careerId))
})

test('fairness: personal attributes are never read', () =>
{
    const plain = sc.forecast(save(), { scenario: 'extreme', ...extreme }, ai)
    const withPersonal = sc.forecast(save(aina, { age: 52, gender: 'female', player: { name: 'Aina' }, profile: { skills: aina, summary: 'Mother of two, 52' } }), { scenario: 'extreme', ...extreme }, ai)
    assert.deepEqual(withPersonal, plain)
})

test('deterministic: the same inputs give the same result', () =>
{
    assert.deepEqual(sc.forecast(save(), { scenario: 'extreme', ...extreme }, ai), sc.forecast(save(), { scenario: 'extreme', ...extreme }, ai))
})

test('scenario of a save: presets, explicit parameters in range, anything else moderate', () =>
{
    assert.equal(sc.scenarioOf({ scenario: { preset: 'extreme' } }).k, 1.6)
    assert.deepEqual(sc.scenarioOf({ scenario: { k: 1.2, H: 5 } }), { scenario: 'custom', k: 1.2, H: 5 })
    assert.equal(sc.scenarioOf({ scenario: { k: 9, H: 2 } }).scenario, 'moderate')
    assert.equal(sc.scenarioOf({}).scenario, 'moderate')
})

async function call(method, route, body = {})
{
    const request = Readable.from(method === 'POST' ? [ Buffer.from(JSON.stringify(body)) ] : [])
    Object.assign(request, { method, url: route, headers: {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('API: switching the scenario is validated and reaches the state', async () =>
{
    store.reset()
    assert.equal((await call('POST', '/api/scenario', { preset: 'storm' })).status, 400)
    assert.equal((await call('POST', '/api/scenario', { k: 5, H: 3 })).status, 400)
    assert.equal((await call('POST', '/api/scenario', { k: 1, H: 2 })).status, 400)
    const fastState = await call('POST', '/api/scenario', { preset: 'extreme' })
    assert.equal(fastState.status, 200)
    assert.equal(fastState.body.state.forecast.scenario, 'extreme')
    assert.equal(fastState.body.state.forecast.estimate, true)
    assert.equal(Object.keys(fastState.body.state.scenarioCompare).length, fastState.body.state.careers.length)
    const custom = await call('POST', '/api/scenario', { k: 1.2, H: 5 })
    assert.deepEqual(custom.body.state.forecast.params, { k: 1.2, H: 5 })
    assert.equal(store.load().scenario.k, 1.2)
    const forecast = await call('GET', '/api/forecast')
    assert.equal(forecast.body.forecast.scenario, 'custom')
})
