import { loadMarket } from './store.js'
import { SKILL_DETAILS } from './skill-details.js'

/**
 * Monthly market trend per career, shown next to the heat badges of the careers panel
 * Live data comes from the job market workflow (POST /api/integrations/market, server/integrations.js).
 * Until it has pushed a snapshot, these authored reference values are used: they are NOT live recruitment
 * statistics. change = demand change versus last month, in %.
 */
export const MARKET_TRENDS = {
    period: '2026-10',
    careers: {
        'data-analyst': {
            change: 3,
            note: { zh: '企业报表与业务分析岗位持续增加。', en: 'More reporting and business analysis openings.', ms: 'Lebih banyak jawatan laporan dan analisis perniagaan.' },
        },
        'frontend-developer': {
            change: 1,
            note: { zh: '需求平稳，懂 React 与性能优化更吃香。', en: 'Steady demand, React and performance skills stand out.', ms: 'Permintaan stabil, kemahiran React dan prestasi lebih dicari.' },
        },
        'backend-developer': {
            change: 2,
            note: { zh: '云服务与 API 相关岗位小幅增加。', en: 'Cloud and API roles grew slightly.', ms: 'Jawatan awan dan API meningkat sedikit.' },
        },
        'ui-ux-designer': {
            change: - 1,
            note: { zh: '职位略少，作品集与用户研究经验是关键。', en: 'Slightly fewer openings, portfolio and research matter most.', ms: 'Jawatan sedikit berkurang, portfolio dan penyelidikan paling penting.' },
        },
        'ml-engineer': {
            change: 6,
            note: { zh: 'AI 应用落地带动模型部署岗位增长。', en: 'AI products drive growth in model deployment roles.', ms: 'Produk AI meningkatkan jawatan penggunaan model.' },
        },
        'product-manager': {
            change: 0,
            note: { zh: '需求持平，懂数据与 AI 产品的更受欢迎。', en: 'Flat demand, data and AI product sense is valued.', ms: 'Permintaan mendatar, kefahaman data dan produk AI dihargai.' },
        },
    },
}

/**
 * Latest market snapshot of a career for the careers panel: the live one pushed by the workflow, with its weekly
 * history ([ { period, postings, change, topSkills, backfilled } ] oldest first, change null when not comparable),
 * or the reference values above (live: false, no history)
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

    const trend = MARKET_TRENDS.careers[careerId]
    return trend ? { period: MARKET_TRENDS.period, ...trend, history: [], live: false } : null
}

/**
 * Skill popularity: share of the postings asking for each skill (%), in the last SKILL_TREND_WEEKS snapshots
 * versus the SKILL_TREND_WEEKS before, change in percentage points. careerId null = every career together.
 * { period, previousPeriod, postings, skills: [ { id, share, change } ] most asked first } or null without live data;
 * change is null until there is a previous window.
 */
export const SKILL_TREND_WEEKS = 1 // 1 = this week vs last week, 4 = last 4 weeks vs the 4 before

/**
 * Reference skill trends (authored like MARKET_TRENDS, NOT live statistics) shown until the workflow has pushed data:
 * direction of demand per skill, every other skill counts as stable. Heat comes from server/skill-details.js.
 */
export const SKILL_TRENDS = {
    period: '2026-10',
    rising: [ 'python', 'ml-frameworks', 'mlops', 'cloud-deploy', 'data-visualization', 'data-cleaning', 'react', 'api-integration', 'testing', 'accessibility', 'statistics', 'project-management', 'internal-control', 'patient-care' ],
    falling: [ 'excel', 'visual-design' ],
}

function referenceTrend(skillId)
{
    return SKILL_TRENDS.rising.includes(skillId) ? 'rising' : SKILL_TRENDS.falling.includes(skillId) ? 'falling' : 'stable'
}

/**
 * Skill trends of a career (careerId) or of every career (null): the live popularity when the workflow pushed data,
 * otherwise { period, live: false, skills: [ { id, heat, trend } ] } from the reference above, rising first, then by heat
 */
export function skillTrendOrReference(careerId, skillIds, market = loadMarket())
{
    const live = skillTrend(careerId, market)
    if(live)
        return live
    const order = { rising: 0, stable: 1, falling: 2 }
    return {
        period: SKILL_TRENDS.period,
        live: false,
        skills: skillIds
            .map((id) => ({ id, heat: SKILL_DETAILS[id]?.heat ?? 0, trend: referenceTrend(id) }))
            .sort((a, b) => order[a.trend] - order[b.trend] || b.heat - a.heat || a.id.localeCompare(b.id)),
    }
}

/**
 * Trend of each skill for the skill cards: its share of all postings and the change (live), or the reference direction
 */
export function skillMarket(skillIds, market = loadMarket())
{
    const live = skillTrend(null, market)
    return Object.fromEntries(skillIds.map((id) =>
    {
        const entry = live?.skills.find((skill) => skill.id === id)
        return [ id, live ? { live: true, share: entry?.share ?? 0, change: entry?.change ?? null, period: live.period } : { live: false, trend: referenceTrend(id), period: SKILL_TRENDS.period } ]
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
