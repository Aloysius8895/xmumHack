/**
 * MOCK hiring-demand months (prompt 07): fills the months before the first collected one, so skill and career demand
 * trends can be computed before three real months have accumulated. Mock data, labelled as such, never authored
 * numbers: every month is derived from real data by the method below, and real months always replace it
 * (skill-momentum.js stops reading it once MIN_MONTHS real months are comparable).
 *
 *   anchor   the latest collected month of the market window (market-window.js): shares, counts, postings, sample size
 *   trend    the big-picture direction of the skill or career (src/game/server/big-picture.js: WEF Future of Jobs
 *            Report 2025 and MyCOL, through the reviewed mapping), MAGNITUDE a year up or down; no change without one.
 *            Not the JobStreet 2024→2025 change: its two years were collected differently (within one occupation group
 *            chefs went from 0.07% to 0.62% of postings), and followed back it ranked teachers and chefs first.
 *   noise    a seeded, reproducible log-normal wobble of NOISE per month; 0: any wobble moves the computed trend
 *            itself (3% a month shifted a 10%-a-year direction by up to ±20 points over six months), so the trend
 *            would be the dice, not the direction
 *
 *   value(month) = anchor × e^(−growth × monthsBeforeAnchor / 12) × e^(NOISE × z(id, month))
 *
 * Shares keep four decimals: rounded to one, a share of 0.3% would move by a third from rounding alone, read as a trend.
 *
 * node src/data/scripts/mock-market-months.mjs   → data/mock/market-months.json
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { readWindow } from '../../game/server/market-window.js'
import { bigPicture } from '../../game/server/big-picture.js'

// Method parameters (assumptions, not data): how many months to fill and how much they wobble
export const MOCK_MONTHS = 5
export const NOISE = 0

const OUT = new URL('../../../data/mock/market-months.json', import.meta.url)

/** A reproducible standard normal from a text seed (FNV-1a hash, mulberry32, Box-Muller) */
function normal(seed)
{
    let hash = 2166136261
    for(const char of seed)
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
    const next = () =>
    {
        hash = (hash + 0x6D2B79F5) >>> 0
        let t = hash
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const [ u, v ] = [ next() || 1e-9, next() ]
    return Math.sqrt(- 2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const shift = (period, months) =>
{
    const [ year, month ] = period.split('-').map(Number)
    const index = year * 12 + month - 1 - months
    return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

const growthOf = (row) => typeof row?.growth === 'number' ? row.growth : 0

/** The mock months before the anchor; `trend` is big-picture.js: { skills: { id: { growth } }, careers: same } */
export function mockMonths(anchor, trend, months = MOCK_MONTHS, noise = NOISE)
{
    const value = (base, growth, id, period, back) => base * Math.exp(- growth * back / 12) * Math.exp(noise * normal(`${id}:${period}`))
    const out = []
    for(let back = months; back >= 1; back--)
    {
        const period = shift(anchor.period, back)
        const shares = Object.fromEntries(Object.entries(anchor.shares ?? {}).map(([ id, share ]) =>
            [ id, typeof share === 'number' && share > 0 ? Math.round(value(share, growthOf(trend.skills?.[id]), `skill:${id}`, period, back) * 10000) / 10000 : share ]))
        const counts = Object.fromEntries(Object.entries(anchor.counts ?? {}).map(([ id, count ]) =>
            [ id, count > 0 ? Math.max(1, Math.round(value(count, growthOf(trend.careers?.[id]), `career:${id}`, period, back))) : 0 ]))
        out.push({ period, mock: true, counts, shares, postings: anchor.postings, denominator: anchor.denominator, thin: false,
            metric: anchor.metric ?? 'postings_observed_in_month_within_window' })
    }
    return out
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
    const window = readWindow()
    const anchor = [ ...(window?.months ?? []) ].reverse().find((month) => Number.isInteger(month.denominator) && month.thin === false)
    if(!anchor)
        throw new Error('No collected month with a sample size to anchor the mock months on')
    const trend = bigPicture()
    const document = {
        mock: true,
        generator: 'src/data/scripts/mock-market-months.mjs',
        generatedAt: new Date().toISOString(),
        about: 'MOCK hiring-demand months, not collected data: derived from the latest collected month and the big-picture direction of each skill and career (WEF Future of Jobs Report 2025, MyCOL). Read by src/game/server/skill-momentum.js only for months without real data, and no longer once three real months are comparable. Every result using them is marked mock.',
        basis: { anchorPeriod: anchor.period, anchorRunId: anchor.runId ?? null,
            trend: 'src/game/server/big-picture.js (data/official-signals/wef-future-of-jobs-2025.json, data/official-signals/signals.json, src/data/config/wef-mapping.json reviewed entries)',
            directions: { skills: Object.fromEntries(Object.entries(trend.skills).map(([ id, row ]) => [ id, row.direction ])), careers: Object.fromEntries(Object.entries(trend.careers).map(([ id, row ]) => [ id, row.direction ])) } },
        parameters: { months: MOCK_MONTHS, noise: NOISE, magnitude: trend.magnitude },
        months: mockMonths(anchor, trend),
    }
    fs.mkdirSync(new URL('.', OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(document, null, 2) + '\n')
    console.log(`${document.months.length} mock months before ${anchor.period} → data/mock/market-months.json`)
}
