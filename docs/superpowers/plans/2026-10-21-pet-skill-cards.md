# Pet Skill Cards Implementation Plan

**Goal:** Deliver the supplied skill-card layout and remove exams while deferring daily-report growth as confirmed.

**Architecture:** Add skill presentation metadata in the server catalog, expose saved affection per career and metadata through game.view(), and render accessible skill cards in CareerUI. Retire exam integrations across UI, API and AI generation. Keep legacy save fields readable.

**Tech Stack:** JavaScript modules, Stylus, Node test runner, Playwright, Vite.

- [x] Add complete localized skill details (icon group, reference demand, difficulty, description) for the 29 catalog skills.
- [x] Expose real career affinity and skill details; remove exam rules/functions/payloads. Derive roadmap stage completion/prerequisites from completed tasks, preserving old cleared stages.
- [x] Remove gym routes, client calls and question/grading generation; stop requesting challenges in roadmap schemas/prompts.
- [x] Replace career-list match presentation with real affection; create skill cards with icon/title/mastery, heat and difficulty rows, and description.
- [x] Remove menu/NPC/roadmap exam entries and ready markers; update three-language copy and documentation.
- [x] Verify catalog, saved affinity, disabled exam routes, roadmap compatibility and absence of new growth rewards using in-memory tests.
- [x] Build and inspect actual desktop/mobile skill cards with a mocked state response, preserving the real save. Update the existing menu verification for six entries.

Validation: 7 Node server tests passed; production build passed. Browser verification passed for 29 skill cards in Chinese, English and Malay at 1440x1000, 390x844 and 320x568; no horizontal overflow or page errors. Career affection uses saved data; removed menu, roadmap and NPC exam paths were verified. Phone panel layering was visually checked. Test API responses were intercepted to preserve the real player save. Screenshots: src/verification/pet-skills/.
