# CareerSphere Workflows Implementation Plan

> Implement inline in this session, keeping the user's existing work intact.

**Goal:** Deliver three project-specific n8n JSON exports, verified backend integration and a readable local overview.

**Architecture:** Generated workflow files call the existing Node game API and Python chatbot. Pure pipeline functions are embedded into n8n Code nodes. Credentials are assigned by users in n8n, never exported from .env.

**Tech Stack:** Node.js ESM, Python FastAPI/SQLite, built-in n8n nodes, Node test runner and pytest.

## Global Constraints

- Asia/Kuala_Lumpur; existing single-player save; no additional cloud storage dependency.
- Retain unrelated local changes. No secret values in JSON exports or documentation.
- Preserve weekly sample totals across repeated job IDs; block incomplete collection.
- n8n digest is summary-only; never award skill mastery twice.

## Tasks

- [x] Extend market pipeline and export with completeness checks, country filtering, minimal collection metadata and optional notifications. Test fixtures and execute generated Code nodes.
- [x] Persist collection identity history with weekly snapshots and return new/seen counts. Add backend message and digest retry protection under the existing save queue.
- [x] Add a synchronous n8n forwarding endpoint to the existing chatbot and propagate stable event identity to the game; support source-only daily summaries.
- [x] Generate Telegram ingress and daily digest workflows using the existing chatbot endpoints, with private-chat allowlist and visible branches.
- [x] Build the JSON exports and an offline HTML overview; document credentials, source templates, single-player scope, import steps and public HTTPS requirements.
- [x] Run Node integration/pipeline tests and Python chatbot tests. Review diffs and JSON/source synchronization. Report external credential-dependent checks separately.

Validation: 19 workflow/backend tests and 15 existing Node integration tests passed. Python initially had 75 passes and 5 environment failures; after an additional retry regression test, the available suite passed 76 tests with one SDK test deselected and the four dependency-floor cases excluded. Full-suite blockers are missing anthropic/httpx2/httpcore2, old certifi (2025.8.3 vs required 2026.10.19), and old Pygments (2.19.1 vs required 2.21.0). No dependency requirements were relaxed. JSON/source consistency and overview JavaScript syntax passed. Browser inventory was empty, so visual preview inspection was unavailable. No real JSearch calls, bot webhook changes or execution inside an n8n instance were performed.
