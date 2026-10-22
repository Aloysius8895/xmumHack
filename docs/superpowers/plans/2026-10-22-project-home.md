# Project Home Implementation Plan

**Goal:** Replace the vehicle/author homepage with the CareerSphere project description by Chill chill.

**Architecture:** Reuse the existing menu and i18n system. Update home text on opening and toggle a scoped menu class for a full-width home layout while other tabs retain their previews.

**Tech Stack:** JavaScript, HTML, Stylus, Vite, Playwright.

## Steps

- [x] Replace home image and personal biography in `sources/index.html` with a focusable project heading, team byline, three descriptive paragraphs and a short journey.
- [x] Add `home.*` translations in `sources/Career/i18n.js` and refresh those elements from `Menu.open()` using `t()` and `SOCIAL_TEAM_NAME`.
- [x] Add scoped `.is-project-home` layout rules in `sources/style/menu.styl`: no preview column on home, full-width readable text, mobile scrolling, retained other-tab layouts.
- [x] Build and verify home content, absent vehicle, three languages, other-tab round trip, desktop/mobile sizing and close/Escape behavior. Inspect screenshots.

## Constraints

Use only established project features, preserve unrelated work and source credits, do not expose secrets, and do not push or merge branches.

## Validation result

Production build passed. Six real-browser checks passed across desktop (1440 x 1000), mobile (390 x 844), and Chinese, English and Malay. The home has no vehicle image and displays the CareerSphere description and Chill chill byline. Each check switched to Options and back, verified the preview column returns only for other tabs, reached the final paragraph without horizontal overflow, and dismissed with the close button or Escape. No page errors. Also fixed the existing menu stacking order so the career HUD cannot obstruct the menu close button. Screenshots and results: `GamePlat/verification/project-home/`.
