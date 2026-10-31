const count = value => Number.isSafeInteger(value) && value >= 0
const monthIndex = period => Number(period.slice(0, 4)) * 12 + Number(period.slice(5)) - 1

// Method parameters (assumptions, not data): the size of the seeded monthly wobble of careers and skills
export const CAREER_WAVE = 0.06
export const SKILL_WAVE = 0.05

/** Monthly log growth from the big-picture direction (trends.bigPicture, server/big-picture.js: WEF 2025, MyCOL), none without one */
const monthly = (row) => typeof row?.growth === 'number' ? row.growth / 12 : 0
const seedOf = (id) => [ ...id ].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0)

/**
 * Mock backfill of the heatmap's empty months (user decisions 2026-10-30 and prompt 07): marked data-origin="mock",
 * derived from data, never authored. Trend: the career's big-picture direction (trends.bigPicture: WEF Future of Jobs
 * Report 2025 and MyCOL; no change without one), as the server's mock months. Level: its latest collected count; for a
 * career never collected, its JobStreet 2025 share of the collected careers' postings in the latest collected month (no
 * cell without one). A seeded wave of CAREER_WAVE, for display only.
 * Observations remain authoritative.
 */
export function buildMockMarketHistory(trends = {}, shown = [])
{
    const result = { method: 'yoy-anchored-v2', count: 0, cells: Object.create(null) }
    if(!Array.isArray(trends.periods) || !shown.length) return result
    const periods = shown.filter(period => /^\d{4}-(0[1-9]|1[0-2])$/.test(period)).sort()
    if(!periods.length) return result
    const yoy = trends.yearOnYear?.careers ?? {}
    // The latest collected month and the JobStreet share of the careers collected in it, for the careers never collected
    const latestIndex = Math.max(-1, ...(trends.careers ?? []).map(career => (career.ads ?? []).findLastIndex(count)))
    const collected = (trends.careers ?? []).filter(career => count(career.ads?.[latestIndex]) && typeof yoy[career.id]?.to?.share === 'number')
    const collectedAds = collected.reduce((sum, career) => sum + career.ads[latestIndex], 0)
    const collectedShare = collected.reduce((sum, career) => sum + yoy[career.id].to.share, 0)
    for(const career of trends.careers ?? [])
    {
        const seed = seedOf(career.id)
        const ads = career.ads ?? []
        const anchorIndex = ads.findLastIndex(count)
        const share = yoy[career.id]?.to?.share
        const derived = anchorIndex < 0 && latestIndex >= 0 && collectedShare > 0 && typeof share === 'number'
        if(anchorIndex < 0 && !derived) continue
        const anchorPeriod = anchorIndex < 0 ? trends.periods[latestIndex] : trends.periods[anchorIndex]
        const anchorValue = anchorIndex < 0 ? Math.round(collectedAds * share / collectedShare) : ads[anchorIndex]
        const anchor = monthIndex(anchorPeriod)
        const growth = monthly(trends.bigPicture?.careers?.[career.id])
        const wave = month => 1 + CAREER_WAVE * Math.sin((month + seed % 12) * 1.6)
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
 * Mock share (%) of each skill in the months it has no collected value, like the career cells: { skillId: { period:
 * share } }, anchored on its latest collected share, following its big-picture direction (none without one) with a
 * seeded wave of SKILL_WAVE
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
        const seed = seedOf(skill.id)
        const anchor = monthIndex(periods[anchorIndex]), anchorValue = skill.share[anchorIndex]
        const growth = monthly(trends.bigPicture?.skills?.[skill.id])
        const wave = (month) => 1 + SKILL_WAVE * Math.sin((month + seed % 12) * 1.3)
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
