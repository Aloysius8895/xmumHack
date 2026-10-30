/**
 * Demand momentum of skills and careers from the accumulated window's monthly shares (market-window.js), honest
 * about how little history there is: fewer than MIN_MONTHS comparable months is "current demand", never rising or
 * declining (the rule PyCon SG 2026's Career Snapshot SG won with: a single snapshot is never "declining").
 *
 * growth = annualised log growth: least-squares slope of log(share) per month, × 12. Shares, not counts: collecting
 * more often finds more adverts, it does not mean more demand. Official labels (official-signals.js) come first.
 */
import { readWindow } from './market-window.js'

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
            points.push({ x: monthIndex(month.period), y: Math.log(share) })
    }
    const perMonth = points.length >= MIN_MONTHS ? slope(points) : null
    const growth = perMonth === null ? null : Math.round(perMonth * 12 * 10000) / 10000
    return { growth, label: label(growth), confidence: confidence(points.length), months: points.length }
}

/**
 * { skills: { id: { growth, label, confidence, months, official } }, careers: same, basis: { months, from, through, sources } }
 * official: the official signals of that id (emerging / critical / declining with source and date), first in the UI
 */
export function momentumFrom(window, { official = [] } = {})
{
    const months = comparableMonths(window?.months)
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
        basis: { months: months.length, from: months[0]?.period ?? null, through: months.at(-1)?.period ?? null, sources: latest?.sources ?? [], metric: 'share_of_described_postings' },
    }
}

let lastGood = null

/** The current momentum; a failure keeps the last good result instead of throwing */
export function currentMomentum(options = {})
{
    try
    {
        lastGood = momentumFrom(readWindow(), options)
    }
    catch
    {
        // keep lastGood
    }
    return lastGood ?? momentumFrom(null, options)
}
