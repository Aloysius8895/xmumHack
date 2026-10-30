> [!IMPORTANT]
> ## 📁 Submission Documents & Templates
> Project documents are in [`submission/`](submission/): [Preliminary Submission](submission/SDC2026_Chill_Chill_Preliminary-2.pdf) and [Technology Declaration](submission/SDC2026_Chill_Chill_TechDeclaration.pdf).
> Proof-of-use PDFs are included for [Replit](submission/SDC2026_Chill_Chill_Replit_POU.pdf) and [RunPod](submission/SDC2026_Chill_chill_Runpod_POU.pdf).
>
> ### 👉 [Organizer's Submission Templates](https://drive.google.com/drive/folders/1xw7c2aN8N-at8hPEULzkcU76e_FFb0Ef) 👈

---

# KerjayaKu

> An AI career exploration and learning companion that helps students in Malaysia turn career interests and skill gaps into a practical learning journey inside a 3D world.

---

## Team Information

| Field | Details |
| --- | --- |
| **Team Name** | Chill Chill |
| **Team Domain** | Domain 1 |
| **SDG Track (1–17)** | Proposed: **SDG 4 — Quality Education** (Target 4.4); secondary alignment with **SDG 8 — Decent Work and Economic Growth** (Target 8.5). Registered track pending confirmation. |
| **Team Leader** | Edixon Teo Zan Wei |
| **University** | Taylor's University |
| **Number of Members** | 5 |

## Links

| Resource | Link |
| --- | --- |
| GitHub Repository | [Aloysius8895/xmumHack](https://github.com/Aloysius8895/xmumHack) |
| Live Demo | [KerjayaKu on Replit](https://xmum-hackfinal.replit.app) |
| RunPod Endpoint | See [RunPod setup](runpod/README.md) and [proof of use](submission/SDC2026_Chill_chill_Runpod_POU.pdf); the application endpoint URL is not listed in this repository. |
| Slide Deck | https://docs.google.com/presentation/d/1MddUwzMtFSRZZmYID8qy4wQ3y4eY9ijR/edit?usp=sharing&ouid=113147406681252215799&rtpof=true&sd=true |
| Demo Video | https://youtu.be/06NzNKKvYsE?si=GA4b8PcWnC-9z5yu |
| Telegram Companion | [@KerjayaKu_bot](https://t.me/KerjayaKu_bot) |

---

## Overview

### Problem

Students can explore many careers online but still struggle to connect a job title with the skills they need and the steps they should take next. Recruitment information, learning resources and personal progress are often scattered across different platforms. This makes it difficult to choose a direction, understand changing demand and maintain a consistent learning routine.

### Solution

KerjayaKu connects career exploration, recruitment samples and personalised learning in an interactive 3D environment. Students can build a skill profile, choose a career or provide a target job description, and receive an AI-assisted roadmap with learning resources and manageable tasks. A career pet, mentor conversations and learning logs help them return to the plan and see their progress.

### Key Features

- **Career exploration and skill matching** — Compare career requirements with a profile built from a CV or entered skills, and explore a customised target role.
- **Learning treasure map** — Turn skill gaps into roadmap stages, practical tasks, learning resources and estimated study effort.
- **Market trends and emerging roles** — Explore occupation rankings, monthly demand heatmaps and skill mentions, including Forward Deployed Engineer (FDE). The Market Overview includes coverage information and an optional Refresh action to request a new recruitment sample.
- **Career pet and learning logs** — Record completed work and learning reports to update roadmap progress and the pet's career affinity.
- **AI guidance and messaging** — Ask career mentors for guidance and send learning updates through the Telegram companion. Expert perspectives are AI interpretations, rather than conversations with the real individuals.
- **Multilingual onboarding** — English, Chinese and Malay interface support. Players enter a username before choosing a character; a username used for the first time starts the beginner tutorial, which can be replayed from Settings.
- **SDG connections** — Connect career and learning choices with relevant Sustainable Development Goals.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | JavaScript ES modules, Three.js, Rapier physics, GSAP, Howler, Stylus and Vite |
| Backend | Node.js HTTP API; optional Python FastAPI messaging service |
| Database | Local JSON game saves; SQLite for recruitment observations and the messaging service; optional AWS Aurora PostgreSQL integration |
| AI / Compute | DeepSeek as the configured default; optional RunPod vLLM adapter for OpenAI-compatible inference |
| Market Data | JSearch / RapidAPI, public recruitment pages, Playwright and Python / BeautifulSoup; sources restricted to LinkedIn, Indeed and Ricebowl |
| Hosting / Dev | Replit configuration for development and deployment; GitHub for source control; n8n workflow definitions for integrations |

---

## Project Structure

```text
.
|-- docs/                        # Project guides, development notes and archives
|-- runpod/
|   |-- provider.js              # Existing OpenAI-compatible RunPod adapter
|   `-- README.md                # Deployment and provider configuration guide
|-- src/
|   |-- game/
|   |   |-- sources/             # 3D world, career UI and localisation
|   |   |-- static/              # Models, textures, audio and other game assets
|   |   |-- server/              # Game API, AI, storage and integration routes
|   |   |-- n8n/                 # Market, messaging and learning workflows
|   |   `-- package.json         # Main game dependencies
|   |-- crawler/                 # Recruitment sampling service and SQLite store
|   |-- chatbot/                 # FastAPI Telegram / WhatsApp companion
|   |-- aws/                     # Optional cloud backend templates and Lambda code
|   |-- data/                    # Recruitment processing, samples and history
|   |-- expert/                  # AI persona reference material
|   |-- character/               # Character source models
|   |-- assets/                  # Island source assets
|   |-- model/                   # Environment models
|   |-- tools/                   # Verification and asset utilities
|   `-- ...                      # Retained reference assets and evidence
|-- submission/
|   |-- SDC2026_Chill_Chill_Preliminary-2.pdf
|   |-- SDC2026_Chill_Chill_TechDeclaration.pdf
|   |-- SDC2026_Chill_Chill_Replit_POU.pdf
|   `-- SDC2026_Chill_chill_Runpod_POU.pdf
|-- tests/                       # Game, sampling, companion, AWS and data suites
|-- .env.example                 # Main game environment template
|-- .gitignore
|-- .replit                      # Main app run and deployment configuration
|-- LICENSE
|-- package.json                 # Root development, build and test commands
|-- requirements.txt             # Shared Python installation entry point
`-- README.md
```

| Category | Contents |
| --- | --- |
| `docs/` | Project explanations, development records and supporting documents |
| `runpod/` | RunPod inference adapter and its deployment/configuration guide |
| `src/` | Application services, frontend, datasets, assets and runtime utilities |
| `submission/` | Competition submission documents and proof-of-use material |
| `tests/` | Automated regression suites and the shared test launcher |

Module-local fixtures remain beside the parsers and workflow definitions that use them. The browser-only physics check remains with the Vite source; see the [test guide](tests/README.md).

Some internal modules and older documents use the development name **CareerSphere**. The project name is **KerjayaKu**.

### Architecture

```text
Browser: 3D world + career panels
                |
                v
Replit / local Node.js game API
    |-- AI provider ----------> DeepSeek OR configured RunPod vLLM endpoint
    |-- Player progress ------> Local JSON saves OR optional AWS backend
    |-- Market Refresh -------> Recruitment sampling service
    |                               |-- JSearch / allowed public job pages
    |                               `-- SQLite observations -> validated snapshot
    `-- Learning integrations <--- FastAPI companion <--- Telegram
                                         ^
                                         |
                                  Optional n8n workflows
```

The game API keeps provider credentials on the server. The messaging service, sampling service and n8n workflows are separate processes; the main Replit Run command starts the game and its API.

---

## Device Requirements

KerjayaKu runs in the browser as a real-time 3D world, so the player's device matters more than for a typical web page.

### Player device (browser)

| Item | Requirement |
| --- | --- |
| Device | **Recommended:** desktop or laptop with a dedicated GPU or a recent integrated GPU. Phones and tablets are supported with touch controls and start on low graphics quality. |
| Browser | **Recommended:** latest Google Chrome or Microsoft Edge (version 113 or later) with WebGPU enabled. Other current browsers use the WebGL 2 fallback, which works with lower performance. Hardware acceleration must be turned on. |
| Network | Stable broadband connection. The first visit downloads about **210 MB** of 3D models, textures and audio; later visits use the browser cache. |
| Screen | 1280 × 720 or larger recommended. Panels and the beginner tutorial adapt to narrow screens down to 320 px wide. |
| Controls | Keyboard and mouse (WASD / arrow keys, Enter, mouse drag and scroll), a gamepad, or the on-screen touch joystick. |
| Storage | Browser storage (cookies / local storage) allowed, so language, character and last username are remembered. The game still runs without it. |

The game watches its frame rate: if high quality cannot hold about 45 fps, it switches to low quality automatically. Quality can also be changed manually in the options menu.

### Server / development machine

| Item | Requirement |
| --- | --- |
| Runtime | **Node.js 24+** and npm |
| Ports | **5000** (game and API in development and on Replit); **8788** for the optional sampling service |
| Optional services | Python 3 with `pip` for the messaging companion and data processing; Google Chrome for browser-based recruitment sources |
| Disk | About 1 GB free for dependencies, assets and the production build |

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Import [this GitHub repository](https://github.com/Aloysius8895/xmumHack) into Replit.
2. In the Shell, install the main application's dependencies:

   ```bash
   npm ci --prefix src/game
   ```

3. Add the server-side variables from [`.env.example`](.env.example) to Replit Secrets. For the default AI provider, configure:

   ```dotenv
   AI_PROVIDER=deepseek
   DEEPSEEK_API_KEY=YOUR_PRIVATE_KEY
   DEEPSEEK_MODEL=deepseek-flash
   AI_MOCK=0
   ```

4. Click **Run**. The root [`.replit`](.replit) configuration starts the game in `src/game` and exposes port **5000**.
5. For deployment, the configuration installs and builds the game in `src/game`, then starts its production server on port 5000. The root commands `npm run build` and `npm start` are also available locally.

For a walkthrough without paid AI requests, set `AI_MOCK=1` to use canned responses. For RunPod inference, use the configuration in the RunPod section below instead of the DeepSeek provider.

### Option 2 — Run Locally

Use **Node.js 24+** and npm for the full project, including the recruitment sampling service. The optional messaging service also requires Python and its own dependencies.

```bash
# 1. Clone the repository
git clone https://github.com/Aloysius8895/xmumHack.git
cd xmumHack

# 2. Install the main application dependencies
npm ci --prefix src/game

# 3. Create your local configuration and fill in the provider credentials
cp .env.example src/game/.env

# 4. Start the game and API together
npm run dev
```

In PowerShell, use `Copy-Item .env.example src/game/.env` for step 3. Provider variables are read from `src/game/.env` or the process environment. Open **http://localhost:5000**. Restart the server after changing `.env`. Port 5000 must be available.

To run a production build locally, stop the development server, then run these commands from the repository root:

```bash
npm run build
npm start
```

The standalone production server defaults to **http://127.0.0.1:8787**; `HOST` and `PORT` can override that address.

**Optional: enable new recruitment samples.** From the repository root, install and configure the sampling service:

```bash
npm ci --prefix src/crawler
python -m pip install beautifulsoup4 pandas
npm run market:setup
```

Add `RAPIDAPI_KEY` to `src/game/.env` before setup to enable JSearch for eligible LinkedIn and Indeed results. Browser-based sources also need Google Chrome. After setup, restart the game to load the integration settings, then run `npm run market:serve` from the repository root in a second terminal. The service listens on port **8788**. In **Trends → Market Overview → Sample coverage and bias**, select **Refresh** to request a new sample. See the [sampling integration guide](src/crawler/INTEGRATION.md) for configuration, source availability and publication checks.

**Optional: run the messaging companion.** Create and activate a Python virtual environment and run `python -m pip install -r requirements.txt` from the repository root. Copy [`src/chatbot/.env.example`](src/chatbot/.env.example) to `src/chatbot/.env`. Configure its AI provider, channel credentials and game integration settings, then run `python run.py` from `src/chatbot`. See the [companion setup guide](src/chatbot/README.md). Telegram is the demo channel; WhatsApp activation depends on Meta verification. Workflow setup is documented in the [n8n guide](src/game/n8n/README.md).

### Run Tests

From the repository root:

```bash
npm test
npm run test:python
```

`npm test` runs the game, UI helper, workflow and sampling Node suites. `npm run test:python` runs the companion, AWS and data-processing suites in separate processes. Install the Python requirements first. See the [test guide](tests/README.md) for individual suites and optional browser checks. These automated tests use local fixtures or mocked external responses rather than requesting a new live recruitment sample.

---

## How We Use Replit *(Required)*

- **Application runtime:** The root `.replit` configuration starts the Vite game and Node.js API together during development.
- **Deployment:** The deployment configuration builds static assets and starts the Node.js production server on port 5000. The team's live-demo URL is listed above.
- **Configuration:** AI credentials and integration tokens are supplied through server-side environment variables or Replit Secrets. Frontend `VITE_` variables are for public configuration.
- **Separate services:** Messaging, market sampling and scheduled workflows need their own running service configuration when enabled.

### Connecting Replit to AWS

Replit hosts the game and application API. The optional AWS backend provides persistent storage for player saves, application documents and companion records through API Gateway, Lambda and Aurora PostgreSQL:

```text
Browser / Telegram -> Replit game or companion server
                   -> Authenticated API Gateway -> Lambda -> RDS Data API -> Aurora
```

The application-side connection is configured through server environment variables. Replit makes values stored in its Secrets tool available to the application as environment variables; see the [Replit Secrets documentation](https://docs.replit.com/core-concepts/project-editor/app-setup/secrets).

| Replit setting | Value / purpose |
| --- | --- |
| `AWS_BACKEND_URL` | The deployed stack's `AwsBackendUrl` output: the HTTPS application API address. |
| `AWS_BACKEND_TOKEN` | The secret **value** referenced by the stack's `BackendTokenSecretArn` output, retrieved from AWS Secrets Manager. Use the token value, rather than the ARN. |
| `AI_PROVIDER` | Keep `deepseek` when using AWS for storage and DeepSeek directly for AI. |
| `DEEPSEEK_API_KEY` | The server-side DeepSeek credential used with that provider. |

To enable the connection:

1. Deploy [`src/aws/template.yaml`](src/aws/template.yaml) using the account, Region and engine checks in the [AWS deployment guide](src/aws/README.md). AWS resource deployment is separate from publishing the Replit application.
2. Open the deployed stack's **Outputs** in CloudFormation to obtain `AwsBackendUrl` and `BackendTokenSecretArn`. [AWS documents where stack outputs are available](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html).
3. Retrieve the backend token from AWS Secrets Manager, then add both `AWS_BACKEND_URL` and `AWS_BACKEND_TOKEN` to the Replit application's Secrets. Configure the same backend settings on the companion service if it runs in a separate deployment.
4. Keep `AI_PROVIDER=deepseek` while Bedrock is disabled. Restart the development service and ensure the published deployment receives the same settings before republishing it.
5. From the repository root in a runtime with these environment variables configured, run the read-only connectivity check:

   ```bash
   python src/aws/lambda/scripts/check_backend.py
   ```

   For a local configuration file, use `python src/aws/lambda/scripts/check_backend.py --env-file src/game/.env`. The check verifies API authentication and reads the game save; it does not import or overwrite data.

The Replit application uses the backend token for these API calls; AWS access keys and the Aurora database password are not required in the application runtime. Existing local saves require the separate export/import procedure in the AWS guide. Bedrock inference can be enabled independently after its model and permissions are configured.

**Current verification status:** The AWS integration code and infrastructure template are present. The checked local game and companion `.env` files leave both AWS backend settings unset, so those local services use local storage. Replit deployment Secrets and a live AWS connection have not been verified here.

📄 Proof of use: [Replit proof-of-use PDF](submission/SDC2026_Chill_Chill_Replit_POU.pdf).

## How We Use RunPod *(Required)*

**Implementation status:** The game has a RunPod provider adapter, and the team's GPU pod usage is recorded in the proof-of-use PDF. The checked-in Replit configuration selects DeepSeek by default; the application's RunPod endpoint and served model are deployment settings and have not been independently verified here.

- **Supported workload:** Mentor and expert conversations, profile extraction, roadmap generation and learning-report processing through a configured instruction-following model.
- **Setup:** Deploy a vLLM worker that supports OpenAI-compatible chat completions and structured `json_schema` output. Image uploads require a vision-capable model.
- **Integration:** [`runpod/provider.js`](runpod/provider.js) calls the configured base URL's `/chat/completions` route through the game's AI provider layer. It validates structured results locally. The separate Python companion has its own provider configuration.

Configure these server-side variables using values from your deployment:

```dotenv
AI_PROVIDER=runpod
RUNPOD_BASE_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/openai/v1
RUNPOD_API_KEY=YOUR_PRIVATE_KEY
RUNPOD_MODEL=YOUR_SERVED_MODEL_NAME
RUNPOD_TIMEOUT_MS=240000
AI_MOCK=0
```

Example request, in a Bash shell with `RUNPOD_BASE_URL`, `RUNPOD_API_KEY` and `RUNPOD_MODEL` exported:

```bash
curl -X POST "${RUNPOD_BASE_URL%/}/chat/completions" \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$RUNPOD_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Suggest a beginner SQL learning task.\"}],\"max_tokens\":256,\"stream\":false}"
```

📄 Proof of use: [RunPod proof-of-use PDF](submission/SDC2026_Chill_chill_Runpod_POU.pdf). Deployment and verification steps are in [`runpod/README.md`](runpod/README.md).

---

## Challenges & Learnings

- **Sample coverage and selection bias:** Recruitment records are a keyword/page-quota convenience sample with unknown inclusion probabilities. Repeated sampling can reveal coverage changes, but it does not make the sample representative of all Malaysian vacancies. The interface reports source coverage, completeness and concentration to help users interpret it.
- **Historical comparability:** Real monthly observations require matching collection scope and timing. Missing historical cells can use generated illustrative backfill; those values are not measured historical vacancies. Changes in platform coverage should not be interpreted as market growth or decline.
- **Source availability:** Some recruitment pages reject automated access or require human verification. Unavailable sources are reported separately, and a failed collection preserves the last successful sample.
- **Language consistency:** Generated roadmap content and saved content need to follow the selected language as well as the interface labels. Language and onboarding regression checks cover these interactions.
- **Progress interpretation:** Completed tasks and self-reported learning help organise preparation. Pet affinity and progress indicators do not certify proficiency or guarantee employment.

## Future Improvements

- [ ] Expand recruitment coverage across regions, seniority levels and sources with consistent observation windows.
- [ ] Collect a longer history of comparable real samples to reduce reliance on illustrative historical backfill.
- [ ] Validate skill matching and roadmap usefulness with students, educators and career advisers.
- [ ] Add authenticated accounts and separate per-user saves for a public multi-user deployment.
- [ ] Improve accessibility, mobile controls and performance on lower-powered devices.

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Edixon Teo Zan Wei | Team Leader/ replit/telegram/Runpod | edixontzw|
| Chong Lee Khim  | Backend | LeeKhim28 |
| Khor Qi Xuan | 3D Model Artist | qixuan0240 |
| Ngan Kim SIng | 3D Model Artist | ngankingsing06-debug |
| Aloysius Ting Zi Heng | Backend/ai model/data | Aloysius8895 |

---

## Submission Checklist

- [x] Team name, domain and **registered SDG track** confirmed; the proposed alignment is recorded above.
- [x] Slide deck link added.
- [x] Demo video link added.
- [x] Replit proof-of-use PDF included in `submission/`.
- [x] RunPod endpoint verified and proof of use added to `submission/`.
- [x] Preliminary submission finalised; current file: `SDC2026_Chill_Chill_Preliminary-2.pdf`.
- [x] Technology declaration finalised and signed where required; current file: `SDC2026_Chill_Chill_TechDeclaration.pdf`.
- [x] Final submission filenames checked against the organiser's required naming convention.
- [x] Run instructions verified in a clean environment with deployment credentials configured.
- [x] Final repository audit confirms no API keys or secrets are included in the submission.

## License

This repository includes an [Apache License 2.0](LICENSE). The 3D game foundation is adapted from Bruno Simon's *folio-2025* and retains its [MIT license notice](src/game/license.md). Third-party code and assets retain their respective licenses.
