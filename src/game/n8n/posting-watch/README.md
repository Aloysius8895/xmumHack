# 每周公司岗位变更追踪

2026-10-31 更新：Roadmap 顶部恢复招聘链接输入，普通职业目标和 Customise 目标均可使用；已有追踪链接也可以修改。新的调度为 **每周一 08:00（Asia/Kuala_Lumpur）**，cron `0 8 * * 1`。下文 2026-10-24 的运行记录是当时的历史证据，不能代表当前服务正在运行；本次状态另见 `../../../verification/market-posting-watch/weekly-restoration.json`。

保存链接不会替换现有路线。重复保存同一个职位链接会保留比较基线；换成另一个职位则重新建立基线。普通目标在用户明确接受变更并成功生成路线后，才切换为该岗位的定制目标。仅支持具体 LinkedIn / Indeed 招聘详情页，尚不支持任意公司招聘列表页。

新增本机手动入口：`POST http://localhost:5678/webhook/job-watch`，需要 `Authorization: Bearer INTEGRATION_TOKEN`。使用公网隧道时，将 localhost 基址换成当前 HTTPS 隧道域名。普通浏览器 GET 不会触发检查。该地址只负责岗位检查，Telegram Trigger 使用其自身注册的另一条 webhook；n8n 的 `WEBHOOK_URL` 应填写 **HTTPS 基址**，不带 `/webhook/job-watch` 路径。

市场自动重新采集已由[无密钥公开采集工作流](../market/PUBLIC_COLLECTION.md)接管；本流程仍专门检查已 customise 岗位链接。

2026-10-24 实测：本机 n8n 2.44.6 已启动；四个正式工作流已发布，旧重复市场流程关闭。岗位追踪已通过手动、定时和公网鉴权入口实际执行；Telegram 已注册公网 webhook，每日总结已实跑成功。详情见 [运行证据](../../../verification/market-posting-watch/activation-runtime.json)。

本机编辑器：[岗位追踪工作流](http://localhost:5678/workflow/CSPostingWatch01)。当前游戏：[http://127.0.0.1:8787](http://127.0.0.1:8787)。这些是本机进程，电脑关机或服务停止后不会继续检查；并未配置开机自启动。

## 已接通的数据更新

`server/collected-market.js` 读取 `src/data/processed/jobs.json`、`job_skills.json`、`quality_report.json`。有 artifact_manifest 时同时校验哈希，避免处理脚本写到一半时读到不同批次的文件。

- 职业热度：该职业广告数 / 全部已采集广告数。未分类广告保留在总分母中。
- 技能热度：提及技能的去重广告数 / 完整描述可用的去重广告数；Indeed 索引摘要不进入分母。
- trends：显示最新一次采集样本及时间、来源、样本数。当前只显示一列，不把留存广告按发布日期伪造成历史趋势。尚未有可比历史，所以涨跌显示“正在积累历史数据”。
- 处理文件更新后，后端通过现有 SSE 通知打开的页面重新读取。已验证数据文件通知实际到达；最新采集包含 462 则样本、181 则可用描述、13 个职业。

独立市场流程每天 08:00 自动重新采集公开 LinkedIn 数据并发布 processed 数据，同步更新热度页面。岗位追踪按每周一 08:00 检查已绑定的具体招聘链接。

## 使用岗位追踪

1. 选择职业目标（普通或 Customise 均可），打开 Roadmap 顶部的“每周追踪公司招聘信息”。
2. 填写对应 LinkedIn 或 Indeed 具体职位链接，点击“启用岗位追踪”。已有链接可修改并保存。不能只根据公司名称猜测哪一条招聘广告。
3. 首次成功读取原始页面建立基线。每周一 08:00（Asia/Kuala_Lumpur）由 n8n 调用后端检查，支持当前目标和已暂存的其他职业目标，每轮最多 20 个目标。
4. 标题、公司、地点或职位正文发生变化时，保留现有路线和学习记录，显示变更提醒。纯 HTML 排版/空白变化不会触发提醒；相同版本重试不会成为新变更。
5. 用户查看最新招聘内容，点击“使用最新招聘要求重新生成”。后端重新分析最新正文并生成路线，两步都成功后才提交新目标/路线和接受新基线。重新生成会按原有确认提示替换路线；检测本身不会替换路线。

现有存档中的 customise 岗位**没有原始招聘链接**，所以首次真实执行结果 watching=0；没有谎称已经追踪这家公司的变化。补链接后，下一轮建立基线。

LinkedIn 使用公开未登录页面；已验证新解析器能处理采集的 180 份真实详情，并对一个公开职位进行实际重新读取。Indeed 若继续返回 403，会显示检查失败，不会绕过访问限制。网络错误、登录页、解析失败和限流都不会被当作招聘要求变化。只有成功读取的内容才能建立新版本。

## 接口

```text
POST /api/target/track
{ "sourceUrl": "https://www.linkedin.com/jobs/view/123456" }

POST /api/integrations/jobs/check       Authorization: Bearer INTEGRATION_TOKEN
{}

GET /api/integrations/jobs/status      Authorization: Bearer INTEGRATION_TOKEN

POST /api/roadmap/refresh-posting
{ "revision": "当前 pending.hash" }
```

检查返回 watching、checked、changed、failed、skipped、checkedAt 和当前采集样本元数据。集成接口采用现有 Bearer 验证；新建本机令牌仅保存在后端 `.env` 和 n8n 凭证库，JSON 不包含密钥。源 URL 仅允许 LinkedIn 职位详情或 Indeed `viewjob?jk=`；拒绝自定义端口、认证信息、重定向及任意内网请求。

## 导入和重启

`posting-watch.workflow.json` 是可移植导出，默认 active=false；实例中启用状态与导出文件不同。`npm.cmd run n8n:build` 会生成这份文件和四工作流总览。

本机已完成导入；重新部署时从 `src/game` 执行：

```powershell
node n8n/posting-watch/prepare-local.mjs
n8n.cmd import:credentials --input .local-automation/credential.json
n8n.cmd import:workflow --input .local-automation/posting-watch.workflow.json
n8n.cmd publish:workflow --id=CSPostingWatch01
```

准备脚本仅在 INTEGRATION_TOKEN 为空时生成后端令牌，不改 AI 配置；临时凭证文件位于 gitignored 目录，导入后可删除。如果部署在另一台机器或端口，需要修改 HTTP 节点中的游戏 API 地址。不要把密钥写进 workflow JSON。

分别启动游戏服务和 n8n（如 n8n 已启动，CLI 发布后需重新启动 n8n 才加载发布版本）：

```powershell
npm.cmd run server
```

```powershell
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:GENERIC_TIMEZONE = 'Asia/Kuala_Lumpur'
n8n.cmd start
```

## 验证结果

- 110 项 server/n8n 测试通过，包含新数据分母/缓存一致性、URL 校验、基线、变更/重试/回退、403、暂存职业、显式重新生成和鉴权测试。
- 生产构建通过。
- 桌面/手机浏览器检查通过，无 pageerror；验证文件在 `docs/verification/market-posting-watch/`。名称含 fixture 的截图仅为浏览器内的变更提醒测试，不是实际公司变更，也没有写入存档。
- 运行时检查、n8n 发布状态和执行记录见同目录 `runtime.json`。

官方参考：[n8n API 鉴权](https://docs.n8n.io/api/authentication/)、[Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)。本机 CLI 的 import/publish/execute 选项另经 2.44.6 的 --help 核实。
