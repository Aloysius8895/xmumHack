import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DATASETS } from './reference-market.js'

/**
 * Year-on-year change of JobStreet shares, the same calendar window in 2024 and 2025 (src/data/scripts/jobstreet-yoy.mjs),
 * each year weighted to DOSM's occupation structure of its quarter, with 95% margins; skills as their share of all
 * skill mentions. A change within the margins is no clear change.
 *
 * Shown to players only (heatmap, career and skill pages), not used by the scenario model: two points from different
 * collectors are too weak to extrapolate. REFERENCE_TREND_FILE=off turns it off.
 */
const DEFAULT_FILE = fileURLToPath(new URL('../../../data/reference/jobstreet-yoy.json', import.meta.url))
const DAY = /^\d{4}-\d{2}-\d{2}$/
let cache = { signature: null, value: null }

const finite = (value) => typeof value === 'number' && Number.isFinite(value)

/** { window, metrics, sources, careers: { id: row }, skills: { id: row } }, rows with growth null when thin; throws when malformed */
export function buildTrend(data)
{
    const { sources, window, careers, skills, metrics } = data ?? {}
    const pinned = Object.values(DATASETS)
    if(!Array.isArray(sources) || sources.length !== 2 || !sources.every((source) => pinned.includes(source.sha256))
        || !DAY.test(window?.from ?? '') || !DAY.test(window?.to ?? '') || !Array.isArray(window?.periods) || typeof careers !== 'object' || typeof skills !== 'object')
        throw new Error('trend-invalid')
    const rows = (block) => Object.fromEntries(Object.entries(block).map(([ id, row ]) =>
    {
        if(row.growth !== null && !finite(row.growth))
            throw new Error('trend-invalid-row')
        return [ id, { from: row.from, to: row.to, points: row.points ?? null, growth: row.growth ?? null, significant: row.significant === true, reason: row.reason ?? null } ]
    }))
    return { window, metrics: metrics ?? null, sources: sources.map(({ id, name, url, licence, author }) => ({ id, name, url, licence, author })),
        careers: rows(careers), skills: rows(skills) }
}

export function referenceTrend(file = process.env.REFERENCE_TREND_FILE ?? DEFAULT_FILE)
{
    if(file === 'off')
        return null
    try
    {
        const stat = fs.statSync(file)
        const signature = `${file}:${stat.mtimeMs}:${stat.size}`
        if(signature !== cache.signature)
            cache = { signature, value: buildTrend(JSON.parse(fs.readFileSync(file, 'utf8'))) }
        return cache.value
    }
    catch
    {
        return null
    }
}
