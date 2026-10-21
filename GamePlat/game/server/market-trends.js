import { loadMarket } from './store.js'

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
 * history ([ { period, postings, change } ] oldest first), or the reference values above (live: false, no history)
 */
export function marketSnapshot(careerId, market = loadMarket())
{
    const live = market.latest?.careers?.[careerId]
    if(live)
    {
        const history = (market.history ?? [ market.previous, market.latest ].filter(Boolean))
            .filter((snapshot) => snapshot.careers?.[careerId])
            .map((snapshot) => ({ period: snapshot.period, postings: snapshot.careers[careerId].postings, change: snapshot.careers[careerId].change }))
        return { period: market.latest.period, change: live.change, note: live.note, postings: live.postings, topSkills: live.topSkills, history, live: true }
    }

    const trend = MARKET_TRENDS.careers[careerId]
    return trend ? { period: MARKET_TRENDS.period, ...trend, history: [], live: false } : null
}
