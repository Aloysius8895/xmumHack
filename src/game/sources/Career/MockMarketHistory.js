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
 * User-authorized mock backfill of the heatmap's empty months (user decision 2026-10-30): display only, unlabelled on
 * screen but marked data-origin="mock"; never used by trends, rising / falling, sorting, the update log or the scenario
 * model. Observations remain authoritative.
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

/**
 * Simulated share (%) of each skill in the months it has no collected value, display only like the career cells:
 * { skillId: { period: share } }, anchored on its latest collected share, a fixed and repeatable path per skill
 */
export function buildMockSkillHistory(trends = {}, months = [])
{
    const result = Object.create(null)
    const periods = trends.periods ?? []
    for(const skill of trends.skills ?? [])
    {
        const anchorIndex = (skill.share ?? []).findLastIndex((value) => typeof value === 'number')
        if(anchorIndex < 0)
            continue
        const seed = [ ...skill.id ].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0)
        const anchor = monthIndex(periods[anchorIndex]), anchorValue = skill.share[anchorIndex]
        const growth = (seed % 11 - 4) / 100   // -4% to +6% a month
        const wave = (month) => 1 + 0.05 * Math.sin((month + seed % 12) * 1.3)
        for(const period of months)
        {
            if(typeof skill.share[periods.indexOf(period)] === 'number')
                continue
            const month = monthIndex(period)
            result[skill.id] ??= Object.create(null)
            result[skill.id][period] = Math.max(0, Math.round(anchorValue * Math.exp(- growth * (anchor - month)) * wave(month) / wave(anchor) * 10) / 10)
        }
    }
    return result
}
