/** Resolve the same values for the heatmap, filters and ranking, with observations taking precedence. */
export function buildMarketRows(trends, shown, preview = { cells: {} })
{
    const period = trends.periods.at(-1)
    const previousPeriod = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)) - 2, 1)).toISOString().slice(0, 7)
    return trends.careers.map(career => {
        const valueAt = month => career.ads[trends.periods.indexOf(month)] ?? trends.careerObservations?.[career.id]?.[month]?.value ?? preview.cells[career.id]?.[month]?.value ?? null
        const latest = valueAt(period), previous = valueAt(previousPeriod)
        const archivedComparison = trends.careerObservations?.[career.id]?.[previousPeriod]?.origin === 'archived'
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
