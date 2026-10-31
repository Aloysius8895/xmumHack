import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Past months of the market heatmap from JobStreet Malaysia datasets on Hugging Face, counted per career by the
 * crawler's own rules (src/data/scripts/jobstreet-reference.mjs), inside each dataset's collection window.
 * Another platform and other collectors than this year's months: shown as shares of each month's sample with their
 * own colour scale, never joined to this year's counts. REFERENCE_MARKET_DIR=off hides them.
 */
const DEFAULT_DIRECTORY = fileURLToPath(new URL('../../../data/reference/', import.meta.url))
// The pinned file of each dataset: a reference built from anything else is refused
export const DATASETS = {
    'jobstreet-2024': '4bdd026944f1c2527402ca5ee7b83d63b3a82e6acaa4c78898a9ee90430b45c7',
    'jobstreet-2025': 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263',
}
const count = (value) => Number.isSafeInteger(value) && value >= 0
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const cache = new Map()

/**
 * { id, platform, url, licence, author, from, to, postings, months: [ 'YYYY-MM' ], monthTotals: { month: n },
 *   partialMonths, careers: { careerId: { postings, share, byMonth } } }, throws on a malformed file.
 * partialMonths: months the collection window cuts (their shares hold, their counts cover part of the month).
 */
export function buildReference(data, id)
{
    const { source, period, postings, careers, months: monthCounts } = data ?? {}
    if(!DATASETS[id] || source?.sha256 !== DATASETS[id] || !/^https:\/\/huggingface\.co\/datasets\//.test(source.url ?? '') || !count(postings) || !postings
        || !DAY.test(period?.from ?? '') || !DAY.test(period?.to ?? '') || typeof careers !== 'object')
        throw new Error('reference-invalid')
    const monthTotals = Object.fromEntries(Object.entries(monthCounts ?? {}).filter(([ month, n ]) => MONTH.test(month) && count(n) && n > 0))
    const months = Object.keys(monthTotals).sort()
    const rows = {}
    for(const [ careerId, row ] of Object.entries(careers))
    {
        if(!count(row.postings))
            throw new Error('reference-invalid-career')
        const byMonth = Object.fromEntries(Object.entries(row.byMonth ?? {}).filter(([ month, n ]) => monthTotals[month] && count(n)))
        rows[careerId] = { postings: row.postings, share: Math.round(row.postings / postings * 1000) / 10, byMonth }
    }
    return { id, platform: source.platform, url: source.url, licence: source.licence ?? null, author: source.author ?? null,
        from: period.from, to: period.to, postings, months, monthTotals,
        partialMonths: (period.partialMonths ?? []).filter((month) => monthTotals[month]), careers: rows }
}

function load(id, file)
{
    try
    {
        const stat = fs.statSync(file)
        const signature = `${stat.mtimeMs}:${stat.size}`
        if(cache.get(file)?.signature !== signature)
            cache.set(file, { signature, value: buildReference(JSON.parse(fs.readFileSync(file, 'utf8')), id) })
        return cache.get(file).value
    }
    catch
    {
        return null
    }
}

/** The valid datasets, oldest first */
export function referenceMarkets(directory = process.env.REFERENCE_MARKET_DIR ?? DEFAULT_DIRECTORY)
{
    if(directory === 'off')
        return []
    return Object.keys(DATASETS).map((id) => load(id, `${directory}/${id}/reference.json`)).filter(Boolean)
        .sort((a, b) => a.from.localeCompare(b.from))
}
