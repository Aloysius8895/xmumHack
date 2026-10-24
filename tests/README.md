# Automated tests

Run commands from the repository root with Node.js 24+:

```sh
npm test                  # Game, workflow and recruitment service Node suites
npm run test:python       # Companion, AWS backend and data-processing Python suites
npm run test:all          # Both groups
```

Install JavaScript dependencies with `npm ci --prefix src/game` and `npm ci --prefix src/crawler`. Install Python dependencies with `python -m pip install -r requirements.txt`. The launcher uses the root `.venv` interpreter if it exists; set `PYTHON` to choose another interpreter. Each Python suite runs in a separate process to keep the chatbot and Lambda `app` modules isolated.

| Directory | Coverage |
| --- | --- |
| `game/server/` | Game API, AI providers, progress, localisation, market statistics and integrations |
| `game/sources/Career/` | Career UI helpers, language selection, history rendering and onboarding |
| `game/n8n/` | Market and learning workflow generation and payload handling |
| `game/world-building/` | Navigation and map boundary helpers |
| `crawler/` | Sampling, normalisation, deduplication, budgets and publication |
| `chatbot/` | Messaging channels, learning reports, AI and persistence |
| `aws/` | Optional Lambda backend, export/import helpers and infrastructure template |
| `data/` | Recruitment parsing, skill extraction and data quality |
| `browser/crawler/` | Browser interaction against local synthetic pages |

Use `node tests/run.mjs game`, `crawler` or `workflows` for a specific Node group. `npm run test:browser` additionally requires the sampling module's Playwright browser installation; it does not visit recruitment websites.

The browser-only physics fixture remains at [`src/game/sources/Game/Physics/character-physics.test.js`](../src/game/sources/Game/Physics/character-physics.test.js) because it is imported through Vite by [`verify_character_physics.py`](../src/tools/verify_character_physics.py), rather than run by Node.

Source-local `fixtures/` directories are kept beside their workflow/parser definitions. Offline tests use synthetic inputs and mocked providers; they do not request paid AI inference or a fresh market sample.
