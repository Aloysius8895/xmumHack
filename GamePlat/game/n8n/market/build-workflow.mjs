/**
 * Generates market-trends.workflow.json (the n8n workflow to import) from pipeline.js + server/careers.js
 *
 *   npm run n8n:build
 *
 * pipeline.js is the single source of the logic: edit it (and run the tests), then rebuild and re-import.
 * Also checks that pipeline.js covers exactly the careers and skills of server/careers.js.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAREERS, SKILLS } from '../../server/careers.js'
import { CAREER_SEARCH, DEFAULT_SETTINGS, SKILL_PATTERNS } from './pipeline.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT = path.join(here, 'market-trends.workflow.json')

// --- Catalog checks ---
export function catalog()
{
    return {
        careers: CAREERS.map((career) => career.id),
        skills: Object.fromEntries(Object.entries(SKILLS).map(([ id, name ]) => [ id, { zh: name.zh, en: name.en, ms: name.ms } ])),
    }
}

export function checkCoverage()
{
    const problems = []
    const careerIds = CAREERS.map((career) => career.id)
    for(const id of careerIds)
        if(!CAREER_SEARCH[id])
            problems.push(`career "${id}" has no search queries in pipeline.js CAREER_SEARCH`)
    for(const id of Object.keys(CAREER_SEARCH))
        if(!careerIds.includes(id))
            problems.push(`CAREER_SEARCH has "${id}" which is not a career of server/careers.js`)
    for(const id of Object.keys(SKILLS))
        if(!SKILL_PATTERNS[id])
            problems.push(`skill "${id}" has no keyword pattern in pipeline.js SKILL_PATTERNS`)
    for(const id of Object.keys(SKILL_PATTERNS))
        if(!SKILLS[id])
            problems.push(`SKILL_PATTERNS has "${id}" which is not a skill of server/careers.js`)
    return problems
}

// --- Workflow ---
function library()
{
    // LF even on a Windows checkout (core.autocrlf), so the output matches on every OS
    const source = fs.readFileSync(path.join(here, 'pipeline.js'), 'utf8').replace(/\r\n/g, '\n')
    return source.replace(/^export /gm, '')
}

function stableId(name)
{
    const hex = crypto.createHash('md5').update(`market-trends:${name}`).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function node(name, type, typeVersion, position, parameters, extra = {})
{
    return { parameters, id: stableId(name), name, type, typeVersion, position, ...extra }
}

function sticky(name, position, width, height, content)
{
    return node(name, 'n8n-nodes-base.stickyNote', 1, position, { content, width, height })
}

export function buildWorkflow()
{
    const lib = library()
    const catalogJson = JSON.stringify(catalog())
    const banner = '// Generated from n8n/market/pipeline.js by build-workflow.mjs: edit pipeline.js, run npm run n8n:build, re-import.\n'

    const buildQueriesCode = `${banner}
// ===== Settings: change these =====
const SETTINGS = ${JSON.stringify(DEFAULT_SETTINGS, null, 4)}

// ===== Pipeline library =====
${lib}

return buildQueries(SETTINGS).map((query) => ({ json: { ...query, settings: SETTINGS } }))
`

    const aggregateCode = `${banner}
// ===== Pipeline library =====
${lib}

const CATALOG = ${catalogJson}

const queries = $('Build queries').all()
const settings = queries[0]?.json.settings ?? DEFAULT_SETTINGS
const responses = $input.all().map((item, index) =>
{
    const paired = Array.isArray(item.pairedItem) ? item.pairedItem[0] : item.pairedItem
    return { query: queries[paired?.item ?? index]?.json, body: item.json }
})

const { payload, report } = aggregate(responses, settings, CATALOG, new Date())
if(!Object.keys(payload.careers).length)
    throw new Error('Every JSearch query failed, nothing pushed: ' + JSON.stringify(report.failedCareers).slice(0, 800))

return [ { json: { apiBaseUrl: String(settings.apiBaseUrl).replace(/\\/+$/, ''), payload, report } } ]
`

    const summaryCode = `${banner}
const result = $input.first().json
const { payload, report } = $('Aggregate skills').first().json
return [ {
    json: {
        accepted: result.careers,
        period: result.period,
        source: payload.source,
        postings: Object.fromEntries(Object.entries(payload.careers).map(([ id, career ]) => [ id, career.postings ])),
        topSkills: Object.fromEntries(Object.entries(payload.careers).map(([ id, career ]) => [ id, career.topSkills ])),
        report,
    },
} ]
`

    const nodes = [
        sticky('Note: overview', [ -80, -260 ], 1260, 220,
            '## Job market trends → game\n' +
            'Weekly (Mon 08:00 MYT) or by hand: JSearch (Google for Jobs: LinkedIn, Indeed, JobStreet…) postings per career → keyword count of the skills of `server/careers.js` → `POST /api/integrations/market`.\n\n' +
            '**Setup**: 1) credential *JSearch (RapidAPI key)*: Header Auth, name `X-RapidAPI-Key`. 2) credential *Career platform token*: Header Auth, name `Authorization`, value `Bearer <INTEGRATION_TOKEN>`. 3) `apiBaseUrl` in **Build queries**.\n\n' +
            'Only counts are sent: descriptions are read for keywords and never stored. Logic lives in `n8n/market/pipeline.js`.'),
        node('Every Monday 08:00', 'n8n-nodes-base.scheduleTrigger', 1.2, [ 0, 0 ], {
            rule: { interval: [ { field: 'cronExpression', expression: '0 8 * * 1' } ] },
        }),
        node('Run now (demo)', 'n8n-nodes-base.manualTrigger', 1, [ 0, 180 ], {}),
        node('Build queries', 'n8n-nodes-base.code', 2, [ 240, 80 ], { jsCode: buildQueriesCode }),
        node('JSearch search', 'n8n-nodes-base.httpRequest', 4.2, [ 480, 80 ], {
            url: 'https://jsearch.p.rapidapi.com/search-v2',
            authentication: 'genericCredentialType',
            genericAuthType: 'httpHeaderAuth',
            sendQuery: true,
            queryParameters: { parameters: [
                { name: 'query', value: '={{ $json.query }}' },
                { name: 'num_pages', value: '={{ $json.numPages }}' },
                { name: 'country', value: '={{ $json.country }}' },
                { name: 'date_posted', value: '={{ $json.datePosted }}' },
            ] },
            sendHeaders: true,
            headerParameters: { parameters: [ { name: 'X-RapidAPI-Host', value: 'jsearch.p.rapidapi.com' } ] },
            options: { batching: { batch: { batchSize: 1, batchInterval: 1500 } }, timeout: 60000 },
        }, { onError: 'continueRegularOutput' }), // a failed search becomes an { error } item, Aggregate skills skips it
        node('Aggregate skills', 'n8n-nodes-base.code', 2, [ 720, 80 ], { jsCode: aggregateCode }),
        node('Push to game server', 'n8n-nodes-base.httpRequest', 4.2, [ 960, 80 ], {
            method: 'POST',
            url: '={{ $json.apiBaseUrl }}/api/integrations/market',
            authentication: 'genericCredentialType',
            genericAuthType: 'httpHeaderAuth',
            sendBody: true,
            specifyBody: 'json',
            jsonBody: '={{ JSON.stringify($json.payload) }}',
            options: { timeout: 30000 },
        }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
        node('Run summary', 'n8n-nodes-base.code', 2, [ 1200, 80 ], { jsCode: summaryCode }),
    ]

    const link = (to) => ({ main: [ [ { node: to, type: 'main', index: 0 } ] ] })
    const connections = {
        'Every Monday 08:00': link('Build queries'),
        'Run now (demo)': link('Build queries'),
        'Build queries': link('JSearch search'),
        'JSearch search': link('Aggregate skills'),
        'Aggregate skills': link('Push to game server'),
        'Push to game server': link('Run summary'),
    }

    return {
        name: 'Career platform: job market trends',
        nodes,
        connections,
        active: false,
        settings: { executionOrder: 'v1', timezone: DEFAULT_SETTINGS.timezone },
        pinData: {},
        meta: { templateCredsSetupCompleted: false },
        tags: [],
    }
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const problems = checkCoverage()
    if(problems.length)
    {
        console.error('pipeline.js does not match server/careers.js:\n- ' + problems.join('\n- '))
        process.exit(1)
    }
    fs.writeFileSync(OUTPUT, JSON.stringify(buildWorkflow(), null, 2) + '\n')
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`)
}
