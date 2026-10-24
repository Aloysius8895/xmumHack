# Posting skill languages implementation plan

**Goal:** Imported posting skills follow the existing Chinese, English, and Malay language selector in pet cards and other views using the skill catalog.

**Design:** Preserve stable skill IDs, source requirement text, and all player learning data. New posting analysis returns three translations within its existing AI request. Existing posting skills whose language slots contain copied source text receive one persisted translation repair when the player selects a language. Only saved skill names/descriptions go to that repair request. Incomplete or failed translation leaves originals available, saves the selected language, and shows a retry notice.

**Architecture:** `server/posting-skill-localization.js` owns the localized schema, legacy detection, and validated repair. `features.js` uses the configured AI provider for translation. `game.js` adopts the localized fields. `app.js` runs the repair in the existing save transaction for language selection. `CareerUI.js` continues using the common localized catalog.

**Tech stack:** Existing JavaScript server, AI structured output, Node test runner, Vite UI, and Playwright browser checks. No additional service or dependency.

- [x] Update new extraction and skill adoption to retain real zh/en/ms names and descriptions.
- [x] Repair older active/shelved posting skills once, validate complete results before applying them, and retain original data on failure.
- [x] Cover new extraction, existing-save repair, stable IDs/progress, caching, invalid translations, and unavailable translation with isolated tests.
- [x] Run game/server/career/n8n regression tests and production build (154 tests passed).
- [x] Repair the one existing live skill using the configured provider; verify unchanged target, profile, pet progress, and points.
- [x] Verify the real selector and localized names/descriptions with an isolated API fixture in zh/en/ms at 1440x1000, 390x844, and 320x568. All switches use saved translations, preserve proficiency, and render without card or panel overflow or page errors.

The browser check uses an isolated fixture so it does not change a player who is using the game during verification. Long status values now wrap within narrow skill cards.

Scope excludes translating source evidence quotes or rewriting stored hiring requirements. Technology/product names remain unchanged where appropriate.
