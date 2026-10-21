/**
 * Fallback runner: the same pipeline as the n8n workflow, without n8n
 *
 *   RAPIDAPI_KEY=... INTEGRATION_TOKEN=... API_BASE_URL=http://localhost:8787 node n8n/market/run-local.mjs
 *   node n8n/market/run-local.mjs --dry-run                     # fetch + print the payload, push nothing
 *   node n8n/market/run-local.mjs --fixture <file> --dry-run    # no network: replay saved JSearch responses
 *   node n8n/market/run-local.mjs --backfill --dry-run          # past 30 days split by posting date into the 3 weeks before this one
 *   node n8n/market/run-local.mjs --backfill --replay <file>    # same from the saved responses of an earlier backfill, no quota used
 *
 * Every real fetch is saved to n8n/market/cache/ (gitignored) and prints the RapidAPI quota left.
 * --max-cost <n> (3 by default with --backfill): stop before the next search when one search used more than n
 * requests of the quota; the backfill first sends one 1-page search to read the quota left.
 *
 * Reads the game's .env (RAPIDAPI_KEY, INTEGRATION_TOKEN, API_BASE_URL) when present.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { catalog } from './build-workflow.mjs'
import { aggregate, backfill, buildQueries, DEFAULT_SETTINGS } from './pipeline.js'

const args = process.argv.slice(2)
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null
const dryRun = args.includes('--dry-run')
const isBackfill = args.includes('--backfill')
const fixture = option('--fixture') ? JSON.parse(fs.readFileSync(option('--fixture'), 'utf8')) : null
const replay = option('--replay') ? JSON.parse(fs.readFileSync(option('--replay'), 'utf8')) : null

const settings = { ...DEFAULT_SETTINGS, apiBaseUrl: (process.env.API_BASE_URL || DEFAULT_SETTINGS.apiBaseUrl).replace(/\/+$/, '') }
// Backfill: one search over the past 30 days with more pages (up to 100 postings per query), split by posting date
if(isBackfill)
    Object.assign(settings, { datePosted: 'month', numPages: 10 })
// A replay keeps the settings of its fetch (pages, window), only the game server URL comes from here
if(replay?.settings)
    Object.assign(settings, replay.settings, { apiBaseUrl: settings.apiBaseUrl })
const maxCost = Number(option('--max-cost') ?? (isBackfill ? 3 : Infinity))
let quotaLeft = null
const CACHE = path.join(path.dirname(new URL(import.meta.url).pathname), 'cache')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function search(query, params = {})
{
    if(fixture)
        return fixture[query.query] ?? { status: 'OK', data: [] }

    if(!process.env.RAPIDAPI_KEY)
        throw new Error('RAPIDAPI_KEY missing (env or .env)')
    const url = new URL('https://jsearch.p.rapidapi.com/search-v2')
    url.search = new URLSearchParams({ query: query.query, num_pages: String(query.numPages), country: query.country, date_posted: query.datePosted, ...params })
    try
    {
        const response = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' } })
        const left = response.headers.get('x-ratelimit-requests-remaining')
        if(left !== null)
        {
            const used = quotaLeft === null ? null : quotaLeft - Number(left)
            console.error(`  quota left this month: ${left} / ${response.headers.get('x-ratelimit-requests-limit')}${used === null ? '' : ` (this search used ${used})`}`)
            if(used !== null && used > maxCost)
                throw new QuotaGuard(`one search used ${used} requests, more than --max-cost ${maxCost}`)
            quotaLeft = Number(left)
        }
        const body = await response.json().catch(() => ({}))
        return response.ok ? body : { error: { message: `HTTP ${response.status} ${body.message ?? ''}`.trim() } }
    }
    catch(error)
    {
        if(error instanceof QuotaGuard)
            throw error
        return { error: { message: error.message } }
    }
}

class QuotaGuard extends Error {}

let isStopped = false
let responses = replay?.responses
const now = replay ? new Date(replay.fetchedAt) : new Date()
if(!responses)
{
    responses = []
    const queries = buildQueries(settings)
    try
    {
        // Baseline of the quota for --max-cost: the cheapest search there is
        if(isBackfill && !fixture)
        {
            console.error('quota check (1 page, today)')
            await search(queries[0], { num_pages: '1', date_posted: 'today' })
            await wait(1500)
        }
        for(const query of queries)
        {
            console.error(`search: ${query.query}`)
            responses.push({ query, body: await search(query) })
            if(!fixture)
                await wait(1500)
        }
    }
    catch(error)
    {
        if(!(error instanceof QuotaGuard))
            throw error
        console.error(`STOPPED: ${error.message}. Nothing pushed; ${responses.length} search(es) done before it are saved below.`)
        isStopped = true
    }
    if(!fixture)
    {
        fs.mkdirSync(CACHE, { recursive: true })
        const file = path.join(CACHE, `${isBackfill ? 'backfill' : 'weekly'}-${now.toISOString().replace(/[:.]/g, '-')}.json`)
        fs.writeFileSync(file, JSON.stringify({ fetchedAt: now.toISOString(), settings, responses }))
        console.error(`saved responses: ${file}  (replay with --replay, no quota used)`)
    }
    if(isStopped)
        process.exit(2)
}

const results = isBackfill ? backfill(responses, settings, catalog(), now) : [ aggregate(responses, settings, catalog(), now) ]
for(const { report } of results)
    console.error(JSON.stringify(report, null, 1))

const payloads = results.map(({ payload }) => payload).filter((payload) => Object.keys(payload.careers).length)
if(!payloads.length)
{
    console.error(isBackfill ? 'No posting dated in the weeks to backfill, nothing to push' : 'Every search failed, nothing to push')
    process.exit(1)
}

if(dryRun)
{
    console.log(JSON.stringify(isBackfill ? payloads : payloads[0], null, 2))
    process.exit(0)
}

if(!process.env.INTEGRATION_TOKEN)
    throw new Error('INTEGRATION_TOKEN missing (env or .env)')
let ok = true
for(const payload of payloads)
{
    const response = await fetch(`${settings.apiBaseUrl}/api/integrations/market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INTEGRATION_TOKEN}` },
        body: JSON.stringify(payload),
    })
    console.log(payload.period, response.status, await response.text())
    ok &&= response.ok
}
process.exit(ok ? 0 : 1)
