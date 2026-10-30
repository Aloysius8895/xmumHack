# Project Technical Stack Implementation Plan

**Goal:** Remove Circuit and Whispers menu features and replace the last tab with CareerSphere's technical stack.

**Architecture:** Remove legacy page markup and initialization dependencies. Reuse the project introduction's full-width layout and i18n, retaining the `behindTheScene` key for its existing world interaction.

**Tech Stack:** Existing JavaScript modules, HTML, Stylus, Vite, Playwright.

## Steps

- [x] Delete the Circuit and Whispers navigation, preview and content blocks in `sources/index.html`. Replace the final page with project technology sections and concise open-source credits.
- [x] Extend `Menu.open()` project-text localization and full-width styling to the stack page; add `stack.*` translation strings.
- [x] Disconnect Whispers construction in `World.js` and Circuit registration in `Areas.js`; remove the Circuit map destination and rename the last area's visible interaction/map label.
- [x] Build, then exercise initialization, five-tab traversal, removed keys, T shortcut, the world interaction, all locales, desktop/mobile scrolling, page dismissal and screenshots. Review diff for unrelated changes.

## Constraints

Bot AI is Replit AI Integrations; game AI uses Anthropic SDK. Game storage is JSON, bot storage is SQLite. No claims that optional external integrations are currently live. Preserve team edits, original license/credit, saves and secrets. Do not push or merge.

## Validation result

Production build passed. Real-browser initialization confirmed exactly five tabs and no running Circuit or Whispers system; the T key no longer opens a page. The existing world portal opened the technical-stack tab and menu gamepad next cycling stayed within the five retained pages. Six desktop/mobile language checks passed (1440 x 1000 and 390 x 844; Chinese, English, Malay), including ten populated technology cards, no horizontal overflow, footer scrolling, repository URL, home/options round trips, close button and Escape. No browser page errors. Screenshots and results: `src/verification/project-technical-stack/`.
