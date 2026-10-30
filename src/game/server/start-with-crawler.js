/**
 * Cloud start (Replit deployment): the game server, and beside it the market crawler on 127.0.0.1 so Refresh and
 * the daily collection work on the published app. The crawler takes its settings from the game's environment
 * (no extra secrets) and runs only the platforms that need no browser (CRAWLER_BROWSER_SOURCES=0).
 * Local development keeps using `npm run dev` and `npm run crawler:serve`.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gameConfig } from '../../crawler/src/game-config.js'
import { jsearchSettings } from '../../crawler/src/provider-env.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CRAWLER_ROOT = path.resolve(here, '../../crawler')

/** The crawler's environment derived from the game's, or { reason } when it cannot run here */
export function crawlerEnvironment(env = process.env, configFile = path.join(os.tmpdir(), 'kerjayaku-crawler-config.json'))
{
    const token = env.MARKET_CRAWLER_TOKEN ?? ''
    if(token.length < 24)
        return { reason: 'MARKET_CRAWLER_TOKEN missing or shorter than 24 characters' }
    if(!env.INTEGRATION_TOKEN)
        return { reason: 'INTEGRATION_TOKEN missing: the crawler could not publish to the game' }
    let address
    try
    {
        address = new URL(env.MARKET_CRAWLER_URL ?? 'http://127.0.0.1:8788')
    }
    catch
    {
        return { reason: 'MARKET_CRAWLER_URL is not a URL' }
    }
    if(![ '127.0.0.1', 'localhost' ].includes(address.hostname) || !address.port)
        return { reason: 'MARKET_CRAWLER_URL must be a local address with a port (the crawler is never exposed)' }

    const settings = jsearchSettings({ env, readGame: false })
    fs.writeFileSync(configFile, JSON.stringify(gameConfig({ jsearch: Boolean(settings.key), apiProvider: settings.provider, browserSources: false }), null, 2))
    return {
        env: {
            ...env,
            HOST: '127.0.0.1',
            PORT: address.port,
            CRAWLER_TOKEN: token,
            BACKEND_INGEST_URL: `http://127.0.0.1:${env.PORT || 8787}/api/integrations/crawler`,
            BACKEND_INGEST_TOKEN: env.INTEGRATION_TOKEN,
            CRAWLER_BROWSER_SOURCES: '0',
            GAME_CRAWLER_CONFIG_PATH: configFile,
            MARKET_PYTHON: env.MARKET_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
        },
        platforms: gameConfig({ jsearch: Boolean(settings.key), browserSources: false }).sources.filter((source) => source.enabled).map((source) => source.id),
    }
}

/** Keeps the crawler running: restarts it after an exit, waiting longer after each quick failure (5 s up to 60 s) */
export function superviseCrawler(environment, { spawnImpl = spawn, log = console, wait = setTimeout } = {})
{
    let child = null
    let stopped = false
    let delay = 5_000
    const start = () =>
    {
        const startedAt = Date.now()
        child = spawnImpl(process.execPath, [ 'src/game-cli.js', 'serve' ], { cwd: CRAWLER_ROOT, env: environment, stdio: [ 'ignore', 'inherit', 'inherit' ] })
        child.on('exit', (code, signal) =>
        {
            if(stopped)
                return
            delay = Date.now() - startedAt > 60_000 ? 5_000 : Math.min(delay * 2, 60_000)
            log.error(`[crawler] exited (${signal ?? code}), restarting in ${delay / 1000}s`)
            wait(start, delay)
        })
    }
    start()
    return { stop: () => { stopped = true; child?.kill() } }
}

async function main()
{
    const crawler = crawlerEnvironment()
    let supervisor = null
    if(crawler.env)
    {
        console.log(`[crawler] starting on 127.0.0.1:${crawler.env.PORT} with ${crawler.platforms.join(', ')}`)
        supervisor = superviseCrawler(crawler.env)
    }
    else
        console.error(`[crawler] not started: ${crawler.reason}. The game runs; Refresh will report the service as unavailable.`)
    for(const signal of [ 'SIGTERM', 'SIGINT' ])
        process.once(signal, () =>
        {
            supervisor?.stop()
            process.exit(0)
        })
    await import('./index.js')
}

if(process.argv[1] === fileURLToPath(import.meta.url))
    await main()
