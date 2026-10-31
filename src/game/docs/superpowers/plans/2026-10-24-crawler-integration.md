# Recruitment crawler integration

**Goal:** Connect `src/crawler` to the existing game without replacing verified samples with demo records or failed collections.

**Design:** Keep the crawler as a separate Node.js process with its own SQLite database. Publish healthy runs to an authenticated, idempotent game endpoint. The game reads the last accepted snapshot; its existing processed sample remains the fallback. Monthly cells are the latest observed snapshot within each month and scope, never sums of weekly counts. Actual weekly comparisons retain the crawler's fourteen complete MYT days requirement.

**Applied user-provided skills:**
- `skills/Copy/scrap/Agent-Reach/agent_reach/skill/SKILL.md` and `references/web.md`: route public documentation reads through Jina Reader, retain provenance, use appropriate platform backends. Used the Jina route to verify the publisher's JSearch v2 documentation.
- `skills/Copy/scrap/browser-use/skills/browser-use/SKILL.md`: plain HTTP first; browser interaction only when needed, explicit waits, verify outcomes, stop at access gates. Reuse the existing Playwright adapter for dynamic pages; keep the unverified website template disabled. Neither CLI is installed locally, and neither becomes a game dependency.

**Boundaries:** No rea dependency, no paid queries without an available configured key, no public deployment. Preserve the existing player save and raw/processed job files. API keys stay in ignored server environment files. Demo exports cannot enter the live ingestion route. Scope/config changes restart comparable history.

- [x] Sync all 14 game careers (including FDE) and existing skill IDs into a separate generated crawler config; keep the standalone example and demo intact.
- [x] Share a versioned export/publish contract between CLI and service. Persist publication status, automatically publish healthy asynchronous runs, and expose final delivery status.
- [x] Add authenticated game ingestion with run-ID idempotency, payload validation, atomic storage, stale-run protection and last-good fallback. Adapt counts, per-career skill denominators, sampling diagnostics, monthly observations and actual weekly trends to the game's existing interface.
- [x] Show crawler collection/coverage/history status in the existing market UI with translations. Add game convenience commands and a bounded n8n polling workflow.
- [x] Configure reversible local defaults; verify contract and HTTP integration, replay/failed-run safety, browser extraction, desktop/mobile UI and production build.

**Interface:** `POST /api/integrations/crawler` uses `Authorization: Bearer INTEGRATION_TOKEN` and `Idempotency-Key: run.id`. Body contains `schemaVersion`, `idempotencyKey`, `isDemo`, `run`, `scope`, `summary`, and normalized `jobs` with source links. The endpoint returns `{accepted:true,runId,duplicate}`. The crawler's `GET /api/runs/:id` additionally returns a persisted `publication` state; HTTP 202 only acknowledges the start.

**Verification:** Core tests exercise actual SQLite and HTTP with injected provider responses. Synthetic inputs remain in temporary test databases and directories. Public-source network verification is separate from fixture tests; provider credentials are not required by this restricted game profile. No mock test records are published into the user's actual market snapshot.

## User steering implemented

Trends now has a Refresh button that starts a genuinely new collection, polls its run, prevents duplicate concurrent starts and reloads state only after publication. SQLite retains all observation versions; the UI reports first observed vs previously seen identities and recent same-scope samples.

The user restricted actual game collection to LinkedIn, Indeed and Ricebowl. The game profile, service handshake, URL checks and ingestion enforce this. It uses direct public LinkedIn pages and ordinary Chrome for Indeed/Ricebowl, with no API key needed. Standalone JSearch example code is not used by the game's refresh. A fully successful available-source subset can publish while inaccessible sources remain explicitly excluded; the effective subset changes scope and does not invent zero counts.

Plain HTTP was blocked by Cloudflare on Indeed/Ricebowl. Real ordinary Chrome loaded both homepages, Ricebowl search and a real JobPosting detail. Headless search was blocked. Indeed's dedicated browser session still required verification and the user reported the manual verification could not pass. No CAPTCHA action, stealth, proxy rotation or access-control bypass was implemented. That source remains unavailable until legitimate access changes; the other sources continue independently.

Completed checks: 41 crawler tests, 49 game checks, 2 dynamic browser extraction tests, desktop/mobile refresh UI and production build. A real new run successfully published 140 LinkedIn ads with 28 descriptions; failed collection retained the preceding legacy snapshot. The final browser-backed run published 476 MY ads (140 LinkedIn, 336 Ricebowl), 55 descriptions and four FDE ads, with Indeed excluded. It distinguishes 337 first-observed from 139 previously-seen identities. Data audit and live evidence are recorded under `docs/verification/crawler-integration/`.
