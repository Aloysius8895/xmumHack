# FDE 需求与样本偏差核查（2026-10-24）

当前样本：564 则广告，251 则完整描述。FDE 最近 30 天（2026-09-25—2026-10-24）找到 6 则未明确关闭且有发布日期的马来西亚广告，来自 5 家公司。这是定向搜索得到的广告样本，不是市场岗位总体。

## 4—10 月覆盖

历史检索扫描了 OpenJobData 固定版本中的 314 份公开在招与关闭档案。原始发布日期决定历史月份，抓取时间不代替发布日期；原申请链接去重。没有匹配记录的月份表示未取得数据，不表示需求为零。

| 月份 | 已回收历史广告 | 页面值 | 内部来源 |
|---|---:|---:|---|
| 2026-04 | 未取得 | 2 | mock |
| 2026-05 | 未取得 | 2 | mock |
| 2026-06 | 未取得 | 3 | mock |
| 2026-07 | 1 | 1 | archived_posting_sample |
| 2026-08 | 2 | 2 | archived_posting_sample |
| 2026-09 | 1 | 1 | archived_posting_sample |
| 2026-10 | 未取得 | 6 | current_collected_sample |

4—6 月未核验到 FDE 记录，依用户要求使用固定 Mock 走势补位，页面不显示 Mock 标签。7—9 月使用真实档案样本，10 月使用本次采集的样本。历史与当前采集范围不同，不计算 FDE 的实测月增长率。全部来源标记保留在 JSON/CSV 和页面内部元数据中。

## 当前可测偏差

- 最大来源 linkedin 占 89.9%；Kuala Lumpur 与 Selangor 合计占 74.5%，平台和地区覆盖不均。
- 169 则职业待分类；57 则无发布日期；313 则没有实时完整详情核验。需要分别审计，不把缺失当零。
- 62 个查询触及分页上限，关键词、排序和配额影响入样。FDE 本次追加了定向搜索，不能将其样本占比直接与其他职业的总体份额比较。
- 原始平台 ID 去重；不同平台的相同雇主/标题只作为重复候选，不在证据不足时强行合并。广告数也不等于招聘人数。

## 降低偏差的执行方法

1. 明确目标为固定时间窗内、马来西亚可申请的公开招聘广告，按平台 × 地区 × 职业 × 资历分层；记录每层的查询数、分页、失败和覆盖。采集器已支持职业/地区筛选、固定天数和时间排序。
2. 固定每日/每周采集协议，覆盖更多分页和雇主渠道，保留关闭历史，减少搜索排序及幸存者偏差；人工复核 FDE 标题和待分类记录。
3. 取得同时间窗、同地域和同定义的总体边际分布后，再做后分层/校准加权。未知入样概率时不套用随机样本的误差公式，也不使用任意的逆样本量权重宣称无偏。
4. 用未参与建模的平台、地区和后续月份检验预测；按公司或岗位聚类评估误差，比较去重与不去重、不同平台、不同抓取配额下的敏感性。增加样本量不能自行消除选择偏差，Mock 走势也不能证明市场增长。

## 招聘证据

- Avanade — Forward Deployed Engineer Lead，2026-10-24：[原始招聘链接](https://my.linkedin.com/jobs/view/forward-deployed-engineer-lead-at-avanade-4460346394)
- Virtuos Kuala Lumpur — Forward-Deployed Software Engineer，2026-10-20：[原始招聘链接](https://my.linkedin.com/jobs/view/forward-deployed-software-engineer-at-virtuos-kuala-lumpur-4473204704)
- Digile — Senior Forward Deployed Engineer (Pod Lead)，2026-10-20：[原始招聘链接](https://my.linkedin.com/jobs/view/senior-forward-deployed-engineer-pod-lead-at-digile-4478636998)
- Avanade — Forward Deployed Engineer，2026-10-19：[原始招聘链接](https://my.linkedin.com/jobs/view/forward-deployed-engineer-at-avanade-4460333582)
- UST — AI Architect (Forward Deployed Engineer)，2026-10-08：[原始招聘链接](https://my.linkedin.com/jobs/view/ai-architect-forward-deployed-engineer-at-ust-4474803320)
- DHL — Senior Forward Deployed Engineer (Full-Stack Engineering, DevOps & Agentic AI)，2026-10-06：[原始招聘链接](https://my.linkedin.com/jobs/view/senior-forward-deployed-engineer-full-stack-engineering-devops-agentic-ai-at-dhl-4470963187)

档案来源：[OpenJobData](https://huggingface.co/datasets/scholarweave/Jobs-Dataset-v2)；方法参考：[AAPOR Best Practices](https://aapor.org/standards-and-ethics/best-practices/)。原始采集文件在 src/data/raw/linkedin-20261024T103111Z；历史记录、固定版本和校验在 src/data/historical/fde_2026。

FDE 是岗位类别；NEW 表示本次加入平台的新兴岗位，并不声称这个职位称谓始于 2026 年。
