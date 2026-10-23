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
const MARKET_HISTORY = 26 // snapshots kept, half a year of weekly runs

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
 *   period: '2026-10-19',                    // week (its Monday, YYYY-MM-DD, what the n8n workflow sends) or month (YYYY-MM)
 *   source: 'linkedin+indeed',               // free text, shown nowhere but kept for traceability
 *   collectedAt: '2026-10-21T08:00:00Z',     // optional
 *   careers: {
 *     'data-analyst': { postings: 1240, change?: 3, note?: { zh, en, ms } | 'text', topSkills?: { sql: 820, python: 610 } },
 *     ...
 *   }
 * }
 * change (% vs the previous period) is computed from postings when it isn't given.
 * backfilled: true marks a week rebuilt from posting dates (n8n/market/run-local.mjs --backfill), never compared.
 * Every period is kept as history (the last MARKET_HISTORY), the careers panel draws it as the weekly trend.
 */
export function receiveMarket(body)
{
    if(body.collection && body.collection.complete !== true)
        throw new IntegrationError(400, 'incomplete-collection')
    const period = String(body.period ?? '')
    if(!/^\d{4}-\d{2}(-\d{2})?$/.test(period))
        throw new IntegrationError(400, 'bad-period')
    if(!body.careers || typeof body.careers !== 'object')
        throw new IntegrationError(400, 'bad-careers')

    const known = new Set(CAREERS.map((career) => career.id))
    const market = store.loadMarket()
    // One snapshot per period, oldest first: a new period is appended, the same period is a correction
    const history = (market.history ?? [ market.previous, market.latest ].filter(Boolean)).filter((snapshot) => snapshot.period !== period)

    const careers = {}
    for(const [ id, value ] of Object.entries(body.careers))
    {
        if(!known.has(id) || typeof value !== 'object' || value === null)
            continue
        const note = typeof value.note === 'string' ? { zh: value.note, en: value.note, ms: value.note } : value.note
        careers[id] = {
            postings: Number.isFinite(value.postings) ? Math.max(0, Math.round(value.postings)) : null,
            givenChange: Number.isFinite(value.change) ? Math.round(value.change) : null,
            change: null,
            note: note && typeof note === 'object' ? { zh: String(note.zh ?? note.en ?? '').slice(0, 200), en: String(note.en ?? note.zh ?? '').slice(0, 200), ms: String(note.ms ?? note.en ?? '').slice(0, 200) } : null,
            topSkills: value.topSkills && typeof value.topSkills === 'object'
                ? Object.fromEntries(Object.entries(value.topSkills).filter(([ skill, count ]) => SKILLS[skill] && Number.isFinite(count)).map(([ skill, count ]) => [ skill, Math.round(count) ]))
                : {},
        }
    }
    if(!Object.keys(careers).length)
        throw new IntegrationError(400, 'no-known-career')

    const collectedAt = String(body.collectedAt ?? new Date().toISOString())
    const collection = recordCollection(market, body.collection, careers, collectedAt)
    const snapshot = { period, backfilled: body.backfilled === true, source: String(body.source ?? '').slice(0, 120), collectedAt, receivedAt: new Date().toISOString(), careers, ...(collection ? { collection } : {}) }
    history.push(snapshot)
    history.sort((a, b) => a.period.localeCompare(b.period))
    history.splice(0, Math.max(0, history.length - MARKET_HISTORY))
    computeChanges(history)
    store.saveMarket({ latest: history.at(- 1), previous: history.at(- 2) ?? null, history, ...(market.jobArchive ? { jobArchive: market.jobArchive } : {}) })
    return { period, careers: Object.keys(careers), ...(collection ? { collection } : {}) }
}

// Template #10918's historical identity comparison, without removing known jobs from weekly samples.
// Persist fingerprints and counts, never descriptions or recruiter details. Keep the last 50,000 identities.
function recordCollection(market, collection, careers, collectedAt)
{
    if(!collection)
        return null
    if(collection.source !== 'jsearch' || !Array.isArray(collection.records) || collection.records.length > 20000 || !Number.isInteger(collection.expectedQueries) || collection.expectedQueries < 1 || collection.successfulQueries !== collection.expectedQueries)
        throw new IntegrationError(400, 'bad-collection')
    const archive = { ...(market.jobArchive ?? {}) }
    const unique = new Set()
    const perCareer = {}
    let newJobs = 0
    for(const record of collection.records)
    {
        if(!record || !careers[record.careerId] || typeof record.id !== 'string' || !record.id || record.id.length > 2000)
            throw new IntegrationError(400, 'bad-collection-record')
        const fingerprint = crypto.createHash('sha256').update(`${collection.source}:${record.id}`).digest('hex')
        const sampleKey = `${record.careerId}:${fingerprint}`
        if(perCareer[sampleKey])
            throw new IntegrationError(400, 'duplicate-collection-record')
        perCareer[sampleKey] = true
        perCareer[record.careerId] = (perCareer[record.careerId] ?? 0) + 1
        if(!unique.has(fingerprint))
        {
            if(!archive[fingerprint])
                newJobs++
            archive[fingerprint] = { firstSeen: archive[fingerprint]?.firstSeen ?? collectedAt, lastSeen: collectedAt }
            unique.add(fingerprint)
        }
    }
    if(Object.entries(careers).some(([ id, career ]) => career.postings !== (perCareer[id] ?? 0)))
        throw new IntegrationError(400, 'collection-count-mismatch')
    market.jobArchive = Object.fromEntries(Object.entries(archive).sort((a, b) => a[1].lastSeen.localeCompare(b[1].lastSeen)).slice(-50000))
    return { source: collection.source, country: String(collection.country ?? '').slice(0, 10), window: String(collection.window ?? '').slice(0, 20), numPages: collection.numPages, complete: true, expectedQueries: collection.expectedQueries, successfulQueries: collection.successfulQueries, uniqueJobs: unique.size, newJobs, seenJobs: unique.size - newJobs }
}

export function chatReceipt(save, body, content)
{
    if(!body.messageId)
        return null // compatibility for existing direct integrations
    if(typeof body.from !== 'string' || !body.from || typeof body.messageId !== 'string' || body.messageId.length > 200)
        throw new IntegrationError(400, 'bad-message-id')
    const key = crypto.createHash('sha256').update(JSON.stringify([ body.channel, body.from, body.messageId ])).digest('hex')
    const fingerprint = crypto.createHash('sha256').update(content).digest('hex')
    const previous = save.integrationReceipts?.[key]
    if(previous && previous.fingerprint !== fingerprint)
        throw new IntegrationError(409, 'message-id-conflict')
    return { key, fingerprint, previous: previous?.result }
}

export function rememberChat(save, receipt, result)
{
    if(receipt)
    {
        const entries = Object.entries(save.integrationReceipts ?? {})
        save.integrationReceipts = Object.fromEntries([ ...entries.slice(-4999), [ receipt.key, { fingerprint: receipt.fingerprint, result } ] ])
    }
    return result
}

/**
 * change of every career in every snapshot: the one pushed, or postings vs the snapshot before that has the career.
 * Recomputed on each push since a late or corrected period changes its neighbours. A backfilled snapshot
 * (rebuilt from posting dates, older weeks miss the postings taken down) is never compared: change null.
 */
function computeChanges(history)
{
    history.forEach((snapshot, index) =>
    {
        for(const [ id, career ] of Object.entries(snapshot.careers))
        {
            const before = history.slice(0, index).reverse().find((item) => item.careers[id])
            const comparable = before && !before.backfilled && !snapshot.backfilled && before.careers[id].postings > 0 && career.postings !== null
            career.change = Number.isFinite(career.givenChange) ? career.givenChange
                : comparable ? Math.round((career.postings - before.careers[id].postings) / before.careers[id].postings * 100)
                : before || snapshot.backfilled ? null : 0
        }
    })
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

    const existing = save.digests.find((digest) => digest.date === date)
    if(existing)
        return existing // retried daily jobs must not apply delta twice
    if(save.digestAppliedDates?.includes(date))
        return { date, summary: '', skills: [], duplicate: true }

    const changes = []
    for(const item of body.summaryOnly === true ? [] : body.skills)
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
    save.digestAppliedDates = [ ...new Set([ ...(save.digestAppliedDates ?? []), ...save.digests.map((item) => item.date), date ]) ]
    save.digests = [ digest, ...save.digests.filter((other) => other.date !== date) ].slice(0, MAX_DIGESTS)
    return digest
}
