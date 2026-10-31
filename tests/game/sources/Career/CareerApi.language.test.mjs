import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { CareerApi } from '../../../../src/game/sources/Career/CareerApi.js'
import { setLang } from '../../../../src/game/sources/Career/i18n.js'

const originalFetch = globalThis.fetch
globalThis.document = { documentElement: {} }
test.after(() => { globalThis.fetch = originalFetch; delete globalThis.document })
const response = lang => new Response(JSON.stringify({ state: { lang } }), { headers: { 'content-type': 'application/json' } })

test('startup, roadmap generation and background reloads carry the UI language', async () =>
{
    setLang('en')
    const calls = [],api = new CareerApi()
    globalThis.fetch = async (url, options) => { calls.push({url,...options});return response(options.headers['X-Career-Lang']) }
    await api.load()
    api.demo = true
    await api.generateRoadmap()
    await api.refresh()
    assert.ok(calls.every(call => call.headers['X-Career-Lang'] === 'en'))
    assert.equal(JSON.parse(calls[1].body).lang, 'en')
    assert.equal(JSON.parse(calls[1].body).demo, true)
    assert.equal(api.state.lang, 'en')
})

test('skill extraction from a CV uses the real AI even while the guided tour runs on demo answers', async () =>
{
    setLang('en')
    const calls = [], api = new CareerApi()
    globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response('en') }
    api.demo = true
    await api.extractProfile('I write SQL every day', null)
    await api.generateRoadmap()
    assert.equal(JSON.parse(calls[0].body).demo, false)
    assert.equal(JSON.parse(calls[0].body).text, 'I write SQL every day')
    assert.equal(JSON.parse(calls[1].body).demo, true, 'the other tour calls stay on demo answers')
})

test('a background response from the old language is discarded and reloaded in the new selection', async () =>
{
    setLang('en')
    const api = new CareerApi(),requests=[],updates=[]
    api.state = { lang: 'en' }
    api.events.on('state', state => updates.push(state.lang))
    let finishOld
    globalThis.fetch = async (_url, options) =>
    {
        const lang = options.headers['X-Career-Lang']
        requests.push(lang)
        if(requests.length === 1) return new Promise(resolve => { finishOld = resolve })
        return response(lang)
    }
    const pending = api.refresh()
    setLang('ms')
    finishOld(response('en'))
    await pending
    for(let i=0; i<10 && api.refreshing; i++) await setImmediate()
    assert.deepEqual(requests, [ 'en', 'ms' ])
    assert.deepEqual(updates, [ 'ms' ])
    assert.equal(api.state.lang, 'ms')
})

test('a slow mutation response cannot restore the previous language after a switch', async () =>
{
    setLang('zh')
    const api = new CareerApi(), updates = []
    api.state = {lang: 'zh'}
    api.events.on('state', state => updates.push(state.lang))
    let finishOld
    globalThis.fetch = async (url, options) => {
        if(String(url).endsWith('/roadmap')) return new Promise(resolve => {finishOld = resolve})
        return response(options.headers['X-Career-Lang'])
    }
    const old = api.generateRoadmap()
    setLang('en')
    await api.setLang('en')
    finishOld(response('zh'))
    await old
    for(let i = 0; i < 10 && api.refreshing; i++) await setImmediate()
    assert.equal(api.state.lang, 'en')
    assert.ok(updates.length > 0)
    assert.ok(updates.every(lang => lang === 'en'))
})
