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
- **职业导师**：地图上有 6 位导师。走近后按 `E` 对话，可以询问技能要求、准备差距和市场参考，也可以设为目标。选「我可以问你一些问题吗？」可以自己输入问题：后端（`POST /api/npc/ask`，`server/features.js` 的 `askMentor`）按这位导师的职业生成提示词，让 Claude 以该行业资深从业者的身份回答，同一次对话会记住前几轮。用的是 `.env` 里的 `ANTHROPIC_API_KEY`；`AI_MOCK=1` 时返回示例回答。回答是流式的（`POST /api/npc/ask/stream`，每行一个 JSON 事件）：等待第一个字时导师头上冒思考气泡、对话框显示「. .. ...」，之后逐字打出，一页满了按 Enter 翻页；离开对话会中止 AI 请求。DeepSeek 默认先思考再回答（`DEEPSEEK_THINKING=0` 关闭）。
- **行业精英**：部分导师的对话里有「请教行业精英：XX」。精英是用女娲方法（`skills/Distillation/nuwa-skill`）从公开资料蒸馏出的思维框架：完整 skill 和调研底稿放在 `GamePlat/expert/<人物>-perspective/`，回答时把其中精简的 `card.md` 放进提示词（`server/experts.js` 维护职业与人物的对应；`features.js` 的 `askExpert`）。开场会先说明「基于公开资料，不是本人」。目前有：ML 工程师 → Andrej Karpathy，数据分析师 → Hans Rosling。新增精英：蒸馏到 `GamePlat/expert/`，写一份 `card.md`，再在 `server/experts.js` 的 `EXPERTS` 加一行。
- **学习资源**：路线卡片上每个阶段有「从这里开始学」，链接到该技能的免费入门资源（`server/skill-details.js` 的 `RESOURCES`，优先开源 / 开放教材）。
- **职业列表**：每个职业显示好感度和档案适配度。档案适配度只看你上传或填写的技能档案；好感度 = 档案适配度 + 学习进度，完成路线任务、发每日汇报会继续上升。上方有搜索框，地图上没有的职业也能搜索并设为目标（会替换好感度最低的导师，被替换的职业进度会保存）。
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
| 好感度 | 职业每项要求技能的「技能熟练度」（上一行）按 要求等级 × 权重 加权平均；没有学习进度时等于档案适配度 |
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

用工具（n8n、Apify、自写爬虫等）从 LinkedIn、Indeed 等招聘网站抓取职位后，按职业汇总推送过来。「探索职业」里的趋势标签和每周走势图会改用这份数据（标明来自招聘网站）；还没推送过时，用 `server/market-trends.js` 里的参考值。

```json
{
  "period": "2026-11-02",
  "source": "linkedin+indeed",
  "collectedAt": "2026-11-02T00:00:00Z",
  "careers": {
    "data-analyst": { "postings": 1100, "note": { "zh": "BI 岗位增加", "en": "More BI roles", "ms": "Lebih banyak jawatan BI" }, "topSkills": { "sql": 700, "python": 520 } },
    "ml-engineer": { "postings": 430, "change": 6 }
  }
}
```

- `careers` 的键是 `server/careers.js` 里的职业 id，`topSkills` 的键是 `SKILLS` 里的技能 id，未知的会被忽略。
- `period` 是那一周的星期一（`YYYY-MM-DD`，n8n 工作流用这个），也接受月份 `YYYY-MM`。每个 `period` 存一份，最多保留 26 份作为历史；同一个 `period` 再推送会覆盖（用来修正）。
- `change`（较上一期的 %）可以不填：会用上一期的职位数算出变化。
- 数据存在 `server/data/market.json`，所有玩家共用。
- 现成的 n8n 工作流（JSearch → 技能关键词统计 → 本接口）在 `n8n/market/`，设置步骤见那里的 README。

### 1b. 趋势面板的每月数据：`POST /api/integrations/trends`

「热度」面板（职业需求热力图、本月涨跌榜、职业排名、技能趋势）读这份数据（`server/trends.js`）。每月由 n8n 推送一次；还没推送过时显示演示数据，面板上标着「演示数据」，推送第一个月后自动换成真实数据。

```json
{
  "period": "2026-09",
  "source": "n8n:jsearch",
  "collectedAt": "2026-10-01T00:00:00Z",
  "careers": {
    "data-analyst":   { "ads": 450 },
    "cloud-engineer": { "ads": 365, "name": { "zh": "云工程师", "en": "Cloud Engineer", "ms": "Jurutera Awan" } }
  },
  "skills": {
    "sql":    { "share": 38 },
    "python": { "share": 36 }
  }
}
```

- `period` 是月份（`YYYY-MM`）；同一个月再推送会覆盖（用来修正），最多保留 24 个月。
- `careers`：当月新增招聘数 `ads`。职业 id 用小写加连字符；目录里的职业（`server/careers.js`）点进去会打开职业卡，目录外的职业也会显示，`name` 可以是字符串或三语对象，不填就用目录里的名字。
- `skills`（可不填）：当月招聘中要求该技能的比例 `share`（0–100）。
- 数据存在 `server/data/trends.json`，所有玩家共用。

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
