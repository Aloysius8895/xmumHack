const count = value => Number.isSafeInteger(value) && value >= 0
const monthIndex = period => Number(period.slice(0, 4)) * 12 + Number(period.slice(5)) - 1

// Authored preview trajectories, not measured occupation growth rates.
const GROWTH = {
    'forward-deployed-engineer': 0.2,
    'ml-engineer': 0.15, 'data-scientist': 0.11, 'data-analyst': 0.06,
    'frontend-developer': 0.035, 'backend-developer': 0.075, 'ui-ux-designer': -0.045,
    'product-manager': 0.055, auditor: -0.025, lawyer: 0.02, teacher: 0.04,
    doctor: 0.015, 'civil-engineer': -0.035, chef: -0.07,
}

/**
 * User-authorized mock backfill, formerly shown in the heatmap. The game no longer displays it (decision D5: months without
 * collected data stay empty); only the offline exports in src/data/scripts still use it. Observations remain authoritative.
 */
export function buildMockMarketHistory(trends = {}, shown = [])
{
    const result = { method: 'seeded-career-profile-v1', count: 0, cells: Object.create(null) }
    if(!Array.isArray(trends.periods) || !shown.length) return result
    const periods = shown.filter(period => /^\d{4}-(0[1-9]|1[0-2])$/.test(period)).sort()
    if(!periods.length) return result
    for(const career of trends.careers ?? [])
    {
        const seed = [...career.id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0)
        const ads = career.ads ?? []
        const anchorIndex = ads.findLastIndex(count)
        const anchorPeriod = anchorIndex < 0 ? periods.at(-1) : trends.periods[anchorIndex]
        const anchorValue = anchorIndex < 0 ? 20 + seed % 35 : ads[anchorIndex]
        const anchor = monthIndex(anchorPeriod)
        const growth = GROWTH[career.id] ?? (seed % 9 - 4) / 100
        const wave = month => 1 + 0.06 * Math.sin((month + seed % 12) * 1.6)
        for(const period of periods)
        {
            if(period > anchorPeriod || count(ads[trends.periods.indexOf(period)]) || count(trends.careerObservations?.[career.id]?.[period]?.value)) continue
            const month = monthIndex(period)
            const value = Math.round(anchorValue * Math.exp(-growth * (anchor - month)) * wave(month) / wave(anchor))
            if(!count(value)) continue
            result.cells[career.id] ??= Object.create(null)
            result.cells[career.id][period] = { value, mock: true, anchorPeriod, anchorValue }
            result.count++
        }
    }
    return result
}
