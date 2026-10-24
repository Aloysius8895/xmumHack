import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-integrations-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'test-token'

const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')

async function call(route, body, token = 'test-token')
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: token ? { authorization: `Bearer ${token}` } : {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('integrations need the bearer token', async () =>
{
    assert.equal((await call('/api/integrations/market', {}, null)).status, 401)
    assert.equal((await call('/api/integrations/market', {}, 'wrong')).status, 401)
})

test('market snapshots update the careers trend, change computed from postings', async () =>
{
    let result = await call('/api/integrations/market', { period: '2026-10', source: 'linkedin+indeed', careers: { 'data-analyst': { postings: 1000 }, 'not-a-career': { postings: 5 } } })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.careers, [ 'data-analyst' ])

    result = await call('/api/integrations/market', { period: '2026-11', careers: { 'data-analyst': { postings: 1100, note: 'More BI roles', topSkills: { sql: 700, unknown: 3 } } } })
    assert.equal(result.status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    assert.equal(trend.live, true)
    assert.equal(trend.period, '2026-11')
    assert.equal(trend.change, 10)
    assert.equal(trend.postings, 1100)
    assert.deepEqual(trend.topSkills, { sql: 700 })

    assert.equal((await call('/api/integrations/market', { period: 'October', careers: {} })).status, 400)
})

test('weekly snapshots are kept as history, the same week is a correction', async () =>
{
    // Earlier monthly snapshots (previous test) are migrated into the history and sort before the weeks
    for(const [ period, postings ] of [ [ '2026-12-07', 20 ], [ '2026-12-21', 30 ], [ '2026-12-14', 25 ], [ '2026-12-21', 24 ] ])
        assert.equal((await call('/api/integrations/market', { period, careers: { 'data-analyst': { postings } } })).status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    assert.equal(trend.period, '2026-12-21')
    assert.equal(trend.postings, 24, 'second push of the week replaced the first')
    assert.deepEqual(trend.history.map((point) => point.period), [ '2026-10', '2026-11', '2026-12-07', '2026-12-14', '2026-12-21' ])
    assert.deepEqual(trend.history.slice(2).map((point) => point.postings), [ 20, 25, 24 ])
    assert.equal(trend.history.at(- 2).change, 25, 'week pushed late compares with the week before it: 25 vs 20')
    assert.equal(trend.change, - 4, '24 vs 25 of the week before')

    // Only the last 26 periods are kept
    for(let week = 0; week < 30; week++)
    {
        const day = new Date(Date.UTC(2027, 0, 4 + week * 7)).toISOString().slice(0, 10)
        await call('/api/integrations/market', { period: day, careers: { 'data-analyst': { postings: week } } })
    }
    const market = store.loadMarket()
    assert.equal(market.history.length, 26)
    assert.equal(market.latest.period, market.history.at(- 1).period)
    assert.equal(market.previous.period, market.history.at(- 2).period)
})

test('backfilled weeks are kept but never compared', async () =>
{
    for(const [ period, postings, backfilled ] of [ [ '2028-01-03', 5, true ], [ '2028-01-10', 8, true ], [ '2028-01-17', 30, false ], [ '2028-01-24', 33, false ] ])
        assert.equal((await call('/api/integrations/market', { period, backfilled, careers: { 'data-analyst': { postings } } })).status, 200)

    const trend = game.view(store.load(), { mock: true }).careers.find((career) => career.id === 'data-analyst').market.snapshot
    const weeks = trend.history.slice(- 4)
    assert.deepEqual(weeks.map((point) => point.backfilled), [ true, true, false, false ])
    assert.deepEqual(weeks.map((point) => point.change), [ null, null, null, 10 ], 'only live week vs live week is compared')
    assert.equal(trend.change, 10)
})

test('skill popularity: share of postings per skill, change in points vs the previous week', async () =>
{
    await call('/api/integrations/market', { period: '2029-01-01', careers: { 'data-analyst': { postings: 20, topSkills: { sql: 10, excel: 5 } }, 'frontend-developer': { postings: 30, topSkills: { react: 15 } } } })
    let state = game.view(store.load(), { mock: true })
    let analyst = state.careers.find((career) => career.id === 'data-analyst').market.skills
    assert.equal(analyst.previousPeriod, '2028-01-24', 'compared with the week pushed by the test before')

    await call('/api/integrations/market', { period: '2029-01-08', careers: { 'data-analyst': { postings: 25, topSkills: { sql: 15, python: 5 } }, 'frontend-developer': { postings: 25, topSkills: { react: 15 } } } })
    state = game.view(store.load(), { mock: true })
    analyst = state.careers.find((career) => career.id === 'data-analyst').market.skills
    assert.equal(analyst.period, '2029-01-08')
    assert.equal(analyst.previousPeriod, '2029-01-01')
    assert.equal(analyst.postings, 25)
    assert.deepEqual(analyst.skills, [
        { id: 'sql', share: 60, change: 10 },       // 15/25 vs 10/20
        { id: 'python', share: 20, change: 20 },    // new this week
        { id: 'excel', share: 0, change: - 25 },    // gone: 0 vs 5/20
    ])

    // Every career together: 50 postings each week
    const market = state.marketSkills
    assert.equal(market.postings, 50)
    assert.deepEqual(market.skills.find((skill) => skill.id === 'react'), { id: 'react', share: 30, change: 0 })
    assert.deepEqual(market.skills.find((skill) => skill.id === 'sql'), { id: 'sql', share: 30, change: 10 })
})

test('skill popularity of the first week has no change yet', async () =>
{
    const { skillTrend } = await import('../../../src/game/server/market-trends.js')
    const week = { period: '2026-10-19', careers: { 'data-analyst': { postings: 15, topSkills: { 'data-visualization': 10, sql: 5 } } } }
    assert.deepEqual(skillTrend('data-analyst', { latest: week, previous: null, history: [ week ] }), {
        period: '2026-10-19', previousPeriod: null, postings: 15, live: true,
        skills: [ { id: 'data-visualization', share: 67, change: null }, { id: 'sql', share: 33, change: null } ],
    })
    assert.equal(skillTrend('ml-engineer', { latest: week, previous: null, history: [ week ] }), null)
    assert.equal(skillTrend(null, { latest: null, previous: null, history: [] }), null)
})

test('skill trends fall back to the reference data until the workflow pushes', async () =>
{
    const { skillTrendOrReference, skillMarket } = await import('../../../src/game/server/market-trends.js')
    const empty = { latest: null, previous: null, history: [] }
    const reference = skillTrendOrReference('data-analyst', [ 'sql', 'excel', 'python' ], empty)
    assert.equal(reference.live, false)
    assert.deepEqual(reference.skills.map((skill) => [ skill.id, skill.trend ]), [ [ 'python', 'rising' ], [ 'sql', 'stable' ], [ 'excel', 'falling' ] ])
    assert.deepEqual(skillMarket([ 'python' ], empty).python, { live: false, trend: 'rising', period: '2026-10' })

    const week = { period: '2026-10-19', careers: { 'data-analyst': { postings: 10, topSkills: { python: 4 } } } }
    const market = { latest: week, previous: null, history: [ week ] }
    assert.equal(skillTrendOrReference('data-analyst', [ 'python' ], market).live, true)
    assert.deepEqual(skillMarket([ 'python', 'sql' ], market), {
        python: { live: true, share: 40, change: null, period: '2026-10-19' },
        sql: { live: true, share: 0, change: null, period: '2026-10-19' },
    })
})

test('chat messages from the bots are filed as logs and get a reply', async () =>
{
    const save = store.load()
    save.roadmap = { stages: [ { id: 's1', tasks: [ { id: 's1t1', skillId: 'sql', mp: 10, progress: 0 } ], prerequisites: [] } ] }
    store.save(save)

    const result = await call('/api/integrations/chat', { channel: 'telegram', text: 'Practised SQL joins for 2 hours', lang: 'en' })
    assert.equal(result.status, 200)
    assert.equal(typeof result.body.reply, 'string')
    assert.equal(result.body.log.source, 'telegram')
    assert.equal(store.load().roadmap.stages[0].tasks[0].progress, 20)
    assert.equal((await call('/api/integrations/chat', { channel: 'email', text: 'hi' })).status, 400)
})

test('daily digests set or raise the skill mastery shown on the pet skills', async () =>
{
    let result = await call('/api/integrations/digest', { date: '2026-10-21', summary: 'SQL joins', skills: [ { skillId: 'sql', mastery: 40 }, { skillId: 'nope', mastery: 90 } ] })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.digest.skills.map((item) => [ item.skillId, item.to ]), [ [ 'sql', 40 ] ])

    result = await call('/api/integrations/digest', { date: '2026-10-22', skills: [ { skillId: 'sql', delta: 75 } ] })
    assert.equal(result.body.digest.skills[0].to, 100) // clamped

    const save = store.load()
    assert.equal(save.mastery.sql, 100)
    assert.equal(save.digests.length, 2)
})

test('saves from version 2 get the mastery fields', () =>
{
    const file = path.join(process.env.SAVE_DIR, 'save.json')
    const old = { ...store.createSave(), version: 2 }
    delete old.mastery
    delete old.digests
    fs.writeFileSync(file, JSON.stringify(old))
    const save = store.load()
    assert.equal(save.version, store.SAVE_VERSION)
    assert.deepEqual(save.mastery, {})
    assert.deepEqual(save.digests, [])
})

test('trends show demo data until the workflow pushes a month, then the pushed months', async () =>
{
    const { trendsView } = await import('../../../src/game/server/trends.js')
    assert.equal(trendsView().demo, true)
    assert.equal(trendsView().careers.length, 8)

    assert.equal((await call('/api/integrations/trends', { period: '2026-9', careers: { 'data-analyst': { ads: 1 } } })).status, 400)
    assert.equal((await call('/api/integrations/trends', { period: '2026-09', careers: { 'Bad Id': { ads: 1 } } })).status, 400)

    let result = await call('/api/integrations/trends', { period: '2026-09', source: 'n8n', careers: { 'data-analyst': { ads: 450 }, 'cloud-engineer': { ads: 365, name: 'Cloud Engineer' } }, skills: { sql: { share: 38 }, rust: { share: 4 } } })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.careers, [ 'data-analyst', 'cloud-engineer' ])
    result = await call('/api/integrations/trends', { period: '2026-08', careers: { 'data-analyst': { ads: 410 } } })
    assert.equal(result.body.months, 2)

    const view = trendsView()
    assert.equal(view.demo, false)
    assert.deepEqual(view.periods, [ '2026-08', '2026-09' ])
    const analyst = view.careers.find((career) => career.id === 'data-analyst')
    assert.deepEqual(analyst.ads, [ 410, 450 ])
    assert.equal(analyst.careerId, 'data-analyst')
    assert.equal(analyst.name.en, 'Data Analyst')
    const cloud = view.careers.find((career) => career.id === 'cloud-engineer')
    assert.deepEqual(cloud.ads, [ null, 365 ])
    assert.equal(cloud.careerId, null)
    assert.equal(view.skills.find((skill) => skill.id === 'rust').name.en, 'Rust')
})

test('career mentors answer the player question (demo answer without an API key)', async () =>
{
    let result = await call('/api/npc/ask', { careerId: 'data-analyst', question: 'How do I start?', lang: 'en', history: [ { role: 'assistant', content: 'dropped, not a user turn first' } ] })
    assert.equal(result.status, 200)
    assert.match(result.body.answer, /Data Analyst/)
    assert.equal((await call('/api/npc/ask', { careerId: 'data-analyst', question: '   ' })).status, 400)
    assert.equal((await call('/api/npc/ask', { careerId: 'astronaut', question: 'Hi' })).status, 404)
})

test('a mentor hands over to the career industry elite, distilled card read from src/expert', async () =>
{
    const { expertCard } = await import('../../../src/game/server/experts.js')
    assert.match(expertCard('data-analyst').card, /Hans Rosling/)
    assert.match(expertCard('ml-engineer').card, /Andrej Karpathy/)
    assert.equal(expertCard('frontend-developer'), null)

    const careers = game.view(store.load(), { mock: true }).careers
    assert.equal(careers.find((career) => career.id === 'data-analyst').expert.name, 'Hans Rosling')
    assert.equal(careers.find((career) => career.id === 'frontend-developer').expert, null)

    const result = await call('/api/npc/ask', { careerId: 'data-analyst', question: 'How do I start?', lang: 'en', elite: true })
    assert.equal(result.status, 200)
    assert.match(result.body.answer, /Hans Rosling/)
    assert.equal((await call('/api/npc/ask', { careerId: 'frontend-developer', question: 'Hi', elite: true })).status, 404)
})

test('the dialogue gets the answer streamed: text pieces, then the whole answer; errors before streaming as JSON', async () =>
{
    async function stream(body)
    {
        const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
        Object.assign(request, { method: 'POST', url: '/api/npc/ask/stream', headers: {} })
        let payload = ''
        const response = { statusCode: 0, writableEnded: false, setHeader() {}, on() {}, write(text) { payload += text }, end(text = '') { payload += text; this.writableEnded = true } }
        await handle(request, response)
        return { status: response.statusCode, lines: payload.trim().split('\n').map((line) => JSON.parse(line)) }
    }

    const result = await stream({ careerId: 'data-analyst', question: 'How do I start?', lang: 'en', elite: true })
    assert.equal(result.status, 200)
    const pieces = result.lines.filter((event) => event.text)
    assert.ok(pieces.length > 5)
    assert.equal(pieces.map((event) => event.text).join(''), result.lines.at(- 1).answer)
    assert.match(result.lines.at(- 1).answer, /Hans Rosling/)

    const missing = await stream({ careerId: 'astronaut', question: 'Hi' })
    assert.equal(missing.status, 404)
    assert.deepEqual(missing.lines, [ { error: 'no-career' } ])
})

test('a file attached to a mentor question is checked and read', async () =>
{
    const file = { name: 'notes.txt', mediaType: 'text/plain', data: Buffer.from('SELECT * FROM jobs').toString('base64') }
    let result = await call('/api/npc/ask', { careerId: 'data-analyst', question: 'Is this query ok?', lang: 'en', file })
    assert.equal(result.status, 200)
    assert.match(result.body.answer, /notes\.txt/)
    result = await call('/api/npc/ask', { careerId: 'data-analyst', question: 'And this?', file: { ...file, mediaType: 'application/zip' } })
    assert.equal(result.status, 415)
})
