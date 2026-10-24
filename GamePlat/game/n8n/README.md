# CareerSphere：最终 n8n 工作流

**2026-10-24 更新：** 当前市场流程改用[无需 RapidAPI 的 LinkedIn 公开采集](market/PUBLIC_COLLECTION.md)，每天 08:00 采集并发布到本地热度数据。文件为 [public-market.workflow.json](market/public-market.workflow.json)。[岗位追踪](posting-watch/README.md)每 30 分钟运行，另支持带鉴权的 `POST /webhook/job-watch`。下文 JSearch 配置仅供可选旧方案参考，不是当前市场采集依赖；旧重复流程保持关闭。

先用浏览器打开本目录的 **[overview.html](overview.html)**。这是离线交互总览，可以切换四个流程、点击节点、查看接口；真正运行和编辑使用 n8n 的画布。

| 文件 | 作用 | 时间 |
| --- | --- | --- |
| [market/public-market.workflow.json](market/public-market.workflow.json) | 公开 LinkedIn 采集、清洗校验、发布本地职业与技能热度 | 每天 08:00 / 手动 |
| [learning/telegram-learning.workflow.json](learning/telegram-learning.workflow.json) | Telegram 私聊与按钮 → 已有 chatbot → 游戏学习记录 → chatbot 回复 | 消息到达时 |
| [learning/daily-digest.workflow.json](learning/daily-digest.workflow.json) | 演示玩家昨天的真实汇报 → 原文摘录 → 游戏每日总结 | 每天 00:05 / 手动 |
| [posting-watch/posting-watch.workflow.json](posting-watch/posting-watch.workflow.json) | 检查 customise 原始职位链接，变更时在游戏中提醒重新生成 | 每 30 分钟 / 鉴权 webhook |

四个流程均使用 `Asia/Kuala_Lumpur`，导出文件默认未激活。本机四个流程已发布；Telegram 已通过官方 API 确认注册到提供的 HTTPS 隧道，市场采集、岗位检查和每日总结已实际执行成功。详细证据见 [activation-runtime.json](../../verification/market-posting-watch/activation-runtime.json)。

隧道必须持续运行；临时 trycloudflare 域名变化后，更新 n8n 的 `N8N_WEBHOOK_URL` 为新的 HTTPS 基址并重新注册 Telegram Trigger。`/webhook/job-watch` 是岗位检查入口，Telegram 使用独立触发器路径。服务尚未配置开机自启动。

## DeepSeek AI 配置

游戏和 chatbot 的服务端各设置以下变量，使用同一个 key：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
```

把真实 key 填入各自未提交的 `.env` 或部署 Secrets，然后重启两套服务。`python run.py` 会读取 chatbot 的 `.env`。n8n 不保存 DeepSeek key：Telegram 流程把消息交给 chatbot，消息分类和闲聊调用 DeepSeek；学习汇报通过游戏后端调用同一模型。标准 AI digest 也调用该适配器。

当前招聘流程用规则提取技能、计算统计；n8n 的 `summary_only=true` 每日总结摘录原文，这两步无需模型调用。JSON 由源码生成；更新后重新导入，现有 n8n 实例不会自动更新。保留原有 Telegram、Header Auth 凭证及 owner 设置。

## 在 n8n 里打开

Windows / PowerShell 运行：

```powershell
npx.cmd n8n
```

浏览器打开 <http://localhost:5678>，首次使用建立本地账号。新建 workflow，在画布顶部 `… → Import from File` 导入一个 JSON。四个 JSON **分别导入为四个 workflow**。本机已有已发布实例，避免重复导入后重复定时执行。只看节点和连线无需凭证，运行才需要下面的配置。文件夹位置：

```text
C:\maven\GameEmployee (XmumHack)\GamePlat\game\n8n\
```

已有旧版招聘流程时，用新版替换或重新导入后停用旧版，避免两个定时器重复请求。

## 凭证与地址

真实密钥只填入 `.env` / 部署 Secrets 和 n8n Credentials，不要写进 JSON 或 Code 节点。游戏的 `.env` 不会自动成为 n8n 或 chatbot 的配置。

| n8n 节点 | Credential 类型 | 内容 |
| --- | --- | --- |
| JSearch search | Header Auth | Name `X-RapidAPI-Key`，Value 为 RapidAPI key |
| Push to game server | Header Auth | Name `Authorization`，Value `Bearer <游戏 INTEGRATION_TOKEN>` |
| Success / Failure Telegram notification（可选） | Telegram API | BotFather 给的 bot token |
| Telegram updates | Telegram API | 与 chatbot 用于回复的 Telegram bot 相同 |
| Forward to existing chatbot | Header Auth | Name `X-Telegram-Bot-Api-Secret-Token`，Value 为 chatbot `TELEGRAM_WEBHOOK_SECRET` |
| Build summary from accepted reports | Header Auth | Name `X-Cron-Token`，Value 为 chatbot `CRON_TOKEN` |

**招聘流程**：打开 `Build queries`，改顶部 `SETTINGS.apiBaseUrl` 为游戏后端地址。默认 `http://localhost:8787` 对应 `npm.cmd run server`；用 Vite 开发服务则填 `http://localhost:5173`。`notificationChatId` 留空不发送通知；填写后给两个通知节点选择 Telegram credential。

**Telegram 流程**：打开 `Normalize private update`，改 `chatbotBaseUrl` 和 `ownerTelegramId`。

更新后的 chatbot 支持 `/expert`：按网页当前 target 介绍对应的蒸馏专家，后续文字进入专家问答，`/exit` 返回普通聊天。现有流程会原样转发命令，无需为这个命令重新导入或增加节点。`TELEGRAM_ALLOWED_USER_IDS` 必须只绑定同一个玩家；游戏与 chatbot 都要更新并重启。

**每日总结**：打开 `Yesterday and owner`，填写相同的 chatbot 地址和 owner ID。

项目根目录的 `chatbot/` 是 Python 服务，运行方式：

```powershell
cd chatbot
python -m pip install -r requirements.txt
python run.py
```

依照 [chatbot 配置说明](../../../chatbot/README.md) 配置环境变量或部署 Secrets：

```dotenv
CAREERSPHERE_API_URL=<游戏后端地址>
INTEGRATION_TOKEN=<与游戏一致>
TELEGRAM_BOT_TOKEN=<与 n8n Telegram credential 一致>
TELEGRAM_WEBHOOK_SECRET=<与 n8n bridge Header Auth 一致>
TELEGRAM_ALLOWED_USER_IDS=<演示玩家的一个纯数字 Telegram from.id>
CRON_TOKEN=<与 n8n daily Header Auth 一致>
DIGEST_SCHEDULE_ENABLED=false
```

chatbot 还需要它原本的 AI provider 配置，供消息分类和聊天使用。n8n 的每日原文总结不额外调用 AI。ID 可从现有 bot 的 `/start` 回复或 Telegram Trigger 测试输出的 `message.from.id` 获取。

**单玩家项目边界**：现有游戏只有一份本地存档。这一版要求 `ownerTelegramId` 和 `TELEGRAM_ALLOWED_USER_IDS` 是同一个演示玩家 ID。不是多用户绑定系统；陌生人、群组、编辑消息不会记到这份存档。确认按钮仍由已有 chatbot 处理；照片、文件和语音只返回“请发送文字”的提示，不下载文件，也不当作学习成果。

## Telegram webhook 与部署

n8n 的 Telegram Trigger 需要 Telegram 能访问的公网 **HTTPS** webhook。单独运行 `npx.cmd n8n` 可以查看画布，但 `localhost:5678` 不能直接接收 Telegram 推送。可使用可达的 n8n 部署或配置好 HTTPS 隧道及 `WEBHOOK_URL` 的本地 n8n。

同一个 bot 只支持一个 webhook。启用这个 n8n Telegram workflow 后，入口由 n8n 接管；不要再运行原来设置 Python `/telegram/webhook` 的脚本覆盖它。Python chatbot 仍运行，保留 bot token 来发回复。WhatsApp 原入口可以继续保留。

n8n Cloud 的 HTTP 节点需要可达的游戏和 chatbot 地址；Docker 中访问宿主机服务使用 `host.docker.internal` 代替 `localhost`。地址均指向服务，不是游戏静态页面。

## 最后流程的实际行为

招聘：`定时/手动 → 职业查询 → JSearch → 国家/标题过滤与去重 → 全部查询成功？ → 推送游戏 → 历史快照与新旧 ID 统计 → 可选通知`。失败分支不推送，保留上次数据，可选通知后将执行标记为失败。推送节点重试失败也会让该次执行失败，可在 Executions 查看错误。

每次默认请求 6 职业 × 2 查询 × 1 页，保持固定“近七天”抽样口径。`numPages` 只是供应商请求参数，不保证拿到全部职位；满页会标注抽样上限。API 配额与付费按供应商实际规则。未知国家的结果沿用 `country=my` 查询约束，并在 report 的 `unknownCountry` 中计数；明确标为其他国家的排除。

职位跨周重复出现仍计入各周样本，历史去重只用于 `newJobs / seenJobs` 通知，不能拿“新增 ID 数”替代周需求。游戏 `market.json` 保存周快照和最多 50,000 个职位身份指纹，不保存职位描述；保留期限之外的 ID 会再次被视为新观察。每周相同 period 的重跑替换快照。部分失败或缺失查询整批拒绝；全成功但无匹配职位允许真实零样本。

Telegram：`Trigger → 私聊与 owner 校验 → 文字 / callback / 附件分流 → POST chatbot /internal/n8n/telegram`。后半段由项目已有 Python 服务完成：分类 → 必要时确认 → `POST 游戏 /api/integrations/chat` → SQLite 保存成功汇报 → 发回游戏返回的 reply。n8n 不再发送第二条回复。同步 bridge 会把未捕获处理异常返回 n8n，SQLite 去重 delivery，游戏按稳定 messageId 去重记账。游戏保留最近 5,000 个消息回执用于重试保护。

每日总结：`00:05 → 马来西亚昨天日期 → POST chatbot /internal/digest/run?summary_only=true&telegram_user_id=... → 只取这个玩家已成功记录的汇报 → 原文摘录 → POST 游戏 /api/integrations/digest`。`skills: []`，不会额外发积分或熟练度；无记录跳过。日期以 chatbot 接受并保存汇报时的马来西亚日期为准。摘要最多 1,000 字符，完整原始汇报仍在 chatbot SQLite 中。游戏按日期幂等，第一次成功保存为准；再次运行同一天不会再次应用技能 delta。

`POST /api/integrations/trends` 仍是独立的月度数据接口；这一版不会把周滚动样本相加，冒充整月新增招聘数。热度月度面板仍按现有来源或演示数据运行。

## 测试与重建

```powershell
cd GamePlat/game
npm.cmd run n8n:build
npm.cmd run n8n:test
node --test server/integrations.test.mjs
```

```powershell
cd chatbot
python -m pytest -q -p no:cacheprovider
```

重建会更新三个 JSON 和 overview.html。在 n8n 中修改节点不会自动改回仓库；修改源码后重新导入时，也需要重新填写画布中的设置和选择凭证。

本地校验执行了生成的 Code 节点和隔离存档测试，外部 API/Telegram 调用使用 mock；没有使用真实 bot 注册 webhook、消耗 JSearch 额度或进行 n8n 实例内实跑。
