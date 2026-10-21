import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// Isolated save directory for the server end-to-end test, before the server modules read it
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'market-pipeline-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'

const { aggregate, backfill, buildQueries, DEFAULT_SETTINGS, extractSkills, periodOf } = await import('./pipeline.js')
const { buildWorkflow, catalog, checkCoverage } = await import('./build-workflow.mjs')

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'sample-jsearch.json'), 'utf8'))
const NOW = new Date('2026-10-21T00:00:00Z')

function fixtureResponses(settings = DEFAULT_SETTINGS)
{
    return buildQueries(settings).map((query) => ({ query, body: fixture[query.query] }))
}

test('pipeline covers every career and skill of server/careers.js', () =>
{
    assert.deepEqual(checkCoverage(), [])
})

test('skill keywords', () =>
{
    assert.deepEqual(extractSkills('SQL queries, Power BI dashboards and Excel').sort(), [ 'data-visualization', 'excel', 'sql' ])
    assert.ok(extractSkills('Experience with React and Next.js').includes('react'))
    assert.ok(!extractSkills('Able to react quickly to customer needs').includes('react'))
    assert.ok(extractSkills('C# and .NET services').includes('backend-language'))
    assert.ok(!extractSkills('JavaScript only').includes('backend-language'), 'java must not match javascript')
})

test('period is the Monday of the week in Malaysia time', () =>
{
    assert.equal(periodOf(NOW, 'Asia/Kuala_Lumpur'), '2026-10-19')
    assert.equal(periodOf(new Date('2026-10-19T00:00:00Z'), 'Asia/Kuala_Lumpur'), '2026-10-19', 'Monday 08:00 MYT run')
    assert.equal(periodOf(new Date('2026-10-25T15:59:00Z'), 'Asia/Kuala_Lumpur'), '2026-10-19', 'Sunday 23:59 MYT')
    assert.equal(periodOf(new Date('2026-10-25T16:00:00Z'), 'Asia/Kuala_Lumpur'), '2026-10-26', 'Monday 00:00 MYT, still Sunday in UTC')
    assert.equal(periodOf(new Date('2026-11-01T00:00:00Z'), 'Asia/Kuala_Lumpur'), '2026-10-26', 'week across a month')
})

test('backfill splits the past 30 days into the weeks before this one by posting date', () =>
{
    const posted = (day, id) => ({ job_id: id, job_title: 'Data Analyst', job_description: 'SQL and Excel reports', job_posted_at_timestamp: Date.parse(`${day}T00:00:00Z`) / 1000 })
    const jobs = [ posted('2026-09-20', 'too-old'), posted('2026-09-29', 'a'), posted('2026-10-06', 'b'), posted('2026-10-07', 'c'), posted('2026-10-13', 'd'), posted('2026-10-20', 'this-week'), { job_id: 'no-date', job_title: 'Data Analyst' } ]
    const settings = { ...DEFAULT_SETTINGS, datePosted: 'month', numPages: 10 }
    const query = buildQueries(settings).find((item) => item.careerId === 'data-analyst')
    const results = backfill([ { query, body: { status: 'OK', data: { jobs } } } ], settings, catalog(), NOW)

    assert.deepEqual(results.map(({ payload }) => payload.period), [ '2026-09-28', '2026-10-05', '2026-10-12' ])
    assert.deepEqual(results.map(({ payload }) => payload.careers['data-analyst'].postings), [ 1, 2, 1 ])
    assert.ok(results.every(({ payload }) => payload.backfilled === true && payload.collectedAt === NOW.toISOString()))
    assert.equal(results[1].payload.careers['data-analyst'].topSkills.sql, 2)
    assert.match(results[0].payload.careers['data-analyst'].note.zh, /这周发布且仍在招/)
    assert.match(results[0].payload.source, /^Backfill by posting date/)
})

test('aggregate dedupes, filters titles and counts skills', () =>
{
    const { payload, report } = aggregate(fixtureResponses(), DEFAULT_SETTINGS, catalog(), NOW)

    assert.equal(payload.period, '2026-10-19')
    assert.equal(payload.collectedAt, NOW.toISOString())
    assert.ok(payload.source.length <= 120)
    assert.deepEqual(Object.keys(payload.careers).sort(), catalog().careers.slice().sort())

    const analyst = payload.careers['data-analyst']
    assert.equal(analyst.postings, 3, 'fx-da-1 counted once, the sales job filtered out')
    assert.equal(report.careers['data-analyst'].filteredByTitle, 1)
    assert.equal(analyst.topSkills.sql, 3)
    assert.equal(analyst.topSkills['data-visualization'], 3)
    assert.equal(Object.keys(analyst.topSkills)[0], 'data-visualization', 'ties sorted by id')
    assert.match(analyst.note.zh, /^近 7 天抽样 3 个职位/)
    for(const lang of [ 'zh', 'en', 'ms' ])
        assert.ok(analyst.note[lang].length <= 200)

    // Only catalog skills, at most settings.topSkills
    for(const career of Object.values(payload.careers))
    {
        assert.ok(Object.keys(career.topSkills).length <= DEFAULT_SETTINGS.topSkills)
        for(const skillId of Object.keys(career.topSkills))
            assert.ok(catalog().skills[skillId])
    }
})

test('a career whose searches all failed is left out, saturation is flagged', () =>
{
    const responses = fixtureResponses().map((response) => response.query.careerId === 'ml-engineer'
        // Shape of an n8n HTTP Request error item (onError: continueRegularOutput)
        ? { ...response, body: { error: { message: 'Try spacing your requests out', name: 'AxiosError', stack: 'AxiosError: Request failed with status code 429\n    at settle' } } }
        : response)
    const settings = { ...DEFAULT_SETTINGS, numPages: 1 }
    const full = { status: 'OK', data: Array.from({ length: 10 }, (_, index) => ({ job_id: `pm-${index}`, job_title: 'Product Manager', job_description: 'Agile' })) }
    responses.find((response) => response.query.query === 'product owner in Malaysia').body = full

    const { payload, report } = aggregate(responses, settings, catalog(), NOW)
    assert.equal(payload.careers['ml-engineer'], undefined)
    assert.equal(report.failedCareers[0].careerId, 'ml-engineer')
    assert.equal(report.failedCareers[0].failedQueries[0].error, 'HTTP 429: Try spacing your requests out')
    assert.equal(report.careers['product-manager'].saturated, true)
    assert.match(payload.careers['product-manager'].note.en, /sample cap reached/)
})

test('everything failing gives an empty push', () =>
{
    const responses = buildQueries().map((query) => ({ query, body: { error: { message: 'down' } } }))
    const { payload, report } = aggregate(responses, DEFAULT_SETTINGS, catalog(), NOW)
    assert.deepEqual(payload.careers, {})
    assert.equal(report.failedCareers.length, catalog().careers.length)
})

/**
 * Runs a generated Code node the way n8n does: the code is a function body with $input and $() in scope
 */
function runCodeNode(code, { input = [], nodes = {} } = {})
{
    const $input = { all: () => input, first: () => input[0] }
    const $ = (name) => ({ all: () => nodes[name], first: () => nodes[name][0] })
    return new Function('$input', '$', code)($input, $)
}

test('the generated n8n workflow runs the same pipeline', () =>
{
    const workflow = buildWorkflow()
    const code = (name) => workflow.nodes.find((node) => node.name === name).parameters.jsCode

    // Every connection points at an existing node
    const names = new Set(workflow.nodes.map((node) => node.name))
    for(const [ from, output ] of Object.entries(workflow.connections))
    {
        assert.ok(names.has(from))
        for(const link of output.main.flat())
            assert.ok(names.has(link.node))
    }

    const queries = runCodeNode(code('Build queries'))
    assert.equal(queries.length, buildQueries().length)
    assert.equal(queries[0].json.settings.apiBaseUrl, DEFAULT_SETTINGS.apiBaseUrl)

    // HTTP Request output: one item per query, pairedItem pointing back at it
    const httpItems = queries.map((item, index) => ({ json: fixture[item.json.query] ?? { error: { message: 'missing' } }, pairedItem: { item: index } }))
    const [ aggregated ] = runCodeNode(code('Aggregate skills'), { input: httpItems, nodes: { 'Build queries': queries } })
    const expected = aggregate(fixtureResponses(), DEFAULT_SETTINGS, catalog(), new Date(aggregated.json.payload.collectedAt))
    assert.deepEqual(aggregated.json.payload, expected.payload)
    assert.equal(aggregated.json.apiBaseUrl, 'http://localhost:8787')

    const failing = queries.map((item, index) => ({ json: { error: { message: 'down' } }, pairedItem: { item: index } }))
    assert.throws(() => runCodeNode(code('Aggregate skills'), { input: failing, nodes: { 'Build queries': queries } }), /Every JSearch query failed/)

    const [ summary ] = runCodeNode(code('Run summary'), { input: [ { json: { period: '2026-10-19', careers: [ 'data-analyst' ] } } ], nodes: { 'Aggregate skills': [ aggregated ] } })
    assert.equal(summary.json.postings['data-analyst'], 3)
})

test('the committed workflow file is up to date', () =>
{
    const committed = JSON.parse(fs.readFileSync(path.join(here, 'market-trends.workflow.json'), 'utf8'))
    assert.deepEqual(committed, buildWorkflow(), 'run npm run n8n:build after changing pipeline.js')
})

test('the game server accepts the push and shows it in the careers panel', async () =>
{
    const { handle } = await import('../../server/app.js')
    const store = await import('../../server/store.js')
    const game = await import('../../server/game.js')

    const { payload } = aggregate(fixtureResponses(), DEFAULT_SETTINGS, catalog(), NOW)
    const request = Readable.from([ Buffer.from(JSON.stringify(payload)) ])
    Object.assign(request, { method: 'POST', url: '/api/integrations/market', headers: { authorization: 'Bearer test-token' } })
    let body = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { body = text } }
    await handle(request, response)

    assert.equal(response.statusCode, 200, body)
    assert.deepEqual(JSON.parse(body).careers.sort(), catalog().careers.slice().sort())

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    assert.equal(trend.live, true)
    assert.equal(trend.period, '2026-10-19')
    assert.equal(trend.postings, 3)
    assert.equal(trend.topSkills.sql, 3)
})
