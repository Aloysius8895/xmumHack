/**
 * Integration endpoints for outside workflows (all under /api/integrations/, Authorization: Bearer INTEGRATION_TOKEN)
 *
 * 1. Job market workflow (scrapers / automations on LinkedIn, Indeed...): POST /api/integrations/market
 *    pushes the job posting counts per career, the careers panel trend switches from the reference values
 *    (server/market-trends.js) to these live numbers.
 * 2. WhatsApp / Telegram AI agent:
 *    - POST /api/integrations/chat    one message of the user, filed as a learning log, returns the reply to send back
 *    - POST /api/integrations/digest  the agent's daily digest of the reports, updates the skill mastery (0-100)
 *
 * Without INTEGRATION_TOKEN in .env the endpoints answer 503 (disabled). See CAREER.md "外部接口".
 */
import crypto from 'node:crypto'
import { CAREERS, SKILLS } from './careers.js'
import * as store from './store.js'

export const CHANNELS = [ 'whatsapp', 'telegram' ]
const MAX_DIGESTS = 60

export class IntegrationError extends Error
{
    constructor(status, code)
    {
        super(code)
        this.status = status
        this.code = code
    }
}

/**
 * Bearer token check, constant time
 */
export function authorize(request)
{
    const expected = process.env.INTEGRATION_TOKEN
    if(!expected)
        throw new IntegrationError(503, 'integration-disabled')

    const given = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    if(a.length !== b.length || !crypto.timingSafeEqual(a, b))
        throw new IntegrationError(401, 'unauthorized')
}

/**
 * Market snapshot
 * body: {
 *   period: '2026-10',                       // month (YYYY-MM) or day (YYYY-MM-DD) of the collection
 *   source: 'linkedin+indeed',               // free text, shown nowhere but kept for traceability
 *   collectedAt: '2026-10-21T08:00:00Z',     // optional
 *   careers: {
 *     'data-analyst': { postings: 1240, change?: 3, note?: { zh, en, ms } | 'text', topSkills?: { sql: 820, python: 610 } },
 *     ...
 *   }
 * }
 * change (% vs the previous period) is computed from postings when it isn't given.
 */
export function receiveMarket(body)
{
    const period = String(body.period ?? '')
    if(!/^\d{4}-\d{2}(-\d{2})?$/.test(period))
        throw new IntegrationError(400, 'bad-period')
    if(!body.careers || typeof body.careers !== 'object')
        throw new IntegrationError(400, 'bad-careers')

    const known = new Set(CAREERS.map((career) => career.id))
    const market = store.loadMarket()
    // A new period moves the current snapshot to "previous", the same period is a correction
    const previous = market.latest && market.latest.period !== period ? market.latest : market.previous

    const careers = {}
    for(const [ id, value ] of Object.entries(body.careers))
    {
        if(!known.has(id) || typeof value !== 'object' || value === null)
            continue
        const postings = Number.isFinite(value.postings) ? Math.max(0, Math.round(value.postings)) : null
        const before = previous?.careers?.[id]?.postings
        let change = Number.isFinite(value.change) ? Math.round(value.change) : null
        if(change === null && postings !== null && before > 0)
            change = Math.round((postings - before) / before * 100)

        const note = typeof value.note === 'string' ? { zh: value.note, en: value.note, ms: value.note } : value.note
        careers[id] = {
            postings,
            change: change ?? 0,
            note: note && typeof note === 'object' ? { zh: String(note.zh ?? note.en ?? '').slice(0, 200), en: String(note.en ?? note.zh ?? '').slice(0, 200), ms: String(note.ms ?? note.en ?? '').slice(0, 200) } : null,
            topSkills: value.topSkills && typeof value.topSkills === 'object'
                ? Object.fromEntries(Object.entries(value.topSkills).filter(([ skill, count ]) => SKILLS[skill] && Number.isFinite(count)).map(([ skill, count ]) => [ skill, Math.round(count) ]))
                : {},
        }
    }
    if(!Object.keys(careers).length)
        throw new IntegrationError(400, 'no-known-career')

    const latest = { period, source: String(body.source ?? '').slice(0, 120), collectedAt: String(body.collectedAt ?? new Date().toISOString()), receivedAt: new Date().toISOString(), careers }
    store.saveMarket({ latest, previous })
    return { period, careers: Object.keys(careers) }
}

/**
 * Daily digest of the chat agent
 * body: {
 *   date: '2026-10-21',
 *   summary: 'Practised SQL joins and cleaned a dataset',
 *   skills: [ { skillId: 'sql', mastery?: 45, delta?: 5, evidence?: '3 join exercises' }, ... ]
 * }
 * mastery sets the value (0-100), delta adds to it. Skills unknown to the catalog are ignored.
 */
export function applyDigest(save, body)
{
    const date = String(body.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new IntegrationError(400, 'bad-date')
    if(!Array.isArray(body.skills))
        throw new IntegrationError(400, 'bad-skills')

    const changes = []
    for(const item of body.skills)
    {
        if(!item || !SKILLS[item.skillId])
            continue
        const before = save.mastery[item.skillId] ?? 0
        let after = before
        if(Number.isFinite(item.mastery))
            after = item.mastery
        else if(Number.isFinite(item.delta))
            after = before + item.delta
        after = Math.max(0, Math.min(100, Math.round(after)))
        save.mastery[item.skillId] = after
        changes.push({ skillId: item.skillId, from: before, to: after, evidence: String(item.evidence ?? '').slice(0, 200) })
    }

    const digest = { date, summary: String(body.summary ?? '').slice(0, 1000), skills: changes, at: new Date().toISOString() }
    save.digests = [ digest, ...save.digests.filter((other) => other.date !== date) ].slice(0, MAX_DIGESTS)
    return digest
}
