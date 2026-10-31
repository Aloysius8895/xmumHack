/**
 * Demand momentum of skills and careers from the accumulated window's monthly shares (market-window.js), honest
 * about how little history there is: fewer than MIN_MONTHS comparable months is "current demand", never rising or
 * declining (the rule PyCon SG 2026's Career Snapshot SG won with: a single snapshot is never "declining").
 *
 * growth = annualised log growth: least-squares slope of log(share) per month, × 12. Shares, not counts: collecting
 * more often finds more adverts, it does not mean more demand. Official labels (official-signals.js) come first.
 *
 * Mock months (prompt 07, data/mock/market-months.json, src/data/scripts/mock-market-months.mjs) fill the months before
 * the collected ones while fewer than MIN_MONTHS real months are comparable; real months always win, and the mock is no
 * longer read once MIN_MONTHS real months exist. A result resting on a mock month is marked mock, and its confidence
 * counts the real months only.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readWindow } from './market-window.js'

export const MOCK_FILE = fileURLToPath(new URL('../../../data/mock/market-months.json', import.meta.url))

export const MIN_MONTHS = 3
export const RISING = 1.05      // D13, on the yearly factor e^growth
export const DECLINING = 0.95

const monthIndex = (period) => { const [ year, month ] = period.split('-').map(Number); return year * 12 + month }

/** Least-squares slope of y over x, null with fewer than two points */
export function slope(points)
{
    if(points.length < 2)
        return null
    const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const my = points.reduce((sum, p) => sum + p.y, 0) / points.length
    const sxx = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0)
    return sxx ? points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / sxx : null
}

export const label = (growth) => growth === null ? 'current' : Math.exp(growth) > RISING ? 'rising' : Math.exp(growth) < DECLINING ? 'declining' : 'stable'
const confidence = (months) => months >= 6 ? 'high' : months >= MIN_MONTHS ? 'medium' : 'low'

/**
 * Months that may be compared with the latest one: same sources, a known and large enough described sample.
 * Months written before the window existed have no denominator: their sample size is unknown, so they are left out.
 */
export function comparableMonths(months = [])
{
    const latest = months.at(-1)
    if(!latest)
        return []
    const sources = JSON.stringify([ ...(latest.sources ?? []) ].sort())
    return months.filter((month) => Number.isInteger(month.denominator) && month.thin === false && JSON.stringify([ ...(month.sources ?? []) ].sort()) === sources)
}

function series(months, value)
{
    const points = []
    for(const month of months)
    {
        const share = value(month)
        if(share > 0)   // log(0) is undefined: a month without the skill is left out of the regression
            points.push({ x: monthIndex(month.period), y: Math.log(share), mock: month.mock === true })
    }
    const perMonth = points.length >= MIN_MONTHS ? slope(points) : null
    const growth = perMonth === null ? null : Math.round(perMonth * 12 * 10000) / 10000
    const mockMonths = points.filter((point) => point.mock).length
    return { growth, label: label(growth), confidence: confidence(points.length - mockMonths), months: points.length,
        ...(mockMonths ? { mock: true, mockMonths } : {}) }
}

/**
 * The comparable real months, preceded by the mock months of periods without real data while fewer than MIN_MONTHS
 * real months exist. Mock months take the sources and sample size of the latest real month, so they compare with it.
 */
export function withMockMonths(real, mockMonths = [])
{
    const latest = real.at(-1)
    if(!latest || real.length >= MIN_MONTHS || !mockMonths.length)
        return real
    const periods = new Set(real.map((month) => month.period))
    const filled = mockMonths
        .filter((month) => !periods.has(month.period) && monthIndex(month.period) < monthIndex(latest.period))
        .map((month) => ({ ...month, mock: true, sources: latest.sources, denominator: latest.denominator, thin: false }))
    return [ ...filled, ...real ].sort((a, b) => monthIndex(a.period) - monthIndex(b.period))
}

/**
 * { skills: { id: { growth, label, confidence, months, official } }, careers: same, basis: { months, from, through, sources } }
 * official: the official signals of that id (emerging / critical / declining with source and date), first in the UI
 */
export function momentumFrom(window, { official = [], mockMonths = [] } = {})
{
    const real = comparableMonths(window?.months)
    const months = withMockMonths(real, mockMonths)
    const latest = window?.months?.at(-1)
    const officialFor = (kind, id) => official.filter((signal) => signal.kind === kind && signal.id === id)
    const skills = {}
    for(const id of Object.keys(latest?.shares ?? {}))
        skills[id] = { ...series(months, (month) => month.shares?.[id]), official: officialFor('skill', id) }
    const careers = {}
    for(const id of Object.keys(latest?.counts ?? {}))
        careers[id] = { ...series(months, (month) => month.postings ? month.counts[id] / month.postings * 100 : null), official: officialFor('career', id) }
    return {
        skills,
        careers,
        basis: { months: months.length, realMonths: real.length, mockMonths: months.length - real.length, from: months[0]?.period ?? null,
            through: months.at(-1)?.period ?? null, sources: latest?.sources ?? [], metric: 'share_of_described_postings' },
    }
}

let lastGood = null

/** The mock months of data/mock/market-months.json, none when the file is missing or unreadable */
export function loadMockMonths(file = MOCK_FILE)
{
    try
    {
        const document = JSON.parse(fs.readFileSync(file, 'utf8'))
        return document.mock === true && Array.isArray(document.months) ? document.months.filter((month) => month.mock === true && /^\d{4}-\d{2}$/.test(month.period)) : []
    }
    catch
    {
        return []
    }
}

/** The current momentum; a failure keeps the last good result instead of throwing */
export function currentMomentum(options = {})
{
    try
    {
        lastGood = momentumFrom(readWindow(), { mockMonths: loadMockMonths(), ...options })
    }
    catch
    {
        // keep lastGood
    }
    return lastGood ?? momentumFrom(null, options)
}
