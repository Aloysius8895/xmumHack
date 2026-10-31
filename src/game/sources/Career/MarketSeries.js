import { shiftMonth } from './MarketReference.js'

/** Resolve the same values for the heatmap, filters and ranking, with observations taking precedence. */
export function buildMarketRows(trends, shown, preview = { cells: {} })
{
    const period = shown.at(-1)
    if(!period) return []
    const previousPeriod = shiftMonth(period, -1)
    return trends.careers.map(career => {
        const valueAt = month => career.ads[trends.periods.indexOf(month)] ?? trends.careerObservations?.[career.id]?.[month]?.value ?? preview.cells[career.id]?.[month]?.value ?? null
        const latest = valueAt(period), previous = valueAt(previousPeriod)
        const archivedComparison = [period, previousPeriod].some(month =>
            career.ads[trends.periods.indexOf(month)] == null && trends.careerObservations?.[career.id]?.[month]?.origin === 'archived')
        const comparable = latest !== null && previous !== null && !archivedComparison
        const trend = !comparable ? 'unknown' : latest > previous ? 'rising' : latest < previous ? 'falling' : 'stable'
        return {
            ...career, latest, previous, previousPeriod, trend,
            change: comparable && previous > 0 ? Math.round((latest - previous) / previous * 1000) / 10 : null,
            changeOrigin: archivedComparison ? 'incomparable-archive' : !comparable ? null : preview.cells[career.id]?.[period] || preview.cells[career.id]?.[previousPeriod] ? 'preview' : 'observed',
            displayAds: shown.map(valueAt),
        }
    })
}

/** Skill sparklines follow the selected range; changes compare its endpoint with the preceding calendar month. */
export function buildSkillRows(trends, shown, mock = {})
{
    const period = shown.at(-1)
    if(!period) return []
    const previousPeriod = shiftMonth(period, -1)
    return trends.skills.map(skill => {
        const valueAt = month => skill.share[trends.periods.indexOf(month)] ?? mock[skill.id]?.[month] ?? null
        const latest = valueAt(period), previous = valueAt(previousPeriod)
        return { ...skill, latest, previousPeriod, series: shown.map(valueAt),
            points: latest !== null && previous !== null ? Math.round((latest - previous) * 10) / 10 : null }
    })
}
