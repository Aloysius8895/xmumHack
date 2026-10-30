import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Last year's reference columns of the market heatmap: JobStreet Malaysia postings listed 2025-03-03 to 2025-05-08
 * (Hugging Face seemarn/jobstreet), counted per career by the crawler's own rules (src/data/scripts/jobstreet-reference.mjs).
 * Another platform and another period: shown beside this year's months with their own colour scale, never joined to
 * them, never in trends, momentum or scenarios. REFERENCE_MARKET_FILE=off hides it.
 */
const DEFAULT_FILE = fileURLToPath(new URL('../../../data/reference/jobstreet-2025/reference.json', import.meta.url))
const SHA256 = 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263'
const count = (value) => Number.isSafeInteger(value) && value >= 0
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
let cache = { signature: null, value: null }

/**
 * { id, platform, url, from, to, postings, months: [ 'YYYY-MM' ], partialMonth, careers: { careerId: { postings, share, byMonth } } },
 * throws on a malformed file. partialMonth: the last month, when the listings stop before its end.
 */
export function buildReference(data)
{
    const { source, period, postings, careers, months: monthCounts } = data ?? {}
    if(source?.sha256 !== SHA256 || !/^https:\/\/huggingface\.co\/datasets\//.test(source.url ?? '') || !count(postings) || !postings
        || !/^\d{4}-\d{2}-\d{2}$/.test(period?.from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(period?.to ?? '') || typeof careers !== 'object')
        throw new Error('reference-invalid')
    const rows = {}
    for(const [ id, row ] of Object.entries(careers))
    {
        if(!count(row.postings))
            throw new Error('reference-invalid-career')
        const byMonth = Object.fromEntries(Object.entries(row.byMonth ?? {}).filter(([ month, n ]) => MONTH.test(month) && count(n)))
        rows[id] = { postings: row.postings, share: Math.round(row.postings / postings * 1000) / 10, byMonth }
    }
    const months = Object.keys(monthCounts ?? {}).filter((month) => MONTH.test(month)).sort()
    const last = months.at(- 1)
    const lastDay = last ? new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5)), 0)).getUTCDate() : null
    const partialMonth = last && period.to.slice(0, 7) === last && Number(period.to.slice(8)) < lastDay ? last : null
    return { id: 'jobstreet-2025', platform: source.platform, url: source.url, from: period.from, to: period.to, postings, months, partialMonth, careers: rows }
}

export function referenceMarket(file = process.env.REFERENCE_MARKET_FILE ?? DEFAULT_FILE)
{
    if(file === 'off')
        return null
    try
    {
        const stat = fs.statSync(file)
        const signature = `${file}:${stat.mtimeMs}:${stat.size}`
        if(signature !== cache.signature)
            cache = { signature, value: buildReference(JSON.parse(fs.readFileSync(file, 'utf8'))) }
        return cache.value
    }
    catch
    {
        return null
    }
}
