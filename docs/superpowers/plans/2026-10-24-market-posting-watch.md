# Collected market and customised posting watch implementation plan

Goal: show the user's collected sample in trends/career/skill heat, inspect n8n runtime, and notify roadmap users when a linked customised posting changes.

Architecture: read local processed artifacts with a versioned cache and notify open tabs through existing SSE; preserve sample and insufficient-history semantics. Store monitoring state with each customised target (including shelved careers), compare stable job content, and regenerate only on the user's explicit action. A scheduled n8n HTTP workflow invokes authenticated server checks; it does not duplicate the collection scheduler or send external messages.

Constraints: reuse existing JSON/AWS save boundary; never replace learning progress on detection; require a LinkedIn/Indeed source URL; first successful fetch establishes a baseline; 403/429/auth/parse failures are failures, not posting changes; unknown values remain unknown. Existing targets without links must expose a link attachment control.

- [x] Add server/collected-market.js: read jobs/job_skills/quality_report atomically enough to reject inconsistent generations; compute per-career sample shares and per-skill usable-description denominators. View shows one collected sample column and no fabricated monthly growth. Watch processed outputs with debounced SSE.
- [x] Add server/posting-watch.js: URL validation, bounded public-page fetch, stable content extraction/hash, per-target baseline/latest/pending revision, duplicate notification suppression and check status. Use source IDs, never company/title guesses.
- [x] Extend app routes: attach link, authenticated scheduled check/status, and transactional re-analyse/regenerate using the latest revision. Include metadata in existing game state and update CareerApi/CareerUI/i18n for multilingual reminders, links and regenerate actions.
- [x] Build n8n/posting-watch workflow with manual and every-30-minute Asia/Kuala_Lumpur triggers and credential-based HTTP authentication. Import and activate in the existing local n8n; leave other workflows unchanged. Record execution #1 success.
- [x] Add meaningful tests for sample updates/denominators, URL safety, formatting-only edits, first baseline/retry/reversion/failures, shelved targets, and explicit regeneration. 110 server/n8n tests and production build pass; live UI/SSE checks pass. Actual parser validated against 180 saved details and one public refetch.

Completed: see GamePlat/game/n8n/posting-watch/README.md and GamePlat/verification/market-posting-watch/runtime.json. Current target still needs its exact source URL; no source was guessed or silently attached. No market-wide collection schedule was added; file changes sync live, while customised posting checks run every 30 minutes. Temporary plaintext credential import file was removed and frontend bundle checked for configured backend secrets.

Initial audit: local n8n SQLite has four inactive workflows and no executions; 5678 not responding. Market/trends JSON do not exist. Current customised posting has no source URL; only analysed title/company/summary/requirements are saved. Previous collected artifacts are currently disconnected from game views.
