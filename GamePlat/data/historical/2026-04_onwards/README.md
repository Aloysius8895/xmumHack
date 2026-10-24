# 2026 年 4 月起的真实历史数据

核验日期：2026-10-24（Asia/Kuala_Lumpur）。按用户选择：真实数据优先，缺失月份留空。没有生成模拟值。

本目录保存外部公开历史统计和项目历史覆盖清单。**已接入游戏“市场热度 → 市场概览”的独立历史图表和季度表。** 外部市场总量不参与职业/技能热度计算。不同来源独立成序列；未取得的值为 JSON `null`、CSV 空白，不能当作零。

页面优先显示职业热力图，下方展示历史市场总量。热力图默认显示马来西亚日历的本月及前 6 个月，10 月显示 4—10 月，11 月自动滚动为 5—11 月；即使新月份尚未采集，也保留月份列。**2026-10-24 用户最新授权：缺失职业历史先用 Mock 补齐以预览趋势，且界面不显示 Mock 演示标签。** `MockMarketHistory.js` 仅在前端补充缺失的职业格子，保留原始数组及内部 `mock:true` / `data-origin` 标记。各职业有固定且可复现的上升、平稳或回落走势，10 月采集样本不变；未来月份不补。Mock 不参与职业排名、技能统计或真实月度涨跌。导出副本在 `../../derived/history-preview/`。手机图表可左右滑动，职业名称固定可见。服务端读取本目录的两份统计 JSON，核对 `verification.json` 中的 SHA-256 后，通过既有 state.trends 响应提供给前端；修改真实数据后需同步更新校验文件。`HISTORICAL_MARKET_DIR=off` 可关闭历史市场总量展示。

## 已取得的月度数据

| 月份 | DOSM 线上招聘广告数 | Techmap 新观察招聘记录数 | Techmap 来源数 |
| --- | ---: | ---: | ---: |
| 2026-04 | 225,826 | 78,942 | 34 |
| 2026-05 | 200,730 | 59,559 | 32 |
| 2026-06 | 128,953 | 83,284 | 36 |
| 2026-07 | — | 91,230 | 50 |
| 2026-08 | — | 92,610 | 36 |
| 2026-09 | — | 48,752 | 36 |
| 2026-10 | — | — | — |

- DOSM：[第二季度官方发布](https://www.dosm.gov.my/site/downloadrelease?id=big-data-analytics-job-market-insights-q22026&lang=English)、[官方图表](https://www.dosm.gov.my/uploads/release-content/file_20260818075305.pdf)。2026-08-18 发布。原图与 PDF 文本均已核对，4—6 月合计 555,509，与官方季度总数一致。
- Techmap：[马来西亚公开数据统计页](https://jobdatafeeds.com/data/countries/my)。这是该供应商的覆盖范围，不代表马来西亚全部招聘，不限定为 LinkedIn/Indeed。来源数逐月变化，增减可能同时受采集覆盖影响，不能直接解释成市场需求变化。
- 两个序列口径不同，不能相加、拼接或用比例将总量分配给本项目职业。7—10 月 DOSM 空白表示本轮未取得可核验月度值，并非判断这些月份没有招聘。
- 10 月还未结束，本项目 10 月 24 日采集的 462 则留存广告样本不能当作 10 月全国新招聘总数。

## 职业与技能的缺口

`quarterly_occupation_context.csv/json` 保存 DOSM Q1、Q2 的 9 个职业大类和 Software Developers 季度数据，共 20 行。Q1 作为比较基期，Q2 覆盖 4—6 月。Software Developers 范围包括多种软件岗位，不单独映射成前端或后端；具体职业是大类的子集，不能再与大类加总。

季度值不平均拆成月度值。两季度职业大类分别合计 626,861、555,509，已核验与季度总量一致。

本轮尚未取得本项目 **13 个职业、47 个技能**覆盖 4—10 月的可比月度历史。`career_skill_history_coverage.json` 中这些值全部保留 `null`，另列 10 月 24 日的真实当前样本摘要，明确 `is_monthly_total=false`。

当前广告虽然带有过去的发布日期，但历史上已删除、关闭或未被当前检索发现的广告没有完整覆盖，因此不能按当前广告的发布日期倒算过去每月的市场热度或技能占比。原有 `server/trends.js` 演示常量未作为本次历史来源。

查到的进一步来源：[Techmap 马来西亚历史记录](https://aws.amazon.com/marketplace/pp/prodview-vtzfykyyjb6x4)、[LinkFetch LinkedIn 历史数据](https://linkfetch.io/linkedin-jobs-dataset)。前者完整历史需订阅；后者页面介绍自 2026 年 4 月起的历史及免费全球样本，但本轮未取得覆盖马来西亚各月的完整文件。没有购买、注册或把供应商介绍当成已取得的数据。

## 文件

- `monthly_market_context.csv/json`：两个独立来源 × 7 个月，共 14 行；9 个观测值，5 个缺失值。
- `quarterly_occupation_context.csv/json`：官方职业季度数据。
- `career_skill_history_coverage.json`：项目职业/技能历史缺口和当前样本摘要。
- `market_context_trends.png`：两个来源分图展示；缺失月份留空。
- `sources/`：官方 PDF、官方封面中直接提取的图像、PDF 文本及 Techmap 页面快照。
- `source_manifest.json`：原始来源 URL、获取时间、HTTP 状态、文件长度、SHA-256。
- `verification.json`：来源哈希、季度合计、记录数及缺失检查。

CSV 使用 UTF-8 BOM。`simulated=false` 表示没有模拟；`eligible_for_project_career_skill_trends=false` 表示外部总量不能直接充当项目职业或技能趋势。
