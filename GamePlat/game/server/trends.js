import { allCareers, SKILLS } from './careers.js'
import * as store from './store.js'
import * as persistence from './persistence.js'

/**
 * Trends panel data: new job ads per career and month, and the share of ads asking for each skill
 * Live months are pushed once a month by the n8n workflow (POST /api/integrations/trends, receiveTrends below) and
 * kept in server/data/trends.json. Until the first push the panel shows DEMO_TRENDS, flagged as demo data.
 */
const MAX_MONTHS = 24
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/

const name = (en, zh, ms) => ({ zh, en, ms })

/** Authored demo numbers (NOT recruitment statistics), Apr - Sep 2026 */
export const DEMO_TRENDS = {
    source: 'demo',
    periods: [ '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09' ],
    careers: [
        { id: 'frontend-developer',    name: name('Frontend Developer', '前端工程师', 'Pembangun Frontend'),                ads: [ 400, 430, 410, 455, 480, 510 ] },
        { id: 'data-analyst',          name: name('Data Analyst', '数据分析师', 'Penganalisis Data'),                       ads: [ 300, 315, 345, 375, 410, 450 ] },
        { id: 'cloud-engineer',        name: name('Cloud Engineer', '云工程师', 'Jurutera Awan'),                           ads: [ 250, 265, 280, 300, 335, 365 ] },
        { id: 'ml-engineer',           name: name('AI Engineer', 'AI 工程师', 'Jurutera AI'),                               ads: [ 120, 145, 180, 220, 265, 320 ] },
        { id: 'cybersecurity-analyst', name: name('Cybersecurity Analyst', '网络安全分析师', 'Penganalisis Keselamatan Siber'), ads: [ 200, 210, 235, 260, 285, 310 ] },
        { id: 'ui-ux-designer',        name: name('UI/UX Designer', 'UI/UX 设计师', 'Pereka UI/UX'),                        ads: [ 260, 255, 250, 245, 240, 235 ] },
        { id: 'qa-engineer',           name: name('QA Engineer', '测试工程师', 'Jurutera QA'),                              ads: [ 180, 190, 195, 205, 215, 225 ] },
        { id: 'data-entry-clerk',      name: name('Data Entry Clerk', '数据录入员', 'Kerani Kemasukan Data'),               ads: [ 240, 230, 220, 205, 190, 175 ] },
    ],
    skills: [
        { id: 'sql',                share: [ 34, 35, 35, 36, 37, 38 ] },
        { id: 'python',             share: [ 28, 29, 31, 32, 34, 36 ] },
        { id: 'javascript',         share: [ 30, 30, 31, 31, 32, 32 ] },
        { id: 'excel',              share: [ 27, 26, 26, 25, 24, 24 ] },
        { id: 'cloud-deploy',       share: [ 18, 19, 21, 22, 24, 26 ] },
        { id: 'react',              share: [ 22, 23, 23, 24, 25, 25 ] },
        { id: 'ml-frameworks',      share: [ 9, 10, 12, 14, 16, 19 ] },
        { id: 'data-visualization', share: [ 15, 15, 16, 17, 17, 18 ] },
        { id: 'testing',            share: [ 14, 14, 15, 15, 16, 16 ] },
        { id: 'figma',              share: [ 12, 12, 11, 11, 11, 10 ] },
    ],
}

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
        return {
            demo: true,
            source: DEMO_TRENDS.source,
            collectedAt: null,
            periods: DEMO_TRENDS.periods,
            careers: withLinks(DEMO_TRENDS.careers),
            skills: DEMO_TRENDS.skills.map((skill) => ({ ...skill, name: skillName(skill.id) })),
        }

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
