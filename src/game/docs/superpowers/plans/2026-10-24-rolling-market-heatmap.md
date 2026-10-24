# Rolling market heatmap implementation plan

**Goal:** Show the current Malaysia calendar month and the preceding six months in the career heatmap, then show historical advertisement totals below it.

**Design:** Keep API observations unchanged. Generate calendar columns in the frontend and look up each career value by its original period; unavailable observations remain null and zero remains zero. Default to April–October in October 2026 and May–November in November, even if collection still ends in October. Preserve ranking, skills, sample denominators, search, and source separation. Explain that the verified DOSM release covers April–June and that unverified months remain unavailable.

**Tech stack:** Existing JavaScript, Stylus, Node test runner, Vite, and Playwright.

The user explicitly requested these display changes; implementation and verification continue in this session.

- [x] Add a pure calendar-month helper using Asia/Kuala_Lumpur; test October, November with stale observations, year rollover, and the Malaysia month boundary.
- [x] Use the calendar columns for heatmap cells and range labels without extending backend arrays. Move the history card below the heatmap and update coverage and DOSM text in Chinese, English, and Malay.
- [x] Make heatmap career names remain visible during mobile horizontal scrolling and provide an unavailable-data tooltip.
- [x] Run targeted regressions and the production build. Verify actual local data, ordering, filters, mobile layout, and November rollover in the browser.

## Verification

The 15 targeted Node tests passed, including the Malaysia calendar boundary, year rollover, DOSM coverage text, unchanged API arrays, and existing sample/workflow regressions. The production build passed with the existing asset-resolution, eval, and bundle-size warnings.

`python src/tools/verify_historical_market.py` passed against the real local API: 13 careers, 78 unavailable historical cells, correct October values, unchanged 181-description skill denominator, heatmap before the history card, working range/search controls, and no page errors. A simulated November calendar kept the original October sample in October and showed May–November with November unavailable. The 390-pixel mobile view scrolls within the table while keeping career names visible, without page overflow. A browser-only fixture confirmed that observed zero remains zero and missing periods remain unavailable. Screenshots and results are in `src/verification/historical-market-ui/`.

DOSM's official 2026 release calendar was checked: the Q3 2026 Job Market Insights release is scheduled for November 17, 2026. No July–October values were fabricated or substituted from another source.
