# CareerSphere：技术能力、项目描述与架构图 Prompt

基于 2026-10-22 的本地源码静态阅读。此文档描述项目采用或体现的技术能力，不代表任何个人已独立掌握全部技术。本次未运行应用、测试外部 API、读取密钥或核实线上部署状态。

## 1. 项目定位与阅读范围

CareerSphere 是结合 3D 世界探索、AI 职业准备、学习进度追踪及职业宠物养成的 Web 原型。核心流程：

技能档案 / CV → 目标职业或上传岗位要求 → 技能差距 → AI 学习路线 → 自主学习 → Web / 聊天汇报 → 任务进度、积分和宠物技能反馈。

主要阅读范围：

- `GamePlat/game/package.json`、`vite.config.js`：依赖、构建与开发服务。
- `GamePlat/game/sources/Career/`：职业界面、API 客户端、三语支持。
- `GamePlat/game/sources/Game/`：渲染、角色动画、物理、导航、资源加载等关键模块。
- `GamePlat/game/server/`：路由、AI 功能、存档、游戏规则、市场和外部集成。
- `GamePlat/game/n8n/market/`：岗位市场工作流与统计管线。
- `GamePlat/game/animation/`、`world-building/`、`scripts/`：角色和场景资产工具。
- `chatbot/app/`、`chatbot/tests/`：多渠道聊天服务、SQLite、日报与测试。
- 项目说明、Replit 配置和浏览器验证脚本。

`GamePlat/site/` 是参考镜像；`skills/` 包含工具、第三方源码与示例，不能把这些目录中的全部技术都当作主应用实际使用的技术栈。3D 基础源自 Bruno Simon 的 Folio 2025；项目在此基础上扩展角色、地图和职业平台等功能。

## 2. 各方面的 technical skills

### A. 编程语言与基础工程

- JavaScript：ES Modules、类与模块化、异步 Promise / async-await、事件驱动、JSON 数据处理。
- Python：API 服务、消息处理、SQLite、异步调度、Blender 自动化和浏览器验证。
- HTML、CSS / Stylus：页面结构、HUD、面板、响应式布局。
- SQL：chatbot 的 SQLite 表、索引、参数化查询及唯一键去重。
- Shell / Windows 启动脚本：开发、构建及部署入口。

### B. Web 前端开发

- 原生 JavaScript 与 DOM 界面开发；主应用未采用 React / Next.js。
- Fetch API、JSON REST 客户端、请求忙碌状态和错误反馈。
- 事件驱动的 UI 状态同步；`CareerApi` 收到服务器状态后通知界面。
- HUD、职业选择、技能卡、学习路线、记录、设置、小地图与 NPC 对话。
- 数据驱动的对话节点与交互流程。
- 中文、英文、马来文 i18n，包含界面文字和 AI 输出语言控制。
- 响应式布局、手机安全区域、键盘 / 触屏 / 手柄输入相关基础设施。

证据：`sources/Career/CareerApi.js`、`CareerUI.js`、`i18n.js`、`sources/style/career.styl`、`sources/Game/Inputs/`。

### C. 3D Web、图形与交互

- Three.js 场景、相机、网格、材质和坐标变换。
- WebGPURenderer 与 WebGPU / WebGL 渲染路径。
- Three.js Shading Language（TSL）、节点材质与渲染管线。
- Bloom、简化景深、阴影、雾、水面及环境效果。
- 场景拾取、Raycasting、地图点击移动、NPC 交互。
- GLTFLoader、DRACOLoader、KTX2Loader，资源缓存和加载进度。
- Instancing、质量档位、draw calls / triangles / 纹理与几何体监控。
- GSAP 动画、Howler 音频、Tweakpane 调参、stats-gl 监控。

这些能力部分继承自上游 3D 引擎，适合描述为“集成与扩展的技术基础”，不应把所有底层效果都表述为从零原创。

证据：`sources/Game/Rendering.js`、`ResourcesLoader.js`、`InstancedGroup.js`、`Materials/`、`Audio.js`、`Debug.js`。

### D. 游戏物理与算法

- Rapier 3D / WebAssembly 物理集成。
- 胶囊体角色控制、碰撞查询、地面检测、斜坡和跳跃处理。
- 行走、奔跑、跳跃、蹲下、击飞、倒地、起身等状态转换。
- 穿透修正、异常卡住检测、安全位置历史与恢复策略。
- A* 网格寻路、最小堆优先队列、坡度成本和障碍物过滤。
- 路径平滑 / string pulling、防止斜向穿过障碍物边角。
- 世界坐标与小地图坐标映射。

证据：`Physics/PhysicsCharacter.js`、`CharacterRecovery.js`、`Navigation/GridNavigation.js`、`Island/IslandNavigation.js`。

### E. 3D 资产与动画管线

- Blender + Python / bpy 程序化资产生成和导出。
- 标准骨骼、蒙皮权重、姿势混合、IK 辅助和动画烘焙。
- 共享动作库与按角色配置生成资产。
- Three.js AnimationMixer、动画剪辑选择及状态驱动的播放切换。
- 职业宠物、地图和地形的程序化生成工具。
- glTF / GLB 导出、运行时加载与碰撞 / 导航数据配合。
- glTF Transform、Draco 几何压缩、KTX2 / Basis 纹理压缩和 Sharp 图片处理。

证据：`animation/rig.py`、`animation/pose.py`、`animation/actions/`、`animation/pets/build.py`、`world-building/`、`scripts/compress.js`、`World/VisualCharacter.js`。

### F. 后端与 API 设计

- 原生 Node.js HTTP 服务；游戏 API 没有使用 Express。
- 开发环境通过 Vite middleware 提供相同 API；生产环境提供 `dist/` 静态资源和 API。
- REST 路由、HTTP 状态码、JSON 请求 / 响应、统一错误分类。
- 输入校验、文件类型限制、上传大小限制、Base64 文件传输。
- Promise 队列串行处理存档操作，减少异步请求互相覆盖。
- 业务层与 AI 层分离：AI 提取 / 规划 / 归类，规则代码计算实际成长。
- 外部集成边界：`/api/integrations/chat`、`digest`、`market`。

证据：`server/app.js`、`server/index.js`、`vite.config.js`、`server/game.js`、`server/integrations.js`。

### G. AI 应用工程

- Anthropic SDK、Claude API；游戏端模型通过配置选择。
- 聊天端支持 Anthropic / OpenAI SDK，并可通过 Replit AI Integrations 调用。
- 提示词设计、技能目录约束、三语输出、证据支持和不夸大能力的指令。
- PDF / 图像 / 文本附件输入；不是自建 OCR 引擎。
- JSON Schema 结构化输出，用于技能提取、岗位分析、路线生成和学习记录归类。
- 消息意图分类：学习汇报、普通聊天、不确定。
- 不确定时通过按钮让用户确认。
- 有限对话历史、消息角色归一化、AI 故障回退与错误分类。
- `AI_MOCK` 演示模式。
- 日报的业务约束：过滤未知 skillId，bot 将 delta 限制在 -10 到 +15；游戏端将熟练度限制在 0–100。

这是 LLM 应用集成，不是自行训练模型；目前未发现主应用采用 RAG、向量数据库、微调或模型训练管线的证据。

证据：`server/ai.js`、`server/features.js`、`chatbot/app/ai.py`、`classify.py`、`digest.py`。

### H. 聊天机器人与跨服务集成

- FastAPI、Uvicorn、HTTPX。
- Telegram Bot API、Webhook、inline keyboard、callback query。
- WhatsApp Cloud API、Webhook 握手、交互按钮和 HMAC-SHA256 签名验证。
- Webhook 先响应，再用 FastAPI BackgroundTasks 处理消息。
- 渠道适配层与共享业务处理层。
- 重复消息过滤、用户 allowlist、待确认状态和对话重置。
- 使用 Bearer Token 调用游戏集成 API；超时与错误反馈。

README 将 Telegram 列为演示渠道，WhatsApp 列为待完成 Meta 验证的渠道。本次未验证该外部状态是否仍然相同，图中应注明“文档状态 / 待确认”。

证据：`chatbot/app/main.py`、`handlers.py`、`telegram_channel.py`、`whatsapp_channel.py`、`career_api.py`。

### I. 自动化、ETL 与市场数据分析

- n8n 定时工作流与可导入的 workflow JSON。
- JSearch / RapidAPI 获取 Google for Jobs 聚合岗位样本。
- 职业搜索词配置、岗位标题过滤、按 job_id 或替代键去重。
- 正则关键词技能提取；此管线不用 LLM 抽取技能。
- 岗位数量聚合、技能提及占比、跨周变化和来源标记。
- 马来西亚时区的周快照；同周覆盖修正，最多保留 26 份历史。
- 按发布日期回推历史、backfilled 标记及比较限制。
- 抽样上限标记、部分查询失败处理、全部失败时避免推送空数据。
- 同一逻辑复用于 n8n Code 节点、Node 本地 runner 和测试。
- 每周一 08:00 MYT 的工作流配置；chatbot 每日 23:30 MYT 的可选调度和受 Token 保护的手动触发接口。

岗位数是采样结果，不是马来西亚全部职位总量；JSearch 是数据入口，不能画成项目已直接爬取所有招聘网站。

证据：`n8n/market/pipeline.js`、`build-workflow.mjs`、`run-local.mjs`、`server/market-trends.js`、`chatbot/app/scheduler.py`。

### J. 数据存储与可靠性

- 游戏：`save.json` 保存单一玩家状态；`market.json` 保存市场快照。
- 版本化存档、迁移、基本校验、临时文件写入、备份和损坏恢复。
- Chatbot：SQLite 保存聊天、消息去重、成功汇报和待确认状态。
- SQLite 索引、参数化查询、线程锁和连接上下文管理。
- 浏览器 localStorage 用于部分客户端偏好 / 原有游戏状态，不是职业平台的主数据库。
- 好友码包含身份与积分快照，并带校验码；属于手动交换的快照排行榜。

目前游戏后端是单存档，不是完整多用户账号系统；好友码校验用于发现输入错误，不等于防作弊签名。

证据：`server/store.js`、`server/friends.js`、`chatbot/app/db.py`。

### K. 应用安全与边界控制

- 环境变量管理服务端密钥。
- 外部集成的 Bearer Token 与 timingSafeEqual 比较。
- WhatsApp HMAC-SHA256、Telegram Webhook Secret、内部 cron Token。
- 用户 allowlist、文件与请求校验、消息去重。
- 将上传 CV / JD 视为待分析数据的提示词边界。
- 服务器规则校验 AI 建议的 skillId 和数值范围。
- 降低 HTTP 日志暴露 Telegram Token 的风险。

上述是项目已采用的控制措施，不能据此宣称已经完成全面安全审计或生产级身份认证。

### L. 测试、构建、部署与工程协作

- Node 内置 test runner：集成 API、好友排行榜、技能卡、市场管线等测试。
- Pytest：聊天、分类、Webhook、按钮、游戏 API 客户端和日报等测试；外部 AI 可 mock。
- Playwright / Chromium：浏览器交互、截图与角色物理回归验证脚本。
- Vite 开发 / 构建、npm scripts、WASM 和 top-level-await 构建插件。
- Replit 的主应用和 chatbot 分别配置运行入口与端口。
- Git / GitHub 版本控制、分支集成、文档和第三方开源代码集成。

本次仅核对测试与部署配置的存在，没有重新运行测试，也没有核实线上健康状态。未找到主应用已配置完整 CI/CD 的依据；Docker 在 n8n 文档中是可选运行方式，不能画成所有服务已容器化。

## 3. 状态与画图限制

| 部分 | 可以表达的状态 | 不应直接声称 |
|---|---|---|
| 3D 世界与职业功能 | 有实现代码，基于上游扩展 | 全部 3D 引擎从零开发 |
| 游戏 AI | 有 Claude 集成与 Mock 模式 | 当前一定在调用真实 AI |
| Chatbot | Telegram / WhatsApp 适配代码已存在 | 两个渠道都已获批并稳定上线 |
| 市场管线 | 有 n8n workflow、runner 和聚合代码 | 当前定时器已启用、数据覆盖全国 |
| 存储 | 游戏 JSON + chatbot SQLite | 共用 PostgreSQL / MongoDB |
| 排行榜 | 好友码积分快照 | 实时全球多人排行榜 |
| 身份体系 | 单一游戏存档、bot 渠道用户标识 | 完整多用户账号映射已完成 |
| AI 技术 | LLM API + 结构化输出 + 规则校验 | 自训模型、RAG、向量检索已实现 |
| 旧考试功能 | 当前路由已移除 | 仍存在考试 / gym 业务闭环 |

`CAREER.md` 的部分“下一步”内容早于后续合并代码；对 bot、市场管线和熟练度更新，应以现有实现为准。配置存在与生产启用是不同状态。

## 4. English project description（可直接复制）

CareerSphere is a gamified career-preparation web prototype that combines an explorable 3D world, AI-assisted career planning, self-directed learning logs, and career-themed virtual pets. Its 3D foundation is adapted from Bruno Simon's open-source Folio 2025, with project-specific character, environment, and career-platform extensions.

Users describe their skills or upload a CV, select one of six career paths, optionally upload a target job posting, and receive an AI-generated preparation roadmap based on their skill gaps. They record their learning through the web interface or an integrated messaging bot. Server-side rules translate classified learning activity into task progress and points, while pet skill cards expose progress and mastery. The interface supports Chinese, English, and Bahasa Melayu. The platform supports preparation and tracking; it does not provide lessons, run exams, or guarantee employment.

The browser application uses vanilla JavaScript, HTML, Stylus, Vite, and Three.js with WebGPU/WebGL rendering, TSL materials, Rapier 3D physics, GLB assets, and skeletal animations. Blender and Python scripts support character rigging, reusable animation clips, pet generation, and environment asset generation. The Node.js backend uses the built-in HTTP server and REST endpoints rather than Express. During development, the same API runs as Vite middleware; in production, Node serves the built frontend and API.

The game backend integrates the Anthropic SDK for skill extraction, job-requirement analysis, roadmap generation, and learning-log classification. It supports document/image inputs, JSON Schema outputs, configurable models, and an AI_MOCK demonstration mode. AI proposes structured information, while application rules calculate progression and validate data. Game state is stored in a versioned JSON save file with backup and recovery; job-market snapshots use a separate JSON file.

A separate Python FastAPI service handles Telegram and WhatsApp webhooks, message classification, uncertain-report confirmation buttons, conversational replies, and daily learning digests. It uses HTTPX to call the game's Bearer-token-protected integration endpoints and SQLite for conversation history, processed-message IDs, saved reports, and pending confirmations. The bot supports Anthropic or OpenAI through configurable credentials, including Replit AI Integrations. Its optional daily scheduler targets 23:30 Asia/Kuala_Lumpur; the digest constrains skill IDs and proposed mastery changes before submission. Bot-side message identities do not yet map to separate game accounts: the game currently uses one save.

A separate n8n workflow, also runnable through a Node.js script, retrieves Malaysian job samples from JSearch via RapidAPI, filters and deduplicates postings, extracts skill mentions with deterministic keyword rules, and pushes aggregate counts to the game's market endpoint. The configured weekly schedule targets Monday at 08:00 Asia/Kuala_Lumpur. The game displays sampled demand and skill trends using up to 26 historical snapshots. These figures represent collected samples rather than the entire job market. Market snapshots update the market display; there is no established automatic feedback loop from new market snapshots into existing roadmap regeneration.

Testing infrastructure includes Node's test runner, Pytest, and Playwright browser verification. Replit deployment configurations exist for the game and chatbot. Source code and configuration establish implementation intent, but current cloud deployment, provider connectivity, scheduler activation, and messaging-channel approval have not been verified in this review. The chatbot README identifies Telegram as the demo channel and WhatsApp as awaiting Meta verification. Friend-code leaderboards exchange score snapshots rather than providing a live global multiplayer service. Multi-user accounts and account-to-bot mapping remain future work.

## 5. GPT Prompt：生成 roadmap 风格技术架构图

复制以下 prompt，再在末尾粘贴上面的 English project description。若 GPT 支持上传文件，也可以附上此文档作为事实来源。

```text
You are a software architect and technical infographic designer.

Using only the supplied CareerSphere project description and technical inventory, create a roadmap-style TECHNICAL ARCHITECTURE AND DATA-FLOW DIAGRAM suitable for a hackathon presentation.

The desired visual resembles a branching roadmap: clear stages, connected technology cards, and supporting subsystem branches. It explains how the existing project works. Do not turn it into a generic developer learning roadmap, and do not treat diagram positions as a delivery timeline.

Deliverables:
1. A concise one-sentence project positioning statement.
2. A presentation overview diagram with roughly 15–20 main nodes, landscape 16:9, readable on a slide.
3. A detailed technical diagram grouped into subsystem lanes, as valid Mermaid flowchart LR code. Quote labels and keep syntax simple.
4. A compact legend for flow types and implementation status.
5. A short mapping of technology → responsibility → demonstrated engineering skill.
If image generation is available, also render the presentation overview as an infographic. Preserve the editable Mermaid version. Otherwise provide the layout specification without claiming to have generated an image.

Main user journey:
Skill profile / CV → Career or target job posting → Skill-gap analysis → AI preparation roadmap → Self-directed learning → Learning reports → Task progress, points and pet skill feedback.

Use these subsystem lanes:
A. Browser and 3D experience:
   Vanilla JavaScript, HTML, Stylus, Vite; Three.js WebGPU/WebGL and TSL; Rapier physics; character animation; NPC interaction; career UI; Chinese/English/Malay.
B. Career backend and game rules:
   Native Node.js HTTP + REST API; Vite middleware in development; production static hosting; profile, target, roadmap and learning-log routes; deterministic progression rules.
C. AI services:
   Game-side Anthropic SDK for skill extraction, posting analysis, roadmap generation and log classification; document/image inputs and JSON Schema output; configurable model and AI_MOCK.
   Bot-side Anthropic OR OpenAI provider, configurable and optionally routed through Replit AI Integrations. Do not imply that both providers must run simultaneously.
D. Messaging companion:
   Telegram / WhatsApp → verified webhook → FastAPI channel adapter and shared handler → intent classification.
   Report → POST /api/integrations/chat → game rules and save.
   Chat → conversational AI → channel reply.
   Uncertain → confirmation buttons → report or chat branch.
   Successful reports → SQLite → optional 23:30 MYT daily digest → skill ID and delta checks → POST /api/integrations/digest → mastery and game feedback.
E. Job-market pipeline:
   Weekly n8n trigger OR Node runner → JSearch / RapidAPI → title filtering and deduplication → regex skill extraction → aggregate sampled demand → POST /api/integrations/market → market.json snapshots → market UI.
F. Persistence:
   Game: versioned save.json with backup/recovery; market.json for market snapshots.
   Bot: SQLite for messages, deduplication, reports and pending confirmations.
G. Supporting engineering:
   Blender + Python → rigging, reusable animation, pets/environment → GLB assets → browser asset loaders.
   glTF Transform / Draco / KTX2 / Sharp for asset processing.
   Node test runner, Pytest, Playwright; Vite build and Replit deployment configuration.

Connection requirements:
- Label meaningful arrows with actions or payloads: upload, fetch state, JSON schema result, classify, apply progress, save report, submit digest, push market snapshot, load GLB.
- Separate request/response traffic, scheduled jobs and build-time asset flow using line styles or a clear legend.
- Show the browser-to-game connection as HTTP REST. Do not invent live WebSocket synchronization for CareerSphere.
- The CareerApi client applies returned state to the UI. Do not imply guaranteed immediate push updates from external bot or market writes; a subsequent state fetch is needed.
- Keep market statistics connected to the market display. Do not invent automatic roadmap regeneration on market updates.
- Put testing and deployment in supporting lanes rather than between user-facing runtime steps.

Accuracy and status constraints:
- The main frontend is not React or Next.js. The game API is not Express. The chatbot API is FastAPI.
- React, Figma, PyTorch, cloud tools, and similar terms in the career skill catalog are not automatically implementation technologies.
- The game uses JSON files; SQLite belongs to the chatbot. Do not add PostgreSQL, MongoDB, Redis, vector databases or message queues.
- Do not add RAG, fine-tuning, model training, LangChain, Kubernetes or a completed CI/CD pipeline.
- Label the 3D base as adapted from Bruno Simon's Folio 2025. Distinguish inherited engine foundations from project-specific extensions.
- Treat implementation code, configurable integration, documentation-reported demo status and verified production deployment as different states.
- Deployment and external connectivity were not verified in the supplied review. Use “implemented; activation/configuration dependent” where appropriate.
- Telegram is the demo channel according to repository documentation; WhatsApp approval remains documentation-reported and unverified.
- n8n workflow configuration exists, but activation was not verified. The default weekly schedule is Monday 08:00 MYT.
- Job figures are JSearch samples, not nationwide totals; extraction is deterministic regex, not an LLM scraper.
- The game currently has one player save. Bot sender IDs are not mapped to separate game accounts.
- Friend-code leaderboard entries are manually exchanged score snapshots, not a live global ranking service.
- Do not show the removed exam/gym flow as an active feature.
- If future multi-user accounts, authentication or bot-account mapping are shown, put them in a separate “Future work” area with dashed outlines.
- Do not invent quantitative performance results or claim tests passed in this review.

Visual style:
- Clean technical infographic, light background, restrained purple/blue/teal accents.
- Give each subsystem a consistent color and a compact title.
- Each technology card should pair the technology name with a short responsibility.
- Use recognizable text labels even when logos are unavailable.
- Prioritize readable relationships and avoid crossed arrows, dense paragraphs, decorative 3D effects and tiny labels.
- Use English diagram labels and concise Chinese explanations.
- Include the title “CareerSphere — Technical Architecture & Data Flow”.

Before drawing, list any ambiguity that materially changes the architecture. Use the documented boundary when possible; ask only if the supplied information cannot resolve it. Do not fill gaps with fashionable technologies.

PROJECT DESCRIPTION AND TECHNICAL INVENTORY:
[Paste the supplied project description and, optionally, the technical inventory here.]
```

## 6. 另一种用途：个人技术学习路线

如果想画的是“为独立开发类似项目应该学什么”，将 prompt 的目标改成：

> Create a prerequisite-based learning roadmap for independently building a project like CareerSphere. Separate foundational, intermediate and advanced skills, connect prerequisites, and give one practical milestone per stage. Distinguish the implemented project stack from optional future technologies. Cover JavaScript/HTML/CSS and Git → REST and Node.js/Python → Three.js and assets → physics/navigation/animation → structured LLM integration → chatbot/webhooks/SQLite → market ETL/n8n → testing and deployment. Do not invent deadlines or claim mastery from using a tool once.

这属于学习路线；第 5 节则适合解释当前项目架构和数据流。
