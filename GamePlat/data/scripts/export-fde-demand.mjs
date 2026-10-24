import fs from 'node:fs'
import { collectedMarket } from '../../game/server/collected-market.js'
import { marketMonthWindow } from '../../game/sources/Career/MarketWindow.js'
import { buildMockMarketHistory } from '../../game/sources/Career/MockMarketHistory.js'
import { buildMarketRows } from '../../game/sources/Career/MarketSeries.js'

const market = collectedMarket()
if(!market) throw new Error('Collected market unavailable')
const trends = market.trends, audit = trends.sampling
const periods = marketMonthWindow(7, new Date(market.collectedAt))
const preview = buildMockMarketHistory(trends,periods)
const fde = buildMarketRows(trends,periods,preview).find(row => row.id === 'forward-deployed-engineer')
const demand = audit.emergingDemand[fde.id]
const output = new URL('../derived/fde-demand/',import.meta.url)
fs.mkdirSync(output,{recursive:true})
const coverage = periods.map((period,index) => ({
    period, known_archived_ads:trends.careerObservations?.[fde.id]?.[period]?.value ?? null,
    displayed_value:fde.displayAds[index],
    origin:trends.periods.includes(period) ? 'current_collected_sample' : preview.cells[fde.id]?.[period] ? 'mock' : 'archived_posting_sample',
}))
const write = (name,value) => fs.writeFileSync(new URL(name,output),JSON.stringify(value,null,2)+'\n')
write('sampling_diagnostics.json',audit)
write('fde_recent_postings.json',demand)
write('fde_history_coverage.json',coverage)
const keys = Object.keys(coverage[0]), csv = value => `"${String(value ?? '').replaceAll('"','""')}"`
fs.writeFileSync(new URL('fde_history_coverage.csv',output),'\uFEFF'+[keys.map(csv).join(','),...coverage.map(row => keys.map(key=>csv(row[key])).join(','))].join('\r\n')+'\r\n')
const sourceShare = (audit.sources[0].count/audit.n*100).toFixed(1)
const regionShare = (audit.regions.filter(row=>['Kuala Lumpur','Selangor'].includes(row.id)).reduce((n,row)=>n+row.count,0)/audit.n*100).toFixed(1)
const report = `# FDE 需求与样本偏差核查（2026-10-24）

当前样本：${audit.n} 则广告，${audit.usableDescriptions} 则完整描述。FDE 最近 30 天（${demand.windowStart}—${demand.windowEnd}）找到 ${demand.recentAds} 则未明确关闭且有发布日期的马来西亚广告，来自 ${demand.companies} 家公司。这是定向搜索得到的广告样本，不是市场岗位总体。

## 4—10 月覆盖

历史检索扫描了 OpenJobData 固定版本中的 314 份公开在招与关闭档案。原始发布日期决定历史月份，抓取时间不代替发布日期；原申请链接去重。没有匹配记录的月份表示未取得数据，不表示需求为零。

| 月份 | 已回收历史广告 | 页面值 | 内部来源 |
|---|---:|---:|---|
${coverage.map(row=>`| ${row.period} | ${row.known_archived_ads ?? '未取得'} | ${row.displayed_value} | ${row.origin} |`).join('\n')}

4—6 月未核验到 FDE 记录，依用户要求使用固定 Mock 走势补位，页面不显示 Mock 标签。7—9 月使用真实档案样本，10 月使用本次采集的样本。历史与当前采集范围不同，不计算 FDE 的实测月增长率。全部来源标记保留在 JSON/CSV 和页面内部元数据中。

## 当前可测偏差

- 最大来源 ${audit.sources[0].id} 占 ${sourceShare}%；Kuala Lumpur 与 Selangor 合计占 ${regionShare}%，平台和地区覆盖不均。
- ${audit.unclassified} 则职业待分类；${audit.undated} 则无发布日期；${audit.unverified} 则没有实时完整详情核验。需要分别审计，不把缺失当零。
- ${audit.pageCappedQueries} 个查询触及分页上限，关键词、排序和配额影响入样。FDE 本次追加了定向搜索，不能将其样本占比直接与其他职业的总体份额比较。
- 原始平台 ID 去重；不同平台的相同雇主/标题只作为重复候选，不在证据不足时强行合并。广告数也不等于招聘人数。

## 降低偏差的执行方法

1. 明确目标为固定时间窗内、马来西亚可申请的公开招聘广告，按平台 × 地区 × 职业 × 资历分层；记录每层的查询数、分页、失败和覆盖。采集器已支持职业/地区筛选、固定天数和时间排序。
2. 固定每日/每周采集协议，覆盖更多分页和雇主渠道，保留关闭历史，减少搜索排序及幸存者偏差；人工复核 FDE 标题和待分类记录。
3. 取得同时间窗、同地域和同定义的总体边际分布后，再做后分层/校准加权。未知入样概率时不套用随机样本的误差公式，也不使用任意的逆样本量权重宣称无偏。
4. 用未参与建模的平台、地区和后续月份检验预测；按公司或岗位聚类评估误差，比较去重与不去重、不同平台、不同抓取配额下的敏感性。增加样本量不能自行消除选择偏差，Mock 走势也不能证明市场增长。

## 招聘证据

${demand.postings.map(job=>`- ${job.company} — ${job.title}，${job.postedDate}：[原始招聘链接](${job.url})`).join('\n')}

档案来源：[OpenJobData](https://huggingface.co/datasets/scholarweave/Jobs-Dataset-v2)；方法参考：[AAPOR Best Practices](https://aapor.org/standards-and-ethics/best-practices/)。原始采集文件在 GamePlat/data/raw/linkedin-20261024T103111Z；历史记录、固定版本和校验在 GamePlat/data/historical/fde_2026。

FDE 是岗位类别；NEW 表示本次加入平台的新兴岗位，并不声称这个职位称谓始于 2026 年。
`
fs.writeFileSync(new URL('FDE_RESEARCH.md',output),report)
console.log(JSON.stringify({sampleAds:audit.n,usableDescriptions:audit.usableDescriptions,recentFdeAds:demand.recentAds,employers:demand.companies,coverage}))
