import { loadMarket } from './store.js'

/**
 * Market snapshots pushed by the job market workflow (POST /api/integrations/market, server/integrations.js).
 * Without a pushed snapshot there is no value: nothing authored stands in for recruitment statistics.
 */

/**
 * Latest market snapshot of a career for the careers panel: the live one pushed by the workflow, with its weekly
 * history ([ { period, postings, change, topSkills, backfilled } ] oldest first, change null when not comparable),
 * or null without one
 */
export function marketSnapshot(careerId, market = loadMarket())
{
    const live = market.latest?.careers?.[careerId]
    if(live)
    {
        const history = (market.history ?? [ market.previous, market.latest ].filter(Boolean))
            .filter((snapshot) => snapshot.careers?.[careerId])
            .map((snapshot) => ({ period: snapshot.period, postings: snapshot.careers[careerId].postings, change: snapshot.careers[careerId].change ?? null, topSkills: snapshot.careers[careerId].topSkills ?? {}, backfilled: snapshot.backfilled === true }))
        return { period: market.latest.period, change: live.change, note: live.note, postings: live.postings, topSkills: live.topSkills, history, live: true }
    }

    return null
}

/**
 * Skill popularity: share of the postings asking for each skill (%), in the last SKILL_TREND_WEEKS snapshots
 * versus the SKILL_TREND_WEEKS before, change in percentage points. careerId null = every career together.
 * { period, previousPeriod, postings, skills: [ { id, share, change } ] most asked first } or null without live data;
 * change is null until there is a previous window.
 */
export const SKILL_TREND_WEEKS = 1 // 1 = this week vs last week, 4 = last 4 weeks vs the 4 before

/**
 * Skill trends of a career (careerId) or of every career (null): the live popularity when the workflow pushed data,
 * otherwise an empty list (live: false)
 */
export function skillTrendOrEmpty(careerId, market = loadMarket())
{
    return skillTrend(careerId, market) ?? { period: null, live: false, skills: [] }
}

/**
 * Trend of each skill for the skill cards: its share of all postings and the change (live), or null values
 */
export function skillMarket(skillIds, market = loadMarket())
{
    const live = skillTrend(null, market)
    return Object.fromEntries(skillIds.map((id) =>
    {
        const entry = live?.skills.find((skill) => skill.id === id)
        return [ id, live ? { live: true, share: entry?.share ?? 0, change: entry?.change ?? null, period: live.period } : { live: false, share: null, change: null, period: null } ]
    }))
}

export function skillTrend(careerId, market = loadMarket())
{
    const history = (market.history ?? [ market.previous, market.latest ].filter(Boolean))
        .filter((snapshot) => careerId === null ? Object.keys(snapshot.careers ?? {}).length : snapshot.careers?.[careerId])
    const recent = history.slice(- SKILL_TREND_WEEKS)
    const before = history.slice(- 2 * SKILL_TREND_WEEKS, - SKILL_TREND_WEEKS)
    if(!recent.length)
        return null

    const total = (snapshots) =>
    {
        const sum = { postings: 0, counts: {} }
        for(const snapshot of snapshots)
            for(const [ id, career ] of Object.entries(snapshot.careers))
            {
                if(careerId !== null && id !== careerId)
                    continue
                sum.postings += career.postings ?? 0
                for(const [ skill, count ] of Object.entries(career.topSkills ?? {}))
                    sum.counts[skill] = (sum.counts[skill] ?? 0) + count
            }
        return sum
    }
    const now = total(recent)
    const then = before.length === SKILL_TREND_WEEKS ? total(before) : null
    const share = (sum, skill) => sum.postings ? Math.round((sum.counts[skill] ?? 0) / sum.postings * 100) : 0

    const skills = [ ...new Set([ ...Object.keys(now.counts), ...Object.keys(then?.counts ?? {}) ]) ]
        .map((id) => ({ id, share: share(now, id), change: then?.postings ? share(now, id) - share(then, id) : null }))
        .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
    return { period: recent.at(- 1).period, previousPeriod: then ? before.at(- 1).period : null, postings: now.postings, live: true, skills }
}
