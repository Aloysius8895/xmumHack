# 无 RapidAPI 的本机市场采集工作流

用户没有 RapidAPI key，并提供本机 `http://localhost:5678/webhook/job-watch`。继续落实已授权的工作流激活：使用现有经过实际验证的公开 LinkedIn 采集器，保留 Indeed 索引记录但不声称自动刷新 Indeed。

- [x] 设计：每日 08:00 MYT，n8n 调用鉴权后端采集入口；请求等待采集与发布完成，但不持有玩家事务队列。并发触发共享一次任务。原始文件保持不可变，处理到暂存目录，校验后发布，最后写校验清单。
- [x] 实现：server/market-collection.js、独立集成接口、public-market.workflow.json；复用现有新版市场工作流 ID，旧重复版本保持未启用。
- [x] 本机 job-watch webhook 使用 Header Auth，支持 POST 手动触发岗位检查；不作为 Telegram 公网入口。
- [ ] 验证：并发共享、部分失败保留旧数据、路径与校验、后端状态响应不被长任务阻塞、真实 n8n 采集执行、公开 webhook 鉴权。
- [ ] 发布：导入并发布本机两个可运行工作流，重启相应服务，记录实际结果。Telegram 和每日总结仍待 bot token / 用户 ID / 公网 HTTPS 配置。

边界：单次 300 请求预算，13 职业各两别名和两页，最多 180 条详情；源返回失败不发布部分新快照。该样本保留历史广告，不外推全国市场总量，也不伪造可比趋势。
