# 招聘市场趋势工作流（n8n → 接口 1）

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
- **只推送数字。** 职位描述只在内存里读一遍数关键词，不保存，所以招聘人员的名字、电话、邮箱都不会进到游戏服务器。
- **职位数是样本数，不是全国总数。** JSearch 不提供总数，每个搜索最多返回 `numPages × 10` 个职位。达到上限时，说明文字会标「达抽样上限」。技能占比（例如「SQL 72%」）比职位数更可靠。
- **按周存。** `period` 是那一周的星期一（马来西亚时间，例如 `2026-10-19`）。同一周内再跑会覆盖这一周的数据（用来修正）；新的一周会加进历史，服务器最多保留 26 周，并用职位数算出较上周的变化。所以第一周的变化显示为 0。点开「探索职业」里的职业，可以看到「每周职位数」走势图。历史只来自真实的推送，JSearch 抓不到过去几周的职位，所以走势从第一次跑的那周开始累积。

## 第一次设置

1. **游戏服务器**：在 `GamePlat/game/.env` 加 `INTEGRATION_TOKEN=<一串够长的随机密码>`，然后启动（`npm run dev` 默认在 http://localhost:5173，`npm run server` 在 http://localhost:8787，或用 Replit 部署的网址）。
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

每次跑 = 6 个职业 × 2 个搜索词 = 12 次请求。每周一次，一个月大约 52 次，免费额度够用，但测试时别狂按。`numPages` 大于 1 时 RapidAPI 可能按多倍计费，改大之前先看 JSearch 的定价页。额度用完时请求会失败，失败的职业会被跳过，游戏继续显示上一份数据；全部失败时工作流会报错，不会推送空数据。

## 改逻辑

```bash
cd GamePlat/game
# 1. 改 n8n/market/pipeline.js（加搜索词、调关键词等）
npm run n8n:test     # 测试
npm run n8n:build    # 重新生成 market-trends.workflow.json
# 2. 在 n8n 里重新导入（或把新的 Code 节点内容贴过去），记得 commit 两个文件
```

在 `server/careers.js` 加了新职业或新技能后，`n8n:build` 会提示 `pipeline.js` 缺了哪些搜索词或关键词。

## 备用方案：不用 n8n

```bash
cd GamePlat/game
# .env 里加 RAPIDAPI_KEY=... 和 API_BASE_URL=http://localhost:5173（INTEGRATION_TOKEN 上面已经加了）
npm run n8n:run                       # 抓取 + 推送
npm run n8n:run -- --dry-run          # 只抓取，打印要推送的内容
npm run n8n:run -- --fixture n8n/market/fixtures/sample-jsearch.json --dry-run   # 不联网，用虚构数据测试
```

## 补前几周（回推）

JSearch 抓不到过去某一周的「快照」，但每个职位都有发布日期。回推就是抓一次近 30 天的职位（每个搜索最多 10 页、100 个），按发布日期分到本周之前的 3 个完整周，各推送一份标了 `backfilled: true` 的快照：

```bash
cd GamePlat/game
npm run n8n:run -- --backfill --dry-run              # 抓取 + 打印 3 周的数据，不推送（会用额度）
npm run n8n:run -- --backfill --replay n8n/market/cache/backfill-<时间>.json   # 用存下的结果推送，不用额度
```

- 每次真的抓取都会把原始结果存到 `n8n/market/cache/`（git 忽略），之后用 `--replay` 重跑不花额度；终端会打印 RapidAPI 本月剩余额度。
- **回推的周会偏少**：已下架的职位抓不到，越早的周越少。所以服务器不会拿回推的周算变化 %（显示 —），游戏里用浅色柱子画，并写明是按发布日期回推。各周的技能占比仍可参考。
- 额度：12 个搜索，每个 10 页。多页的计费以 RapidAPI 的定价为准，跑之前先看剩余额度。

## 提交时要声明

n8n、JSearch API（RapidAPI，数据来自 Google for Jobs）、技能分类来自 `server/careers.js`。
