import { allCareers, SKILLS } from './careers.js'
import * as store from './store.js'
import * as persistence from './persistence.js'

/**
 * Trends panel data: new job ads per career and month, and the share of ads asking for each skill
 * Live months are pushed once a month by the n8n workflow (POST /api/integrations/trends, receiveTrends below) and
 * kept in server/data/trends.json. Until the first push there is no month (empty: true), never authored numbers.
 */
const MAX_MONTHS = 24
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/

function localized(value, fallback)
{
    if(typeof value === 'string' && value.trim())
        return { zh: value.trim(), en: value.trim(), ms: value.trim() }
    if(value && typeof value === 'object' && (value.en || value.zh || value.ms))
    {
        const en = String(value.en ?? value.zh ?? value.ms).slice(0, 80)
        return { zh: String(value.zh ?? en).slice(0, 80), en, ms: String(value.ms ?? en).slice(0, 80) }
    }
    return fallback
}

const catalogName = (id) => allCareers().find((career) => career.id === id)?.name ?? null
const titleCase = (id) => id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

/**
 * One month from the workflow
 * body: {
 *   period: '2026-09',                        // month, YYYY-MM
 *   source: 'n8n:jsearch',                    // free text, kept for traceability
 *   collectedAt: '2026-10-01T00:00:00Z',      // optional
 *   careers: { 'data-analyst': { ads: 450, name?: 'Data Analyst' | { zh, en, ms } }, ... },   // new job ads that month
 *   skills:  { 'sql': { share: 38, name?: ... }, ... },                                       // optional, % of the ads asking for it
 * }
 * Any career id is accepted (careers outside the catalog are shown, catalog ones link to their card).
 * The same period again replaces it (a correction), the last MAX_MONTHS months are kept.
 */
export async function receiveTrends(body, IntegrationError)
{
    const period = String(body?.period ?? '')
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
        throw new IntegrationError(400, 'bad-period')
    if(!body.careers || typeof body.careers !== 'object' || Array.isArray(body.careers))
        throw new IntegrationError(400, 'bad-careers')

    const careers = []
    for(const [ id, value ] of Object.entries(body.careers))
    {
        const ads = Number(value?.ads)
        if(ID.test(id) && Number.isFinite(ads) && ads >= 0)
            careers.push({ id, name: localized(value.name, null), ads: Math.round(ads) })
    }
    if(!careers.length)
        throw new IntegrationError(400, 'bad-careers')

    const skills = []
    for(const [ id, value ] of Object.entries(body.skills && typeof body.skills === 'object' ? body.skills : {}))
    {
        const share = Number(value?.share)
        if(ID.test(id) && Number.isFinite(share) && share >= 0 && share <= 100)
            skills.push({ id, name: localized(value.name, null), share: Math.round(share * 10) / 10 })
    }

    const savedTrends = await persistence.loadDocument('trends')
    const data = savedTrends.payload
    const months = data.months.filter((month) => month.period !== period)
    months.push({
        period,
        source: String(body.source ?? '').slice(0, 80),
        collectedAt: typeof body.collectedAt === 'string' ? body.collectedAt.slice(0, 40) : new Date().toISOString(),
        careers,
        skills,
    })
    months.sort((a, b) => a.period.localeCompare(b.period))
    await persistence.saveDocument('trends', { months: months.slice(- MAX_MONTHS) }, savedTrends.version)

    return { period, careers: careers.map((career) => career.id), skills: skills.map((skill) => skill.id), months: Math.min(months.length, MAX_MONTHS) }
}

/**
 * What the client gets: { demo, source, collectedAt, periods, careers: [ { id, careerId, name, ads: [ per period, null = missing ] } ], skills: same with share }
 * careerId is set when the id is a catalog career (the row opens its card)
 */
export function trendsView(data = store.loadTrends())
{
    const known = new Set(allCareers().map((career) => career.id))
    const withLinks = (careers) => careers.map((career) => ({ ...career, careerId: known.has(career.id) ? career.id : null }))
    const skillName = (id, given) => given ?? SKILLS[id] ?? { zh: titleCase(id), en: titleCase(id), ms: titleCase(id) }

    if(!data.months.length)
        return { demo: false, empty: true, source: null, collectedAt: null, periods: [], careers: [], skills: [] }

    const periods = data.months.map((month) => month.period)
    const series = (key, value, label) =>
    {
        const rows = new Map()
        data.months.forEach((month, index) =>
        {
            for(const item of month[key])
            {
                if(!rows.has(item.id))
                    rows.set(item.id, { id: item.id, name: null, [value]: periods.map(() => null) })
                const row = rows.get(item.id)
                row.name = item.name ?? row.name
                row[value][index] = item[value]
            }
        })
        return [ ...rows.values() ].map((row) => ({ ...row, name: label(row.id, row.name) }))
    }
    const latest = data.months[data.months.length - 1]

    return {
        demo: false,
        source: latest.source,
        collectedAt: latest.collectedAt,
        periods,
        careers: withLinks(series('careers', 'ads', (id, given) => given ?? catalogName(id) ?? { zh: titleCase(id), en: titleCase(id), ms: titleCase(id) })),
        skills: series('skills', 'share', skillName),
    }
}
