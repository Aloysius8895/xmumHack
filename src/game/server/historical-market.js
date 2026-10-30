import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const defaultDirectory = fileURLToPath(new URL('../../data/historical/2026-04_onwards/', import.meta.url))
const reportUrl = 'https://www.dosm.gov.my/site/downloadrelease?id=big-data-analytics-job-market-insights-q22026&lang=English'
const SOURCES = {
    dosm: { id: 'dosm', seriesId: 'dosm_online_ads', url: 'https://www.dosm.gov.my/uploads/release-content/file_20260818075305.pdf' },
    techmap: { id: 'techmap', seriesId: 'techmap_new_postings', url: 'https://jobdatafeeds.com/data/countries/my' },
}
const count = value => Number.isSafeInteger(value) && value >= 0
let cached = null
let signature = ''

/** External aggregates remain separate from the project's career/skill observations. */
export function buildHistoricalMarket(monthly, quarterly)
{
    if(!Array.isArray(monthly) || !monthly.length || !Array.isArray(quarterly))
        throw new Error('historical-data-invalid')
    const keys = new Set()
    for(const row of monthly)
    {
        const source = SOURCES[row.source_id]
        const key = `${row.source_id}:${row.period}`
        if(!source || row.series_id !== source.seriesId || row.source_url !== source.url || row.country !== 'MY'
            || row.frequency !== 'monthly' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)
            || row.simulated !== false || row.eligible_for_project_career_skill_trends !== false
            || !(row.value === null || count(row.value)) || keys.has(key))
            throw new Error('historical-monthly-invalid')
        keys.add(key)
    }
    const periods = [...new Set(monthly.map(row => row.period))].sort()
    const series = Object.values(SOURCES).map(source => {
        const rows = monthly.filter(row => row.source_id === source.id)
        if(rows.length !== periods.length) throw new Error('historical-periods-incomplete')
        return { id: source.id, sourceUrl: source.url, values: periods.map(period => rows.find(row => row.period === period).value),
            sourceCounts: periods.map(period => {
                const value = rows.find(row => row.period === period).source_count
                return count(value) ? value : null
            }) }
    })
    const quarterKeys = new Set()
    for(const row of quarterly)
    {
        const key = `${row.period}:${row.occupation}`
        if(row.source_id !== 'dosm' || row.source_url !== reportUrl || row.frequency !== 'quarterly'
            || !/^\d{4}-Q[1-4]$/.test(row.period) || !/^[a-z_]+$/.test(row.occupation)
            || !['major_group', 'specific_occupation'].includes(row.aggregation_level) || !count(row.value)
            || row.simulated !== false || row.monthly_allocation !== null || row.project_career_mapping !== null || quarterKeys.has(key))
            throw new Error('historical-quarterly-invalid')
        quarterKeys.add(key)
    }
    return { periods, series, quarterly: { sourceUrl: reportUrl, periods: [...new Set(quarterly.map(row => row.period))].sort(),
        occupations: [...new Set(quarterly.map(row => row.occupation))].map(id => ({ id,
            values: [...new Set(quarterly.map(row => row.period))].sort().map(period => quarterly.find(row => row.period === period && row.occupation === id)?.value ?? null) })) } }
}

export function historicalMarket(root = process.env.HISTORICAL_MARKET_DIR ?? (process.env.SAVE_DIR || process.env.COLLECTED_DATA_DIR ? null : defaultDirectory))
{
    if(!root || root === 'off') return null
    try
    {
        const names = ['monthly_market_context.json', 'quarterly_occupation_context.json', 'verification.json']
        const files = names.map(name => path.join(root, name))
        const version = root + files.map(file => { const stat = fs.statSync(file); return `${stat.mtimeMs}:${stat.size}` }).join('|')
        if(signature === version) return cached
        const buffers = files.map(file => fs.readFileSync(file))
        const verification = JSON.parse(buffers[2].toString('utf8'))
        for(let i = 0; i < 2; i++)
            if(verification.artifact_sha256?.[names[i]] !== crypto.createHash('sha256').update(buffers[i]).digest('hex'))
                return null
        cached = { ...buildHistoricalMarket(...buffers.slice(0, 2).map(buffer => JSON.parse(buffer.toString('utf8')))), verifiedAt: verification.checked_at }
        signature = version
        return cached
    }
    catch { return null }
}

export function withHistoricalMarket(trends, historical = historicalMarket())
{
    if(!historical) return trends
    // Aggregate coverage does not establish monthly career or skill observations.
    return { ...trends, historical }
}
