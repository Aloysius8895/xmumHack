# 游戏招聘采集与 Refresh

## 2026-10-30 Incremental collection, accumulated window and cloud deployment

**The game server keeps the data; the crawler keeps no state.** The game's `market-window` document holds the postings seen in the last 30 days (deduplicated by platform and platform id), the monthly aggregates, the last 20 runs and the watermark (the start time of the last successful collection). It is stored in PostgreSQL when `DATABASE_URL` is set, otherwise as `market-window.json` in the crawler data folder, by default the repository's `data/crawler/`. The old single-run `market.json` is converted into a window the first time it is read.

**Incremental collection.** When a scheduled run or a Refresh starts, the game hands the crawler the watermark and the listing fingerprints it already has (`known`). `POST /api/crawl` accepts only `trigger`, `since` and `known`. The crawler asks the platforms only for adverts posted since the watermark (JSearch `date_posted`, LinkedIn `f_TPR`, Indeed `fromage`), with a 2-hour buffer and a 30-day cap; JSearch's `today` is never used because its meaning is undocumented. Known listings whose search-page fields did not change keep their detail pages unfetched and are reported as `seen`. Incremental runs are published as schema 1.2: only new and changed postings, plus `seen` and the `delta` counts. The dynamic time filter does not change the scope, so monthly comparisons are unaffected. An empty LinkedIn result page (`<!DOCTYPE html><!---->`) is an observed zero; any other unrecognised page still fails the source.

**Refresh and the schedule.** For 30 minutes after any collection finishes, a player's Refresh returns 429 with `cooldownUntil`; a running collection is still shared. The daily schedule calls `POST /api/integrations/crawl/schedule` (`INTEGRATION_TOKEN`), is never held by the cooldown, and is polled with `GET /api/integrations/crawl/schedule/<runId>`. `CRAWL_SCHEDULE_MYT` (default `08:00`, `off` disables it) only feeds the "next automatic update" shown in the UI; n8n does the triggering. A crawler started without state calls `GET /api/integrations/crawler/state`; if that fails too, it runs a full collection.

**n8n.** The regenerated `n8n/daily-crawl.json` calls the published app (default `https://xmum-hackfinal.replit.app`; set `GAME_BASE_URL` when generating it). After importing, set Header Auth to `Authorization: Bearer <INTEGRATION_TOKEN>`, check the URL, then activate it.

**Cloud deployment.** The `.replit` deployment runs `npm run server:cloud` (`server/start-with-crawler.js`): the game and the crawler side by side, the crawler on `127.0.0.1:8788` (never exposed) and restarted if it exits. The crawler's settings are derived from the game's existing environment (`MARKET_CRAWLER_TOKEN`, `INTEGRATION_TOKEN`, `MARKET_CRAWLER_URL`, `RAPIDAPI_KEY`), and only platforms that need no browser run in the cloud: LinkedIn and Indeed through JSearch when a key is set, otherwise LinkedIn public pages only. Ricebowl stays local. Moving local data into the database: `cd src/game && npm run migrate:pg` (safe to repeat; anything already in the database is kept).

Known risks: a `cloudrun` deployment may only get CPU while serving a request, so the background collection after Refresh's 202 can slow down or pause; with several instances a poll can reach another instance (`crawler-run-not-found`; the UI keeps the current data). Both need testing on the published app; if collection is unreliable, use a Reserved VM or a maximum of one instance.

---

`src/crawler` 已接入 `src/game`。Trends（市场热度）新增 **Refresh · 重新采样** 按钮：点击后创建新的采集运行，异步显示进度，完成校验与发布后自动更新热力图、排行和技能统计。它会执行新的网络请求，不只是重新加载旧 JSON。

## 2026-10-25 采样提速

当前游戏配置让三个来源并行推进，LinkedIn/Indeed 共用 JSearch 响应缓存和 2500 ms 请求间隔，Ricebowl 在独立浏览器标签顺序访问，间隔为 1000 ms。职业查询、详情额度、来源过滤、去重和发布校验保留。请求总量和运行截止时间跨来源共用；429 继续按 Retry-After 等待，401/403 停止该 API 来源的后续职业查询。旧配置不填 `maxSourceConcurrency` 时仍以单 worker 执行。

53 项服务测试与 7 项游戏端采样测试通过。本地合成响应对比中，相同 12 次请求、12 条相同记录，串行配置 25.743 秒，并行配置 9.843 秒，耗时减少 62%。这不是实网耗时保证，也没有为基准测试消耗 API 配额或发布测试记录。结果在 `../verification/crawler-integration/speed-benchmark.json`；复测命令为 `node scripts/benchmark-speed.js`。

本机旧采样完成后已通过原终端正常停止并重启服务。`/health` 已确认来源并发 3、浏览器间隔 1000 ms、JSearch 间隔 2500 ms，JSearch 配置可用。下一次页面 Refresh 使用新配置。

## 当前 JSearch 配置

已启用用户在 `src/game/.env` 配置的 `RAPIDAPI_KEY`，服务端也接受 `JSEARCH_API_KEY`。游戏入口只在服务端读取该文件，不复制密钥到浏览器。已用一个 `/search-v2` 请求实测 HTTP 200；健康检查返回 `jsearch.enabled=true`、`configured=true`。

生成配置在有 Key 时使用 JSearch 作为 LinkedIn/Indeed 的获取通道，Ricebowl 保留普通 Chrome 通道。收到的记录必须有对应平台的真实职位链接和明确 MY 国家；其他聚合来源丢弃。两个平台视图共用同一轮请求缓存，默认 14 个职业、一页通常只需 14 次 API 请求（失败重试另计），不重复按平台调用。没有可核验候选的来源标为覆盖不可用，不当作需求为零。

刷新按钮位于 Sample coverage and bias 右上角；进入页面不会启动采样，只有点击才发起新运行。原实现状态区块和相关界面措辞已移除，展开内容为 16px。当前已有 476 则样本在用户选择重新采样前保留。

`npm run config:game` 会依据服务器 Key 重新生成配置；服务运行中变更配置需重启 `game:serve`。`npm run jsearch:check` 会消耗一次真实 API 请求用于检查连接。缺 Key 时生成的配置仍使用下面描述的直接页面通道。

## 来源范围

游戏数据只允许来自 **LinkedIn、Indeed、Ricebowl**。生成配置、游戏启动入口、刷新前健康检查、接收端来源与招聘链接都执行此限制。JSearch 是经过筛选的数据获取通道，不作为第四个招聘平台。当前启用了 JSearch；无 Key 配置仍可使用直接页面通道。

LinkedIn 复用项目已核对的公开 guest 招聘列表及详情结构，通过本地 Python/BeautifulSoup 解析。Indeed 与 Ricebowl 使用普通 Chrome 加载公开页面和 JobPosting JSON-LD。Ricebowl 的搜索页、真实 mkrb-job-card 属性和职位详情已实际核对；Indeed 搜索仍可能要求人工验证。返回 401/403、访问挑战或未知结构就停止该来源，不自动操作验证码。原先未知网站的 browser.example.json 继续关闭。

每个来源独立暂存。只有该来源所有计划查询及选中详情都完整成功，才把它的记录写入可发布样本。不可用来源被隔离、保留错误；其余成功来源可发布为明确的部分来源样本，整体运行状态仍是 partial。实际来源子集进入 scope，范围改变就重新积累可比历史。全部来源失败时保留上一轮成功样本，不发布零需求。

## 启动

在 `src/game` 执行：

```powershell
npm run crawler:setup
npm run dev
```

另开终端，在同一目录执行：

```powershell
npm run crawler:serve
```

打开 `http://localhost:5000` 的市场热度，再按 Refresh。爬虫监听 `127.0.0.1:8788`，避免与游戏生产服务的 8787 冲突。需要 Node.js 24+、Python 和 beautifulsoup4；Indeed/Ricebowl 浏览器通道还需要已安装的 Chrome 和本包 Playwright（npm ci）。公开 LinkedIn 通道不依赖浏览器。

遇到 Indeed/Ricebowl 验证时，在游戏目录运行 `npm run crawler:browser`。它打开服务器维护的专用 Chrome；请手动通过网站验证，并确认能搜索职位，再按 Refresh。会话保留在忽略的 crawler/data/browser-profile，不读取日常 Chrome 的 Cookie，不导出或打印登录凭据。默认使用可见 Chrome；CRAWLER_BROWSER_HEADLESS=1 可切为无头模式，但本机测试中这两个站点会拒绝无头搜索。验证不通过的来源保持不可用，不能宣称已解决。

`crawler:setup` 同步当前 14 个职业（含 FDE）和 47 个技能 ID，生成 `config/game.market.json`；复用游戏 INTEGRATION_TOKEN，配置服务间令牌到忽略的 `.env`，不打印值。现有非空配置保留。若新加服务端环境变量，重启游戏和爬虫以加载它们。手动换令牌时需保持两边一致。

不用页面时也可运行 `npm run crawler:sync`。若采集成功而发布失败，可在不重抓的情况下执行 `npm run crawler:push -- --run-id <原runId>`。

## 样本与统计

- 每次点击生成新 runId。运行中重复点击或多个用户同时点击共享正在运行的采集，避免重复请求。
- 默认覆盖 14 职业，每职业每来源一个查询、一页；每来源最多轮转选择 28 个详情。全运行最多 150 次 HTTP 尝试与浏览器导航操作，至少间隔 2.5 秒，10 分钟、1000 条记录上限。浏览器脚本、图片等子资源不计入这个操作预算，因此它不是全部网络请求数。公开网站排序和分页会限制覆盖。429 按 Retry-After（缺失时 30 秒）最多重试一次；过长等待或持续限流停止，不快速重试 403。
- SQLite 保留每轮原始记录、来源关系、不可变观察与内容版本。页面显示最近同范围样本，以及本采集库首次观察和历史已见广告数。首次观察不等于刚发布或新招聘人数；重复采样不保证获得不同广告。
- 本机实网已成功通过新 Refresh 流程发布一轮 140 则 LinkedIn 广告（28 则详情），14 个查询完成；该轮 Indeed/Ricebowl 直接请求均为 403，明确排除。这轮样本与原来的 564 则累计样本属于不同范围，不相加，也不把数量差异当市场下降。
- 最终浏览器通道已完成整轮发布：476 则广告（LinkedIn 140、Ricebowl 336）、55 则描述，本库首次观察 337、历史已见 139。Indeed 人工验证仍无法通过，已明确排除。Ricebowl 同时支持 JobPosting JSON-LD 和没有该脚本的进口职位 DOM 模板；未知发布日期不编造。范围改变后的这轮样本单独统计。
- 当前数量是样本中的去重广告数。技能分母是同职业有描述的广告数；只有词典中的实际提及才计入，保留原文依据。
- 月度实测格采用同 scope 内该月最近一次健康快照。同月重跑替换快照，不累加每周数量。配置未覆盖的职业为未知；完整成功查询后无匹配才是观察到的零。
- 实测周趋势要求两个完整 MYT 七天窗口的每一天都有同 scope 可发布采集；缺失时增长率为 null。原有用户授权的历史补位走势与实测周指标分开。
- 多轮固定关键词样本仍有选择偏差。需要平台、地区、职业和资历覆盖，统一时间窗、保守去重，并用独立数据验证；不能仅凭刷新次数把样本视为总体或宣称无偏。

## 接口和密钥

- `POST /api/market/sample/refresh`：游戏页面调用，无客户端服务密钥，返回 202/runId；拒绝跨来源 Origin 和自定义采集 URL。
- `GET /api/market/sample/:runId`：安全的进度与统计。服务间凭据由后端持有，前端不接触密钥。
- `POST /api/integrations/crawler`：Authorization 为 Bearer INTEGRATION_TOKEN，Idempotency-Key 为 run.id，schema 1.1。校验来源、国家、职业/技能 ID、健康查询、部分来源隔离、计数、日期和链接。
- `GET /api/integrations/crawler`：同鉴权，查询最近接收状态。同 runId 同内容重推不重复计数；内容冲突、旧批次、演示/fixture 或不健康来源拒收。
- SQLite 位于 `crawler/data/market.sqlite`。游戏快照原子写入 `game/server/data/crawler/market.json`，附校验和；不写玩家存档，不改动既有 data/raw、processed 或历史证据。
- 游戏环境：INTEGRATION_TOKEN、MARKET_CRAWLER_URL、MARKET_CRAWLER_TOKEN；爬虫环境：CRAWLER_TOKEN、BACKEND_INGEST_URL、BACKEND_INGEST_TOKEN。开发发布 URL 默认为 `http://127.0.0.1:5000/api/integrations/crawler`。全部密钥只放服务器的忽略文件。
- CRAWLER_DATA_DIR 可替换游戏快照目录；设为 off 则禁用新来源，继续读取既有处理样本。

## n8n

导入 `n8n/daily-crawl.json`，两个 HTTP 节点都选择 Header Auth：Name=Authorization，Value=Bearer 加 CRAWLER_TOKEN。模板每天 08:00（Asia/Kuala_Lumpur）启动，每 10 秒轮询，最多 75 次，必须等待 publication.status=published。202 不是完成；全部来源或发布失败使工作流失败。部分来源可发布状态会保留 unavailableSources。导出默认未激活，尚未在用户 n8n 实例执行。

Docker 中 localhost 是容器自身。两处爬虫 URL 需改为 n8n 能访问的服务名或宿主机地址，BACKEND_INGEST_URL 也需从爬虫进程可达。避免与旧的市场定时采集任务重复启用。

## 开发方法来源

- [Agent Reach](https://github.com/Panniantong/Agent-Reach) 与网页读取路由：按适用来源选择读取方式、保留出处，并用 Jina Reader 核对原包接口文档。
- [browser-use](https://github.com/browser-use/browser-use)：公开 HTTP 优先；需要交互才使用浏览器；明确等待、验证结果并在访问控制处停止。沿用已有 Playwright 动态页面适配器。

以上是开发参考来源，参考库已在最终交付清理中从项目移除；现有实现直接使用项目中的 Node.js、Python 和 Playwright 代码。配置 JSearch 时会使用服务端 API 凭据。
