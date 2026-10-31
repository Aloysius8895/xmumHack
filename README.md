> [!IMPORTANT]
> ## 📁 Submission Documents & Templates
> - **Final Project & Prototype Report:** [SDC2026_ChillChill_FinalReport.pdf](submission/SDC2026_ChillChill_FinalReport.pdf)
> - **Technology Declaration (Finalist, content corrections pending):** [SDC2026_ChillChill_TechDeclaration.pdf](submission/SDC2026_ChillChill_TechDeclaration.pdf)
> - **RunPod Proof of Use:** [SDC2026_Chill_chill_Runpod_POU.pdf](submission/SDC2026_Chill_chill_Runpod_POU.pdf)
>
> The declaration PDF has only been renamed. Sections 5 and 7 still require corrections and a fresh export from the unavailable editable Word source; see the submission index.
>
> The submission documents are indexed in [`submission/README.md`](submission/README.md).
>
> ### 👉 [Organizer's Submission Templates](https://drive.google.com/drive/folders/1xw7c2aN8N-at8hPEULzkcU76e_FFb0Ef) 👈

---

# KerjayaKu

> An AI-assisted career exploration and learning platform that helps Malaysian students understand their skill gaps and adapt their learning to different AI futures.

---

## Team Information

| Field | Details |
| --- | --- |
| **Team Name** | Chill Chill |
| **Team Domain** | Domain 1 |
| **SDG Track (1–17)** | Project alignment: **SDG 4 — Quality Education**, especially Target 4.4; secondary alignment with **SDG 8, Target 8.5**. The officially registered track still needs team confirmation. |
| **Team Leader** | Edixon Teo Zan Wei |
| **University** | Taylor's University |
| **Number of Members** | 5 |

## Links

| Resource | Link |
| --- | --- |
| GitHub Repository | [Aloysius8895/xmumHack](https://github.com/Aloysius8895/xmumHack) |
| Live Demo | [KerjayaKu on Render](https://kerjayaku-demo.onrender.com) |
| Telegram Companion | [@KerjayaKu_bot](https://t.me/KerjayaKu_bot) |
| Chatbot Health | [Render Python service](https://kerjayaku-telegram.onrender.com/health) |
| Slide Deck | [Presentation](https://docs.google.com/presentation/d/1MddUwzMtFSRZZmYID8qy4wQ3y4eY9ijR/edit?usp=sharing&ouid=113147406681252215799&rtpof=true&sd=true) |
| Demo Video | [YouTube demo](https://youtu.be/06NzNKKvYsE?si=GA4b8PcWnC-9z5yu) |

The Render services are currently on the free plan. Idle services can sleep, and local JSON/SQLite data can be lost on restart, redeploy or spin-down. A separately approved [persistent deployment](render.persistent.yaml) is prepared but has not been enabled. See [deployment details](docs/render-deployment.md).

Public URLs were checked on **1 November 2026** and returned HTTP 200. This checks reachability, not Google sharing permissions, video playback, 3D rendering or successful AI calls.

---

## Overview

### Problem

Students often know a career title without knowing which skills to learn next. Recruitment information, personal ability and learning progress are scattered across different tools. AI-driven changes add uncertainty: students need a way to compare assumptions and revise their plans as they learn.

### Solution

KerjayaKu connects a student's profile, recruitment evidence, career matching and an actionable learning roadmap inside a playable 3D world. Deterministic rules calculate career scores and skill priorities; AI helps interpret profiles, explain evidence and write learning tasks. Moderate and Extreme scenarios help students compare learning priorities under different assumptions, while check-ins and Telegram learning reports support continued progress.

### Key Features

1. **Profile** — Build an editable skill profile from a CV, experience or manually entered skills.
2. **Signals** — Explore dated recruitment samples, skill demand and source coverage. Missing or simulated data must be interpreted with their limitations.
3. **Match** — Compare skills with career requirements and inspect the gaps behind a recommendation.
4. **Pathway** — Follow ordered learning tasks and resources, review learning at weekly check-ins, and verify Telegram learning reports with short quizzes. Check-ins can propose adjustments to the next learning tasks.
5. **SDGs** — Connect career skills to specific Sustainable Development Goal targets. Preparation indicators do not measure actual social impact.
6. **Scenarios** — Compare Moderate and Extreme AI-adoption assumptions and adapt learning priorities. AEI describes task-level AI use; scenario scores are estimates, not guarantees about employment or skill obsolescence.

The interface supports English, Chinese and Malay, with career pets, mentor conversations and a replayable beginner tour. Expert characters use AI interpretations of documented perspectives; they are not the real people.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | JavaScript ES modules, Three.js, WebGPU/WebGL 2, Rapier, GSAP, Howler, Stylus, Vite |
| Backend | Node.js HTTP game API; separate Python FastAPI/Uvicorn chatbot |
| Database | Current Render deployment: JSON game saves and SQLite chatbot storage on ephemeral filesystems. Optional PostgreSQL/AWS storage is implemented but not enabled there. |
| AI / Compute | DeepSeek for the game and Telegram chatbot |
| Data / Integrations | Anthropic Economic Index, recruitment samples and reference datasets; optional crawler and n8n workflows |
| Hosting / Dev | Render web services and GitHub |

---

## Project Structure

```text
.
├── docs/                         # Architecture, deployment, screenshots and records
│   ├── architecture.md
│   ├── render-deployment.md
│   ├── reference/                # Archived upstream mirror and research evidence
│   ├── reviews/                  # Submission/presentation consistency reviews
│   └── verification/             # Existing screenshots and verification reports
├── src/
│   ├── game/                     # Three.js frontend and Node.js backend
│   │   ├── server/index.js       # Production game/API entry point
│   │   ├── sources/              # Frontend source
│   │   └── static/               # Runtime models, textures and audio
│   ├── chatbot/                  # Telegram/WhatsApp companion
│   │   ├── run.py                # Python service entry point
│   │   ├── app/
│   │   └── scripts/              # Telegram webhook registration
│   ├── crawler/                  # Optional recruitment collection service
│   ├── aws/                      # Optional cloud persistence backend
│   ├── data/                     # Data processing, mappings and historical inputs
│   ├── expert/                   # Runtime mentor reference cards
│   ├── assets/                   # Editable environment source assets
│   ├── character/                # Editable character assets
│   ├── model/                    # Source models
│   ├── scripts/                  # Maintenance utilities
│   └── tools/                    # Verification and reference-viewing tools
├── data/                         # Runtime AEI, market and reference datasets
├── submission/                   # Organizer-required submission documents
│   ├── SDC2026_ChillChill_FinalReport.pdf
│   ├── SDC2026_ChillChill_TechDeclaration.pdf
│   └── SDC2026_Chill_chill_Runpod_POU.pdf
├── tests/                        # Game, chatbot, crawler, data and AWS suites
├── .env.example                  # Public game environment example
├── .gitignore
├── render.yaml                   # Two free Render services
├── render.persistent.yaml        # Paid opt-in persistent deployment
├── package.json                  # Root development/build/test commands
├── requirements.txt              # Shared Python dependency entry point
├── LICENSE
└── README.md
```

The template's Python example entry points are adapted to this JavaScript/Python monorepo. Runtime `data/` and module paths are retained because the game imports them directly. Local `.env`, saves, databases, caches and dependencies are excluded from Git. Older modules may use the development name **CareerSphere**.

### Architecture

```mermaid
flowchart LR
    Browser[Browser: 3D world] --> Game[Node.js game API]
    Telegram[Telegram] -->|HTTPS webhook| Bot[FastAPI chatbot]
    Bot -->|Authenticated integration API| Game
    Game --> AI[DeepSeek]
    Bot --> AI
    Game --> Data[AEI and recruitment datasets]
    Game --> Save[Game save / optional cloud storage]
    Bot --> SQLite[Chat history and report receipts]
```

See [architecture and service boundaries](docs/architecture.md). Current production runs the game and chatbot as separate Render services. The optional crawler and n8n schedules require separate setup.

---

## How to Run

### Run Locally

Requirements: **Node.js 24+**, npm, a hardware-accelerated browser with WebGPU or WebGL 2, and Python 3.11+ for the optional companion/data tools.

```bash
git clone https://github.com/Aloysius8895/xmumHack.git
cd xmumHack
npm ci
npm ci --prefix src/game
cp .env.example src/game/.env
# Edit src/game/.env: use AI_MOCK=1 or supply your private AI credentials.
npm run dev
```

Open **http://localhost:5000**. In PowerShell, use `Copy-Item .env.example src/game/.env` and `npm.cmd` if script execution policy blocks `npm`. Restart after changing environment variables.

For the production game server:

```bash
npm run build
npm start
```

It defaults to **http://127.0.0.1:8787**. Cloud services use their assigned `PORT` and `HOST=0.0.0.0`.

For the Telegram companion, use a separate terminal from the repository root.
Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

In PowerShell, replace the `source` command with `.\.venv\Scripts\Activate.ps1`.
Then install dependencies, configure the companion and start it:

```bash
python -m pip install -r requirements.txt
cp src/chatbot/.env.example src/chatbot/.env
# Configure Telegram, DeepSeek, CAREERSPHERE_API_URL and matching INTEGRATION_TOKEN.
python src/chatbot/run.py
```

In PowerShell, use `Copy-Item src/chatbot/.env.example src/chatbot/.env` for the
copy step. If activation is blocked by execution policy, use
`.\.venv\Scripts\python.exe` in place of `python` for installation and startup.
The local companion's health URL is **http://127.0.0.1:8000/health** unless `PORT`
is overridden. It runs separately from the game server.

Use `CAREERSPHERE_API_URL=http://localhost:5000` with the local dev game, or the deployed game HTTPS URL in the cloud. Set exactly one `TELEGRAM_ALLOWED_USER_IDS` for learning verification and `/expert`. Both services must share `INTEGRATION_TOKEN`. Webhook registration requires the chatbot's public HTTPS URL, not localhost. Follow the [Render/webhook guide](docs/render-deployment.md).

Optional recruitment sampling: [crawler setup](src/crawler/README.md). Optional cloud storage: [AWS guide](src/aws/README.md). The current game uses a shared save; separate authenticated multi-user accounts remain future work.

### Run Tests

```bash
npm --prefix src/game test                  # Game API, UI helpers and workflows
npm ci --prefix src/crawler
npm test                                   # All Node suites
npm run test:python                        # After installing requirements.txt in .venv
```

The [test guide](tests/README.md) lists the isolated suites and browser requirements. Offline tests use synthetic inputs and mocked providers. Deployment health checks do not prove GPU rendering or real Telegram command outcomes.

---

## Challenges & Learnings

- **Evidence quality:** Recruitment samples have incomplete coverage; simulated history and imputed skill values must not be described as observed vacancies or AI measurements.
- **AI uncertainty:** Scenario parameters are planning assumptions. Task exposure cannot establish that an entire career will disappear.
- **Adaptive learning:** Replanning must preserve existing progress and skill foundations. A completed checkbox or self-report alone does not certify mastery.
- **Deployment boundaries:** A Node web service does not run Python automatically. Telegram needs its own service, matching authentication and a fixed HTTPS webhook.
- **Persistence:** Free service filesystems are temporary. Cloud persistence requires an explicitly configured database or paid disk, plus migration and restart verification.

## Future Improvements

- [ ] Enable approved always-on services and durable game/chatbot storage.
- [ ] Add authenticated accounts and isolated per-user saves.
- [ ] Gather more comparable recruitment observations across regions and seniority levels.
- [ ] Validate roadmap usefulness with students and career advisers.
- [ ] Improve accessibility and performance on lower-powered devices.

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Edixon Teo Zan Wei | Team Lead; Telegram integration | [@edixontzw](https://github.com/edixontzw) |
| Chong Lee Khim | Backend | [@LeeKhim28](https://github.com/LeeKhim28) |
| Khor Qi Xuan | 3D Model Artist | [@qixuan0240](https://github.com/qixuan0240) |
| Ngan Kim Sing | 3D Model Artist | [@ngankingsing06-debug](https://github.com/ngankingsing06-debug) |
| Aloysius Ting Zi Heng | Backend, AI model and data | [@Aloysius8895](https://github.com/Aloysius8895) |

---

## Submission Checklist

- [x] Team name, domain, leader and member information filled in.
- [ ] Team confirms the officially registered SDG track.
- [x] Slide deck and demo video links added.
- [x] Supplied finalist project report and technology declaration included under standardised filenames; RunPod proof of use restored.
- [ ] Re-export the technology declaration from its editable Word source with the Section 5 sponsor disclosures and Section 7 checklist corrections.
- [ ] Team confirms final PDF contents, signatures and submission readiness.
- [x] Local production build and game/chatbot regression suites verified during deployment work.
- [x] Render public health, service authentication and fixed webhook URL verified during deployment work.
- [ ] Owner completes real Telegram `/start`, learning-report and `/expert` acceptance checks.
- [x] Private `.env`, local saves and databases excluded from Git.
- [ ] Final submission owner reviews third-party assets, public links and repository history for release.

## License

This repository includes an [Apache License 2.0](LICENSE). The game foundation is adapted from Bruno Simon's *folio-2025* and retains its [MIT license notice](src/game/license.md). Third-party code, datasets and assets retain their respective licenses; see [reference provenance](docs/reference/README.md).
