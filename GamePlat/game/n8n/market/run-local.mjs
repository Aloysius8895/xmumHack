/**
 * Fallback runner: the same pipeline as the n8n workflow, without n8n
 *
 *   RAPIDAPI_KEY=... INTEGRATION_TOKEN=... API_BASE_URL=http://localhost:8787 node n8n/market/run-local.mjs
 *   node n8n/market/run-local.mjs --dry-run                     # fetch + print the payload, push nothing
 *   node n8n/market/run-local.mjs --fixture <file> --dry-run    # no network: replay saved JSearch responses
 *
 * Reads the game's .env (RAPIDAPI_KEY, INTEGRATION_TOKEN, API_BASE_URL) when present.
 */
import 'dotenv/config'
import fs from 'node:fs'
import { catalog } from './build-workflow.mjs'
import { aggregate, buildQueries, DEFAULT_SETTINGS } from './pipeline.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const fixtureIndex = args.indexOf('--fixture')
const fixture = fixtureIndex >= 0 ? JSON.parse(fs.readFileSync(args[fixtureIndex + 1], 'utf8')) : null

const settings = { ...DEFAULT_SETTINGS, apiBaseUrl: (process.env.API_BASE_URL || DEFAULT_SETTINGS.apiBaseUrl).replace(/\/+$/, '') }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function search(query)
{
    if(fixture)
        return fixture[query.query] ?? { status: 'OK', data: [] }

    if(!process.env.RAPIDAPI_KEY)
        throw new Error('RAPIDAPI_KEY missing (env or .env)')
    const url = new URL('https://jsearch.p.rapidapi.com/search-v2')
    url.search = new URLSearchParams({ query: query.query, num_pages: String(query.numPages), country: query.country, date_posted: query.datePosted })
    try
    {
        const response = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' } })
        const body = await response.json().catch(() => ({}))
        return response.ok ? body : { error: { message: `HTTP ${response.status} ${body.message ?? ''}`.trim() } }
    }
    catch(error)
    {
        return { error: { message: error.message } }
    }
}

const responses = []
for(const query of buildQueries(settings))
{
    console.error(`search: ${query.query}`)
    responses.push({ query, body: await search(query) })
    if(!fixture)
        await wait(1500)
}

const { payload, report } = aggregate(responses, settings, catalog(), new Date())
console.error(JSON.stringify(report, null, 1))

if(!Object.keys(payload.careers).length)
{
    console.error('Every search failed, nothing to push')
    process.exit(1)
}

if(dryRun)
{
    console.log(JSON.stringify(payload, null, 2))
    process.exit(0)
}

if(!process.env.INTEGRATION_TOKEN)
    throw new Error('INTEGRATION_TOKEN missing (env or .env)')
const response = await fetch(`${settings.apiBaseUrl}/api/integrations/market`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INTEGRATION_TOKEN}` },
    body: JSON.stringify(payload),
})
console.log(response.status, await response.text())
process.exit(response.ok ? 0 : 1)
