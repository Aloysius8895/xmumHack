import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-language-'))
process.env.AI_MOCK = '1'
delete process.env.AWS_BACKEND_URL
delete process.env.AWS_BACKEND_TOKEN
const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const features = await import('../../../src/game/server/features.js')

async function call(method, url, body, language)
{
    const request = Readable.from(body ? [ Buffer.from(JSON.stringify(body)) ] : [])
    Object.assign(request, { method, url, headers: language ? { 'x-career-lang': language } : {} })
    let payload
    const response = { setHeader() {}, end(value) { payload = JSON.parse(value) } }
    await handle(request, response)
    return { status: response.statusCode, ...payload }
}

async function learner()
{
    const save = store.createSave()
    game.setTarget(save, { careerId: 'ml-engineer', mode: 'general' })
    save.roadmap = game.buildRoadmap(await features.generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: 'zh' }))
    save.roadmap.stages[0].tasks[0].progress = 40
    save.points = 27
    store.save(save)
    return save
}

test('English startup localizes an existing Chinese-preference save without changing progress', async () =>
{
    const original = await learner()
    const result = await call('GET', '/api/state', null, 'en')
    assert.equal(result.status, 200)
    assert.equal(result.state.lang, 'en')
    assert.equal(result.state.roadmap.stages[0].title, 'Python')
    assert.equal(result.state.roadmap.stages[0].tasks[0].title, 'Learn the basics of Python')
    assert.equal(result.state.roadmap.stages[0].tasks[0].progress, 40)
    assert.equal(result.state.points, 27)
    assert.deepEqual(store.load(), original, 'reading a display language does not rewrite the save')
})

test('tutorial and normal roadmap generation return the requested language and persist that preference', async () =>
{
    for(const demo of [ true, false ])
    {
        await learner()
        const result = await call('POST', '/api/roadmap', { lang: 'en', demo })
        assert.equal(result.status, 200)
        assert.equal(result.state.lang, 'en')
        assert.equal(store.load().lang, 'en')
        for(const stage of result.state.roadmap.stages)
            for(const text of [ stage.title, stage.why, ...stage.tasks.flatMap(task => [ task.title, task.why ]) ])
                assert.doesNotMatch(text, /\p{Script=Han}/u)
        assert.equal(typeof store.load().roadmap.stages[0].title.zh, 'string')
        assert.equal(typeof store.load().roadmap.stages[0].title.ms, 'string')
    }
})

test('language changes translate stage and task text while retaining their identity and learning progress', async () =>
{
    const original = await learner()
    for(const lang of [ 'en', 'ms', 'zh' ])
    {
        const result = await call('POST', '/api/lang', { lang })
        assert.equal(result.state.roadmap.stages[0].title, original.roadmap.stages[0].title[lang])
        assert.equal(result.state.roadmap.stages[0].why, original.roadmap.stages[0].why[lang])
        assert.equal(result.state.roadmap.stages[0].tasks[0].title, original.roadmap.stages[0].tasks[0].title[lang])
        const saved = store.load()
        assert.deepEqual(saved.roadmap, original.roadmap)
        assert.equal(saved.points, original.points)
    }
})

test('reset keeps the selected language and returns the same player identity it saves', async () =>
{
    await learner()
    const result = await call('POST', '/api/reset', { lang: 'en' })
    assert.equal(result.state.lang, 'en')
    assert.equal(result.state.roadmap, null)
    const saved = store.load()
    assert.equal(saved.lang, 'en')
    assert.equal(saved.player.id, result.state.player.id)
    assert.equal((await call('GET', '/api/state')).state.lang, 'en')
})

test('invalid display headers fall back to the saved preference', async () =>
{
    await learner()
    const result = await call('GET', '/api/state', null, 'invalid')
    assert.equal(result.state.lang, 'zh')
    assert.equal(result.state.roadmap.stages[0].title, 'Python 编程')
})
