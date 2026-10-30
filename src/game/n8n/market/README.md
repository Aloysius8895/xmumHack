# 招聘市场趋势工作流（n8n → 接口 1）

> 新版的三个工作流、离线总览、凭证与 Telegram 配置统一见 [n8n/README.md](../README.md)。新版历史去重保留在游戏存档中，无需 Google Sheets；失败或缺失查询会整批阻止推送。

每周一早上 8 点（马来西亚时间）自动跑一次，也可以手动点一下立即跑：

```
JSearch API（Google for Jobs：LinkedIn、Indeed、JobStreet 等）
   → 每个职业 2 个搜索词，抓近 7 天的马来西亚职位
   → 按职位名称过滤掉不相关的、按 job_id 去重
   → 用关键词规则统计每个职位提到的技能（技能表来自 server/careers.js）
   → POST /api/integrations/market 推送给游戏服务器
   → 「探索职业」的趋势标签和每周走势图改用这份数据
```

| 文件 | 作用 |
| --- | --- |
| `pipeline.js` | 全部逻辑：搜索词、职位名称过滤、技能关键词、汇总。**改逻辑只改这里** |
| `market-trends.workflow.json` | 导入 n8n 用的工作流，由 `build-workflow.mjs` 从 `pipeline.js` 生成，不要手改 |
| `build-workflow.mjs` | 生成上面的 JSON，并检查 `pipeline.js` 是否覆盖了 `careers.js` 里所有职业和技能 |
| `run-local.mjs` | 备用方案：不用 n8n，直接用 Node 跑同一套流程 |
| `pipeline.test.mjs` | 测试（包括把生成的 Code 节点跑一遍，以及推送给真实服务器路由） |
| `fixtures/sample-jsearch.json` | 测试用的**虚构**职位数据，不是真实招聘信息 |

## 设计上的取舍

- **不用 LLM 抽技能，用关键词规则。** 结果可解释、可重复，不会编造技能，也不花 API 费用。每条规则都在 `pipeline.js` 的 `SKILL_PATTERNS` 里，评审问起可以直接打开给他看。
- **不保存职位描述。** 推送计数和最小职位身份数据；后端只保存身份指纹及首次/末次观察时间，不保存招聘人员资料。
- **职位数是样本数，不是全国总数。** JSearch 不提供总数，每个搜索最多返回 `numPages × 10` 个职位。达到上限时，说明文字会标「达抽样上限」。技能占比（例如「SQL 72%」）比职位数更可靠。
- **按周存。** `period` 是那一周的星期一（马来西亚时间，例如 `2026-10-19`）。同一周内再跑会覆盖这一周的数据（用来修正）；新的一周会加进历史，服务器最多保留 26 周，并用职位数算出较上周的变化。所以第一周的变化显示为 0。点开「探索职业」里的职业，可以看到「每周职位数」走势图。历史只来自真实的推送，JSearch 抓不到过去几周的职位，所以走势从第一次跑的那周开始累积。

- **技能热门度。** 每个技能 = 要求它的职位占比（%），跟上一周比差几个百分点（例如「SQL 33%，↑ 6 个百分点」），不设门槛。整体（全部职业合起来）显示在「探索职业」首页，各职业的显示在职业页面。比较的周数是 `server/market-trends.js` 的 `SKILL_TREND_WEEKS`（1 = 本周 vs 上周，改成 4 = 近 4 周 vs 前 4 周，比较平稳）。为了比较准确，每周推送全部技能的次数（`topSkills: 0`），不只前几名。

## 第一次设置

1. **游戏服务器**：在 `src/game/.env` 加 `INTEGRATION_TOKEN=<一串够长的随机密码>`，然后启动（`npm run dev` 默认在 http://localhost:5173，`npm run server` 在 http://localhost:8787，或用 Replit 部署的网址）。
2. **JSearch key**：注册 RapidAPI，打开 JSearch API，订阅免费的 Basic 计划（每月 200 次请求），复制 `X-RapidAPI-Key`。
3. **启动 n8n**（任选一种）：
   - `npx n8n`
   - `docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`

   打开 http://localhost:5678 。
4. **导入**：Workflows → Import from File → 选 `market-trends.workflow.json`。
5. **建两个 credential**（类型都选 Header Auth）：
   - `JSearch (RapidAPI key)`：Name 填 `X-RapidAPI-Key`，Value 填你的 key → 在 **JSearch search** 节点选它
   - `Career platform token`：Name 填 `Authorization`，Value 填 `Bearer <INTEGRATION_TOKEN>` → 在 **Push to game server** 节点选它
6. **改网址**：打开 **Build queries** 节点，改最上面 `SETTINGS.apiBaseUrl`。
   - n8n 用 `npx` 跑在同一台电脑：`http://localhost:5173`（dev）或 `http://localhost:8787`
   - n8n 用 Docker 跑：把 `localhost` 换成 `host.docker.internal`
   - 正式 demo：Replit 部署的网址
7. 点 **Run now (demo)** → 跑完后看 **Run summary** 的输出，再打开游戏的「探索职业」，标签小字会变成「来自招聘网站数据」，鼠标停在标签上能看到职位数和说明。
8. 右上角打开 **Active**，之后每周一自动跑（n8n 要一直开着才会触发）。

## 额度

默认每次跑 = 6 个职业 × 2 个搜索词 × 1 个请求页；实际扣量以 JSearch/RapidAPI 套餐规则为准。`numPages` 大于 1 前先看供应商计费。任何查询失败或缺失时，新版工作流整批保留旧数据，不会推送不完整的职位样本。

## 改逻辑

```bash
cd src/game
# 1. 改 n8n/market/pipeline.js（加搜索词、调关键词等）
npm run n8n:test     # 测试
npm run n8n:build    # 重新生成 market-trends.workflow.json
# 2. 在 n8n 里重新导入（或把新的 Code 节点内容贴过去），记得 commit 两个文件
```

在 `server/careers.js` 加了新职业或新技能后，`n8n:build` 会提示 `pipeline.js` 缺了哪些搜索词或关键词。

## 备用方案：不用 n8n

```bash
cd src/game
# .env 里加 RAPIDAPI_KEY=... 和 API_BASE_URL=http://localhost:5173（INTEGRATION_TOKEN 上面已经加了）
npm run n8n:run                       # 抓取 + 推送
npm run n8n:run -- --dry-run          # 只抓取，打印要推送的内容
npm run n8n:run -- --fixture n8n/market/fixtures/sample-jsearch.json --dry-run   # 不联网，用虚构数据测试
```

## 补前几周（回推）

JSearch 抓不到过去某一周的「快照」，但每个职位都有发布日期。回推就是抓一次近 30 天的职位（每个搜索最多 10 页、100 个），按发布日期分到本周之前的 3 个完整周，各推送一份标了 `backfilled: true` 的快照：

```bash
cd src/game
npm run n8n:run -- --backfill --dry-run              # 抓取 + 打印 3 周的数据，不推送（会用额度）
npm run n8n:run -- --backfill --replay n8n/market/cache/backfill-<时间>.json   # 用存下的结果推送，不用额度
```

- 每次真的抓取都会把原始结果存到 `n8n/market/cache/`（git 忽略），之后用 `--replay` 重跑不花额度；终端会打印 RapidAPI 本月剩余额度。
- **回推的周会偏少**：已下架的职位抓不到，越早的周越少。所以服务器不会拿回推的周算变化 %（显示 —），游戏里用浅色柱子画，并写明是按发布日期回推。各周的技能占比仍可参考。
- 额度：12 个搜索，每个 10 页。多页的计费以 RapidAPI 的定价为准，跑之前先看剩余额度。

## 提交时要声明

n8n、JSearch API（RapidAPI，数据来自 Google for Jobs）、技能分类来自 `server/careers.js`。
