# CareerSphere 招聘市场爬虫

这是已接入本仓库 Three.js + Vite + Node.js 游戏的独立采集服务。需要 **Node.js 24 或以上**。游戏的 14 职业配置、启动方法、鉴权接收接口、自动发布和 n8n 完成状态轮询见 [INTEGRATION.md](INTEGRATION.md)。本次为本地接入，未部署公网。

游戏入口 `npm run game:serve` 和 Trends 的 Refresh 只接收 LinkedIn、Indeed、Ricebowl 来源记录。配置游戏的 RAPIDAPI_KEY 后，JSearch 已可作为 LinkedIn/Indeed 通道启用，并严格过滤其他站点；Ricebowl 使用普通 Chrome。缺 Key 时仍可使用直接页面通道。当前用户 Key 已实测 HTTP 200，具体行为见 INTEGRATION.md。

## 快速开始：不需要 API Key

在解压后的 careersphere-crawler 目录打开终端：

```bash
npm run demo
npm run summary -- --demo
npm run export -- --demo
npm test
```

核心逻辑和离线演示只用 Node.js 内置模块，无需 npm install。演示输入 6 行，去重及国家过滤后保留 4 个职位；其中 FDE 未被强行归入既有类别。所有数据明确标注 DEMO，不是实际招聘市场数据。演示数据库为 data/demo.sqlite，真实数据库为 data/market.sqlite，两者隔离。

## 功能

- JSearch /search-v2：RapidAPI / OpenWeb Ninja 两种认证、data.jobs 解析、data.cursor 翻页。
- Playwright：动态页面、加载更多、无限滚动和内嵌滚动区域、虚拟列表逐批累积、可选详情页。
- 去重、公司/职业/地区归一化、技能词典与原文依据、来源与内容版本。
- SQLite 持久保存原始记录、每次采集观察和历史快照。
- 限速、429 Retry-After、有限重试、请求及导航操作预算、记录上限、运行租约锁。
- 当前职业广告数、技能提及率、同口径周趋势；缺历史时百分比为 null。
- HTTP 异步调用入口、n8n 模板、JSON 导出、可选后端推送。
- 完整方案 PLAN.md、本地 Codex 集成提示词 PROMPT.md、测试记录 VERIFICATION.md。

## 抓取真实招聘 API

1. Windows PowerShell：`Copy-Item .env.example .env`；macOS/Linux：`cp .env.example .env`。
2. 编辑 .env，填 JSEARCH_API_KEY，选择 JSEARCH_PROVIDER=rapidapi 或 openwebninja；两种提供商的 Key 不要混用。
3. 检查 config/market.json 的职业、查询和预算。默认 3 个职业，每个最多 2 页，单次最多 12 个请求尝试（包含重试），请求间隔 1.5 秒、运行上限 10 分钟。
4. 执行：

```bash
npm run crawl
npm run summary
npm run export
```

默认搜索近一周广告。API 返回结果范围和马来西亚覆盖需要实测，不保证全市场覆盖。未知或非 MY 国家记录排除并记录原因；全球 remote 不自动视作可在马来西亚工作。

complete/capped 的命令退出码为 0；partial/failed 为 1。capped 只表示成功达到页数等预设上限，不代表抓完整个市场。全局预算中断、schema 改变和认证错误显式记录，不能被算成成功采集零条。

## JavaScript 动态网站

```bash
npm ci
npm run browser:install
npm run test:browser
```

config/browser.example.json 是禁用模板，不是已验证的 JobStreet / LinkedIn / Indeed 适配器。没有指定目标网页，因此不编造真实网站选择器。

配置真实网站时：

1. 先检查 Network / Fetch/XHR，优先选择允许用途的公开数据接口。看得见的内部请求不等于公共 API。
2. 确认目标访问规则，将真实 source 配置加入 market.json 的 sources。
3. 填 startUrls、allowOrigins、readySelector、itemSelector、idAttribute 和 fields。页面依赖的 CDN/API 源也需列入 allowOrigins；浏览器阻止未列出的源。
4. 列表缺完整描述时填 detail 配置。国家必须有事实依据，不能因为项目面向马来西亚就把所有记录硬写成 MY。
5. 分页选 button（下一页/加载更多）或 scroll；内嵌容器用 scrollContainerSelector。
6. 可选 responseUrlIncludes 等待确切分页响应；监听先于点击，之后仍等新 DOM 职位 ID。
7. emptySelector 用于明确空结果，endSelector 用于结果结束。没有新 ID 或超时只算停滞/不完整，不推断市场无更多需求。
8. 核实实际页面后设置 validated=true、enabled=true，先少量验证再扩大范围。

浏览器预算统计顶层导航、详情页及分页操作，不统计全部图片/脚本等资源子请求；不是浏览器完整 HTTP 请求数或费用估算。没有登录、验证码绕过、反检测规避或 WebSocket 长连接逻辑。

## 运行服务与接 n8n

.env 设置至少 24 字符随机 CRAWLER_TOKEN，然后：

```bash
npm start
```

默认监听 127.0.0.1:8787。除健康检查外，所有接口要求 `Authorization: Bearer <CRAWLER_TOKEN>`。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /health | 健康检查 |
| POST | /api/crawl | 启动服务器配置的采集，返回 202/runId/statusUrl |
| GET | /api/runs/:runId | 查看状态、拒绝原因和错误 |
| GET | /api/market/summary | 当前统计及历史覆盖 |

POST 不接受任意来源网址；来源在服务器配置。已有采集运行时返回 409。进程异常中断后，超过两分钟未续租的运行会在下次采集启动时变为 interrupted。

导入 n8n/daily-crawl.json，配置 HTTP Header Auth 凭据：
Name=Authorization；Value=Bearer <你的 CRAWLER_TOKEN>。
修改 URL 为 n8n 实际可访问的爬虫地址。模板每天马来西亚时间 08:00 触发，也支持手动；默认未激活。

模板会轮询最终任务与发布状态；202 **不是采集成功**。游戏接入使用 8788 端口，详情见 INTEGRATION.md。模板尚未在你的 n8n 实例执行。

Docker 容器中的 localhost 是容器本身。按部署方式使用服务名/宿主机地址；需要时改 HOST=0.0.0.0，并限制网络访问。前端不得保存 CRAWLER_TOKEN，建议由现有 Node.js 后端读取后再提供给游戏。

## 接入现有后端

本项目真实接收端为 `POST /api/integrations/crawler`，使用游戏的 `INTEGRATION_TOKEN`。运行 `npm run setup:game` 配置本机地址、服务凭据和游戏目录；`npm run game:sync` 采集并发布。普通 export/push 命令仍可用于独立配置。

输出包含 schemaVersion、idempotencyKey、run、scope、summary 以及带 sources 的 jobs。幂等键为 runId；游戏接收端已验证重复重放不重复计数、冲突拒收和失败时保留最近成功快照。

推送只允许健康真实运行，不发送 DEMO 或不完整记录。未知接收端不会自动重试 POST；当前接收端需返回有效 JSON。实际接口可能需要按你的项目适配。

## 数据与趋势口径

- 当前职业数量：最新一次运行的去重招聘广告数，不是录用人数、岗位人数或市场总量。
- 技能率：同职业提及某技能的广告数 / 该职业有描述的广告数。返回分母；原文依据在导出职位中。mentioned 只表示提及，不一定必需。
- 周趋势：最近两个完整马来西亚七天窗口中分别观察到的不同广告数。同一广告可在两个窗口各计一次；不等于新增广告数或关闭后的活跃库存。
- 两个窗口每一天必须有同 scope 的健康采集，否则 growthPct=null、insufficient_history。
- 上期为零不算无穷大增长，使用 new_in_sample/no_baseline。
- 来源、职业、查询、词典和预算修改会改变 scope；处理逻辑修改需更新 pipelineVersion。
- capped 健康运行仍是受限样本，固定范围不能消除排序、重发广告及覆盖偏差。
- 不因一次搜索缺失就标记职位关闭；firstSeenAt 不是原始发布日期。
- 跨来源描述和链接差异大时仍可能残留重复；不进行无依据的模糊合并。
- 历史指标基于不可变 observations/revisions，而不是今天的职位表反推过去。

## 运维

SQLite 单机版本适合小规模项目，不是分布式平台。定期备份 data 目录；当前没有自动数据清理策略。不要提交实际 .env、数据库和日志到公共仓库，也不要把 API Key 放进 VITE_*。

## 官方资料（2026-10-24 查阅）

- https://www.openwebninja.com/api/jsearch
- https://github.com/OpenWeb-Ninja/openwebninja-skills/blob/main/openwebninja/apis/jsearch/README.md
- https://playwright.dev/docs/network
- https://playwright.dev/docs/locators
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest
