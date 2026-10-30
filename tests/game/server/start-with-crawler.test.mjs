import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { crawlerEnvironment, superviseCrawler } from '../../../src/game/server/start-with-crawler.js'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'start-with-crawler-'))
const configFile = path.join(directory, 'config.json')
test.after(() => fs.rmSync(directory, { recursive: true, force: true }))

const gameEnv = { PORT: '5000', MARKET_CRAWLER_TOKEN: 'c'.repeat(32), MARKET_CRAWLER_URL: 'http://127.0.0.1:8788', INTEGRATION_TOKEN: 'integration-token', RAPIDAPI_KEY: 'unit-test-key' }

test('the crawler is configured from the game environment, without new secrets', () =>
{
    const { env, platforms } = crawlerEnvironment(gameEnv, configFile)
    assert.equal(env.PORT, '8788')
    assert.equal(env.HOST, '127.0.0.1')
    assert.equal(env.CRAWLER_TOKEN, gameEnv.MARKET_CRAWLER_TOKEN)
    assert.equal(env.BACKEND_INGEST_URL, 'http://127.0.0.1:5000/api/integrations/crawler')
    assert.equal(env.BACKEND_INGEST_TOKEN, 'integration-token')
    assert.deepEqual(platforms, [ 'linkedin', 'indeed' ], 'JSearch serves LinkedIn and Indeed; Ricebowl needs a browser')
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    assert.deepEqual(config.sources.filter((source) => source.enabled).map((source) => source.transport), [ 'jsearch', 'jsearch' ])
})

test('without a JSearch key only LinkedIn public pages remain', () =>
{
    const { platforms } = crawlerEnvironment({ ...gameEnv, RAPIDAPI_KEY: '' }, configFile)
    assert.deepEqual(platforms, [ 'linkedin' ])
})

test('the crawler does not start without its tokens or on a non-local address', () =>
{
    assert.match(crawlerEnvironment({ ...gameEnv, MARKET_CRAWLER_TOKEN: 'short' }, configFile).reason, /MARKET_CRAWLER_TOKEN/)
    assert.match(crawlerEnvironment({ ...gameEnv, INTEGRATION_TOKEN: '' }, configFile).reason, /INTEGRATION_TOKEN/)
    assert.match(crawlerEnvironment({ ...gameEnv, MARKET_CRAWLER_URL: 'https://crawler.example.com:8788' }, configFile).reason, /local address/)
})

test('an exited crawler is restarted with a growing delay, and not after stop()', () =>
{
    const children = []
    const delays = []
    const spawnImpl = () =>
    {
        const child = Object.assign(new EventEmitter(), { kill() {} })
        children.push(child)
        return child
    }
    const supervisor = superviseCrawler({}, { spawnImpl, log: { error() {} }, wait: (run, ms) => { delays.push(ms); run() } })
    children[0].emit('exit', 1, null)
    children[1].emit('exit', 1, null)
    assert.equal(children.length, 3)
    assert.deepEqual(delays, [ 10_000, 20_000 ])
    supervisor.stop()
    children[2].emit('exit', null, 'SIGTERM')
    assert.equal(children.length, 3)
})
