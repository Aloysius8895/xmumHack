# Unified DeepSeek AI Implementation Plan

> **For agentic workers:** Execute this plan task by task in the current session. The user approved implementation on 2026-10-24.

**Goal:** Connect existing game, chatbot and n8n-backed AI features to the existing server-side DeepSeek key.

**Architecture:** Add explicit `deepseek` providers using the existing Anthropic SDKs and the official compatible endpoint. Convert PDF documents to bounded text for this provider. Keep n8n routing through the existing services and preserve AWS storage and alternate explicit providers.

**Tech Stack:** Node.js ES modules, Anthropic JavaScript/Python SDKs, pdf-parse, FastAPI, python-dotenv, generated n8n JSON.

## Global Constraints

- Never print, track or embed API keys in frontend code or workflow JSON.
- Preserve SDG, game rules, persistence, owner filtering, idempotency and summary-only workflows.
- Use `AI_PROVIDER=deepseek`, `DEEPSEEK_MODEL=deepseek-flash` and `DEEPSEEK_API_KEY`.
- Missing DeepSeek credentials must fail clearly without a provider fallback.
- No external messages, workflow activation, cloud provisioning or deployment.

### Task 1: Game provider and document compatibility

**Files:** `GamePlat/game/server/ai.js`, new `server/deepseek-input.js`, new `server/deepseek-local.test.mjs`, `package.json`, `package-lock.json`, `sources/Career/i18n.js`.

**Interfaces:** Keep `ask({ system, content, schema, ... })` and `reply({ system, messages, onText, signal, ... })`. Add `deepseekInput(content)` returning a promise of text or compatible blocks.

- [x] Add request-capturing tests using mocked fetch for official URL, DeepSeek-only headers, structured correction, images, errors and SSE streaming/cancellation. Add valid text-PDF and unreadable-PDF tests.
- [x] Add `deepseek` to the explicit provider list and model/status configuration. Initialize the SDK with `apiKey: process.env.DEEPSEEK_API_KEY`, `authToken: null`, `baseURL: 'https://api.deepseek.com/anthropic'`.
- [x] Reuse `askWithTool` and compatible streaming with thinking disabled. Preserve schema validation and one correction attempt; reject repeated missing tool calls correctly.
- [x] Convert base64 PDF blocks using `new PDFParse({ data }).getText()`, bound file bytes/pages/text and destroy parser resources in `finally`. Reject image-only, encrypted, malformed or excessive PDFs clearly. Preserve image/text blocks.
- [x] Update localized document errors and run `node --test server/deepseek-local.test.mjs server/ai-provider.test.mjs server/ai-deepseek.test.mjs`.

### Task 2: Chatbot provider and local runtime configuration

**Files:** `chatbot/app/ai.py`, `chatbot/run.py`, `chatbot/requirements.txt`, new `chatbot/tests/test_deepseek.py`, ignored game/chatbot `.env` files.

**Interfaces:** Keep `provider()`, `model_name()`, `reply(history)` and `complete(prompt)`; every caller including classification and standard digest uses `_complete`.

- [x] Test explicit DeepSeek selection with conflicting provider credentials; missing-key refusal; classification, conversation and digest calls using a mocked Anthropic client.
- [x] Add `deepseek` provider and model selection exclusively from `DEEPSEEK_MODEL`, default `deepseek-flash`. Use the official endpoint and thinking disabled, bounded output and a request timeout.
- [x] Load the chatbot-local `.env` from its absolute path at startup with `override=False` via python-dotenv so deployed secrets take precedence.
- [x] Set both ignored local configurations to the selected provider/model and copy the existing key without printing it. Preserve all other configuration.
- [x] Run `python -m pytest tests/test_deepseek.py tests/test_aws_backend.py` from `chatbot`.

### Task 3: Documentation, generated workflows and integration verification

**Files:** game/chatbot `.env.example`, `GamePlat/game/CAREER.md`, `chatbot/README.md`, `GamePlat/game/n8n/README.md`, `n8n/learning/build-workflows.mjs`, generated workflow JSON, approved design and this plan.

- [x] Document both services' configuration, startup, supported uploads, deployment secrets, preserved AWS provider distinction and n8n's delegated AI routing.
- [x] Update workflow setup notes, then run `npm.cmd run n8n:build` from the game directory.
- [x] Run game `node --test server/*.test.mjs`, `npm.cmd run n8n:test`, `npm.cmd run build`, and chatbot `python -m pytest`.
- [x] Use synthetic text for a minimal live structured request and streamed reply, plus chatbot utility call. Print only provider, model, credential-present boolean and short synthetic results; report any live verification limitation accurately.
- [x] Check `git diff --check`, tracked secret exposure and final status. Update completion checkboxes and report local changes and deployment/import steps without claiming deployed systems were changed.

## Review

The approved design's feature table is covered by the shared game and chatbot adapters. PDF compatibility is handled before either structured or conversation requests. n8n arithmetic/extractive summaries retain their existing semantics. Tests distinguish direct DeepSeek from the pre-existing AWS `deepseek_direct` provider.
