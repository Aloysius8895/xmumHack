import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { CareerApi } from './CareerApi.js'
import { setLang } from './i18n.js'

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
