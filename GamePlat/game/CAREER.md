# 职业冒险：AI 职业规划 × 探索世界 × 宠物养成

在原来的 3D 世界上加了一层职业准备平台。完整流程：

认识自己的技能 → 选职业（General，或 Customise 上传招聘要求）→ 获得职业宠物 → AI 生成路线 → 自主学习并记录。考试功能已取消；根据每日汇报提升技能熟练度的成长机制留待后续实现。

## 运行

```bash
cd GamePlat/game
npm install --force
npm run dev          # 游戏 + /api 一起启动（API 以 Vite 中间件的形式运行）
```

在 `.env` 里配置 AI（只在服务器端读取，不会进到浏览器）：

| 变量 | 说明 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key。也可以不填，改用 `ant auth login` 登录 |
| `AI_MOCK` | `1` = 演示模式：不调用 Claude，返回示例结果，没有 key 也能把流程走完。接上真实 AI 时要删掉这一行 |
| `CLAUDE_MODEL` | 可选，默认 `claude-opus-5-5` |
| `INTEGRATION_TOKEN` | 外部接口（见下方「外部接口」）的密钥；不填 = 外部接口关闭 |

发布：`npm run build && npm run server`，然后打开 http://127.0.0.1:8787（同时提供 `dist/` 和 `/api`）。

## 怎么玩

- **左上角**：圆形小地图，点导师头像传送，点空白区域打开完整地图。
- **右上角菜单**：点击向下展开档案、职业、宠物、路线、记录、设置；下方是宠物状态、积分和「下一步」。打开面板时人物会停下，按 `Esc` 关闭。
- **职业导师**：地图上有 6 位导师。走近后按 `E` 对话，可以询问技能要求、准备差距和市场参考，也可以设为目标。
- **职业列表**：显示对应宠物保存的好感度，没有当前宠物的职业显示 0%。技能匹配计算仍用于详细要求和导师建议。
- **宠物**：选定目标后跟随玩家。技能卡包含图标、名称、现有进度、热度、难度和说明；菱形表示进度，不是装备按钮。
- **语言**：设置里可切换中文 / English / Bahasa Melayu，界面和 AI 输出都会跟着变。

## 结构

```text
server/                     后端（Node，零额外框架）
  app.js                    /api 路由；会修改存档的请求逐个执行
  features.js               4 个 AI 功能：技能提取、岗位要求分析、路线规划、记录归类
  ai.js                     Claude 调用：结构化 JSON 输出 + 拒答自动回退 + 错误分类；AI_MOCK 演示模式
  game.js                   游戏规则：任务进度、阶段解锁、积分、好感度展示
  careers.js                职业目录：技能要求（等级 + 权重）、市场参考、预计投入、对应宠物
  skill-details.js          29 项技能的三语说明、图标类别、参考热度和 1–5 难度
  store.js                  存档：带版本号、先写临时文件再改名、保留 .bak、读档时迁移和校验
  data/save.json            玩家存档（已加入 .gitignore）
sources/Career/             前端
  Career.js                 入口（由 sources/Game/Game.js 创建）
  CareerApi.js              API 客户端，状态变化时触发事件
  CareerUI.js               HUD、快速菜单、面板、NPC 对话（对话是数据驱动的节点图）
  CareerWorld.js            职业广场 NPC + 跟随的宠物
  i18n.js                   三语文本表（按文本 ID 取字）
sources/style/career.styl   界面样式（沿用原作的深紫色风格，适配手机和安全区域）
animation/pets/build.py     用 Blender 生成 6 只职业宠物 → static/pets/*.glb
```

## 规则（`server/game.js` 顶部的 `RULES`）

| 规则 | 数值 |
| --- | --- |
| 技能等级 | 0 未掌握 / 1 入门 / 2 能实际使用 / 3 熟练 |
| 匹配度 | Σ 权重 × min(你的等级, 要求等级) ÷ Σ 权重 × 要求等级 |
| MP（魔力） | 任务预计投入，1 MP ≈ 1 小时专注学习 |
| 学习记录 | 按小时推进任务进度；积分 = 推进的百分点 × 技能难度倍数（难度 4–5 ×3、3 ×2、1–2 ×1），手动勾选完成不计分 |
| 技能熟练度 | max(档案等级换算, 路线任务进度, 每日汇报更新的熟练度) |
| 阶段完成 | 全部任务达到 100%；已保存的历史完成状态继续有效 |
| 阶段解锁 | 先修阶段完成后解锁，不再依赖考试 |
| 技能卡 | 现有进度 + 参考市场需求等级 + 1–5 难度 + 三语说明 |
| 宠物等级 | 1 + 好感度 ÷ 20（最高 6 级） |

界面上标明的边界：
- 招聘文件只反映岗位已公开的要求，不代表公司的全部标准，也不保证录用。
- 技能热度和难度是预设参考等级，不是实时招聘统计。
- 平台不负责教学。

## 职业与宠物

| 职业 | 宠物 | 特征 |
| --- | --- | --- |
| 数据分析师 | Sorti 数据猫头鹰 | 圆眼镜 |
| 前端工程师 | Pixi 像素小狐 | 大尾巴 |
| 后端工程师 | Bytey 服务器龟 | 带状态灯的龟壳 |
| UI/UX 设计师 | Hue 调色兔 | 贝雷帽 |
| AI / 机器学习工程师 | Neuro 神经美西螈 | 天线 |
| 产品经理 | Compass 指南企鹅 | 指南针徽章 |

加职业：在 `server/careers.js` 的 `CAREERS` 里加一项（技能 id 要先登记在 `SKILLS` 里）。如果用新物种，就在 `animation/pets/build.py` 加一个造型函数，再加上 `pet.species.*` 的三语名字。

## 外部接口（`server/integrations.js`）

给外部工作流和聊天机器人用，路径都在 `/api/integrations/` 下，需要请求头 `Authorization: Bearer <INTEGRATION_TOKEN>`。没设置 `INTEGRATION_TOKEN` 时返回 503；密钥不对返回 401。返回内容只有结果，不含游戏状态。

### 1. 招聘市场数据：`POST /api/integrations/market`

用工具（n8n、Apify、自写爬虫等）从 LinkedIn、Indeed 等招聘网站抓取职位后，按职业汇总推送过来。「探索职业」里的本月趋势会改用这份数据（标明来自招聘网站）；还没推送过时，用 `server/market-trends.js` 里的参考值。

```json
{
  "period": "2026-11",
  "source": "linkedin+indeed",
  "collectedAt": "2026-11-01T08:00:00Z",
  "careers": {
    "data-analyst": { "postings": 1100, "note": { "zh": "BI 岗位增加", "en": "More BI roles", "ms": "Lebih banyak jawatan BI" }, "topSkills": { "sql": 700, "python": 520 } },
    "ml-engineer": { "postings": 430, "change": 6 }
  }
}
```

- `careers` 的键是 `server/careers.js` 里的职业 id，`topSkills` 的键是 `SKILLS` 里的技能 id，未知的会被忽略。
- `change`（较上一期的 %）可以不填：新的 `period` 会把上一份数据存为上一期，再用职位数算出变化。同一个 `period` 再推送会覆盖（用来修正）。
- 数据存在 `server/data/market.json`，所有玩家共用。
- 现成的 n8n 工作流（JSearch → 技能关键词统计 → 本接口）在 `n8n/market/`，设置步骤见那里的 README。

### 2. WhatsApp / Telegram AI agent

**每条消息**：`POST /api/integrations/chat`

```json
{ "channel": "telegram", "text": "今天练了 SQL JOIN 两小时", "lang": "zh" }
```

AI 把消息归类到学习路线的任务，记成一条学习记录（来源显示为 telegram / whatsapp，照常推进任务进度和计分），返回 `{ log, reply }`，bot 把 `reply` 发回给用户。还没生成路线时，`log` 为 `null`，`reply` 是提示先生成路线。

**每日汇报整合**：`POST /api/integrations/digest`

agent 把当天的汇报整合后，推送技能熟练度的更新（0–100）：

```json
{
  "date": "2026-10-21",
  "summary": "练习 SQL JOIN，清洗了一份数据集",
  "skills": [
    { "skillId": "sql", "delta": 5, "evidence": "完成 3 道 JOIN 练习" },
    { "skillId": "data-cleaning", "mastery": 30 }
  ]
}
```

- `mastery` 直接设定数值，`delta` 在原值上加减，结果限制在 0–100。
- 宠物技能卡的熟练度取 max(档案等级换算, 路线任务进度, 熟练度)。
- 同一天再推送会替换那天的汇报记录，最多保留 60 天。

目前只有一个本地存档，所以聊天消息和每日汇报都记到这个存档；做多用户时，再在请求里加上用户 id，对应到各自的存档。

## 下一步（未做）

- WhatsApp / Telegram bot 本身：接收消息后调用上面的 `chat`、每天调用一次 `digest`。
- 招聘网站抓取工作流：定期调用 `market`。
- 多用户账号：目前只有一个本地存档，排行榜用好友码。
- HP／状态（学习节奏）、积分规则细化。
- 职业导师模型继续按项目的角色资源配置。

原考试 API (`/api/gym/start`、`submit`、`abandon`) 已移除，返回 404。存档中的历史考试字段保留用于兼容，不再向客户端暴露或创建新考试。
