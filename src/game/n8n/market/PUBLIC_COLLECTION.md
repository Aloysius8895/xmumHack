# 无 RapidAPI 的自动市场采集

使用 `public-market.workflow.json`。本机复用新版市场流程 ID `5erFfpD0uZ1L719B`，旧重复流程 `2dIWYl9AzvgByBAz` 保持关闭。`market-trends.workflow.json` 保留为可选 JSearch 旧方案，当前不使用它。

每天 **08:00，Asia/Kuala_Lumpur** 执行，也支持手动执行：

```text
n8n → POST /api/integrations/market/collect（Bearer 鉴权）
     → collect_linkedin.py
     → 检查搜索与选定详情是否完成
     → process_jobs.py 写入独立 derived/<run-id> 目录
     → 校验唯一性、技能关联和文件哈希
     → 发布 processed 文件，最后发布校验清单
     → 打开的游戏页面收到 SSE 刷新
```

每轮 13 职业、各 2 别名、各 2 页；请求预算 300，最多 180 条详情，请求间隔至少 1.5 秒。原始响应创建新目录，不覆盖历史文件。遇到登录、403 或持续限流会停止；搜索/选定详情缺失时保留原发布数据，不将部分失败冒充完整采集。

无需 RapidAPI key。它自动刷新 **LinkedIn 公开数据**；历史 Indeed 搜索索引记录保留，但不会由此工作流刷新 Indeed。数据表是累计已采集广告，不等于仍开放的全部职位；不同来源 ID 不自动合并，未知状态保持 unknown。没有可比历史时不计算涨跌。

游戏后端需能运行本机 Python，并已有 pandas、beautifulsoup4。必要时通过后端环境变量 `MARKET_PYTHON` 指定 Python 可执行文件；默认使用 PATH 中的 `python`。没有新增下载依赖。

集成入口只执行固定脚本和固定参数，不接受请求体中指定命令、路径或采集预算。耗时工作不持有玩家事务锁，并发重试共享同一次采集。工作流会等待采集结束，因此执行成功代表已完成数据发布，HTTP 超时设为 20 分钟。

```text
POST /api/integrations/market/collect    Authorization: Bearer INTEGRATION_TOKEN
{}

GET /api/integrations/market/collection Authorization: Bearer INTEGRATION_TOKEN
```

状态及摘要写入 `src/data/runs/market-collection.json`，详细日志在同目录；凭证不写入数据日志。每批原始任务清单仍在 `src/data/raw/linkedin-*/manifest.json`。

导出文件默认 active=false；实例中是否已发布，以 n8n 实际状态及 `docs/verification/market-posting-watch/activation-runtime.json` 为准。
