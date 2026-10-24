# CareerSphere 马来西亚招聘数据

最新更新（2026-10-24）：已接入 14 个职业，包括带 NEW 标记的 FDE。处理样本为 564 则广告、251 则可用完整描述、1,160 条技能关联。近 30 天定向采集发现 FDE 6 则、5 家公司；4—9 月检索另回收 7 月 1 则、8 月 2 则、9 月 1 则历史广告。4—6 月未取得 FDE 实测历史，按用户授权使用 Mock 趋势补位，界面不显示 Mock 标签。参见 [FDE 需求与偏差报告](derived/fde-demand/FDE_RESEARCH.md)、[逐月来源](derived/fde-demand/fde_history_coverage.csv) 和 [档案说明](historical/fde_2026/README.md)。

新增：[2026 年 4 月起的真实历史统计](historical/2026-04_onwards/README.md)。已保存 DOSM 官方 4—6 月总量、Techmap 4—9 月独立供应商统计及官方职业季度数据；项目职业和技能月度历史缺失处保留空值。

采集日期：2026-10-24（Asia/Kuala_Lumpur）。来源按用户指定为 **LinkedIn、Indeed**。

这是已接入游戏“市场热度”的本地招聘广告样本；不作为全国市场总量或无偏总体估计。原始采集样本、回收历史档案和模拟趋势保留独立来源，技能统计只使用真实可用描述。

## 打开哪些文件

- `processed/jobs.csv` / `jobs.json`：去重后的马来西亚职位，一行一则来源广告。
- `processed/job_skills.csv` / `job_skills.json`：技能 ID、必须/加分/未明确、原文证据。
- `processed/job_sources.csv`：关键词、页码、原始文件及发现关系；关键词不是最终分类。
- `processed/occupation_coverage.csv`：现有 13 个职业的样本量、公司数与描述覆盖。
- `processed/skill_demand_sample.csv`：可用完整描述样本中的技能提及率及分母。
- `processed/excluded_jobs.csv`：地点未确认、明确需要移居境外的职位；不进入马来西亚样本统计。
- `processed/QUALITY_REPORT.md`：中文质量及覆盖报告。
- `processed/quality_report.json`：字段类型、缺失率、长度、日期范围、数值统计及完整采集清单。
- `processed/verification.json`：原始文件校验、离线重放及数据约束验证。
- `raw/linkedin-*/`：只读原始 HTML、观察数据、详情、请求日志和任务清单。
- `raw/indeed-index-*/records.json`：从公开搜索索引提取的职位元数据及不超过 24 词的摘要，**不是原始完整职位页面**。
- `config/catalog.json`：直接导出项目 `allCareers()` 的 13 个职业与现有技能 ID，包含搜索别名。

CSV 为 UTF-8 BOM，可由 Excel 打开；JSON 未知值为 null，CSV 对应空白。

## 来源与访问方式

LinkedIn 使用未登录的公开招聘页面：

```text
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=data+analyst&location=Malaysia&start=0
https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}
```

这是从实际响应确认的公开网页路径，不是受保证的官方开发者 API。选择器或访问策略变化时，脚本可能需要维护。没有使用个人账户、登录 Cookie、付费服务、代理轮换或验证码处理。

每个职业使用两个别名，初次运行各两页，offset 为 0、10；实际每次返回数量保存在 manifest，不能由页码推断市场总量。详情按职业轮转取样，最多 180 条；最多 300 次请求，至少间隔 1.5 秒，两个工作线程。每次请求有超时，服务端错误最多重试两次；429 等待后重试一次，持续限流停止；401/403/登录跳转立即停止。

Indeed 的[马来西亚公开职位搜索](https://malaysia.indeed.com/jobs?q=data+analyst&l=Malaysia)在本次直连测试返回 **HTTP 403**。本次通过公开搜索索引发现 `viewjob?jk=...` 职位，保留可核实的标题、公司、地点、部分薪资及短摘要，并记录查询。**索引可能滞后，没有核实职位仍开放，没有收集完整描述。** 索引记录的 `live_verified=false`，`retrieval_method=search_index`，不得纳入完整描述的技能需求率分母。

Indeed 索引发现使用本会话的搜索工具，查询保存在原始清单中；提供的 Python 采集命令只自动更新 LinkedIn。再次获取 Indeed 索引需要通过搜索工具重做，或将来接入获准的数据服务；没有声称已有 Indeed 全量自动采集器。

## 重新运行

当前环境已具备 Python、pandas、beautifulsoup4、Node.js；本次没有安装新依赖。脚本不会读取 `.env` 或调用 AI 服务。

在项目根目录执行：

```powershell
node GamePlat/data/scripts/export-catalog.mjs
python GamePlat/data/scripts/collect_linkedin.py --pages 2 --budget 300 --max-details 180 --interval 1.5
python GamePlat/data/scripts/process_jobs.py
python -m unittest discover -s GamePlat/data/tests -v
python GamePlat/data/scripts/verify_data.py
```

每次网络采集创建新的 UTC 时间戳目录；原始文件不会覆盖。处理脚本只读取已完成的任务清单，合并所有完成批次，更新派生表；按来源职位 ID 去重，保留首次/最近发现时间。重复离线处理不消耗网络请求。

## 字段和分析边界

- `canonical_job_id` 为 `linkedin:{id}` 或 `indeed:{jk}`；平台间暂不自动合并，同公司同标题也保留。跨平台相似广告需要后续复核，合计可能包含跨平台重复。
- 职业分类来自标题规则；泛化 Software Engineer 需要职责中的单一前端/后端证据，否则待分类。一个广告仅有一个主要职业。
- 技能关联复用现有 SKILLS。Java 归现有 `backend-language`，JavaScript 归 `javascript`；React Native 不当作 React。不会擅自新建技能 ID。
- 技能提取是可审计的规则启发式，保存证据及版本，未经逐条人工审阅；否定句采取保守排除，可能漏提。公司介绍通过段落标题排除，非标准排版仍可能需要人工修正。
- `skill_demand_sample` 统计所有明确提及技能（required / preferred / unknown），每广告每技能一次，以可用完整描述广告数为分母。它描述本次样本，不是人口推断。
- 搜索页发布日期只提供“天”时保留 `posted_date`，不捏造 UTC 午夜；精确时间未知则 `posted_at=null`。采集时间为 UTC。
- 工作地点是主要马来西亚筛选证据。明确境外搬迁的标题隔离；只提供 Remote 而没有马来西亚地点的记录隔离。远程申请资格未核实则标记 unconfirmed。
- 薪资仅保留索引明确提供的范围、MYR 及周期；没有进行汇率或年薪换算。地点 region 未明确提供时 state 保留 null。
- status 默认为 unknown；没有在新搜索中出现不等于关闭。仅页面明确“停止接受申请”才记 closed。
- 只有一次采集会话，没有可靠连续历史，**当前为“正在积累历史数据”**，不计算周增长、技能趋势或全国招聘人数。

## 使用的用户技能

读取 `skills/data/README.md` 后，按本次显式请求采用：

- `skills/data/02_exploration_quality/explore-data/data/skills/explore-data/SKILL.md`：检查粒度、唯一性、缺失、分布和覆盖。
- `skills/data/01_cleaning_transformation/pandas-pro/skills/pandas-pro/SKILL.md` 及 `references/data-cleaning.md`：pandas 独立清洗、副本、分组汇总及校验。

原始数据留在本机。最终实际数量和上限见 `processed/QUALITY_REPORT.md` 与每批 `manifest.json`。
