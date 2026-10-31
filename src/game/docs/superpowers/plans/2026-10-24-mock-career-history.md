# Career history preview backfill

**Goal:** Fill April–September heatmap gaps with distinct mock career trajectories while retaining October's collected observations.

The user explicitly accepted estimates, then requested mock data to preview trend changes and instructed that the interface should not display a Mock demo label. These requests on October 24, 2026 supersede the earlier real-data-only preference for the heatmap. Real observations and source datasets remain unchanged.

**Model:** For each career, select its latest observed count as the anchor. Authored growth profiles provide rising, stable and falling careers, with a small deterministic sinusoidal fluctuation keyed to career ID and absolute calendar month. This produces consistent values across refreshes and date ranges. Preserve every observed value, including zero; fill only missing periods at or before the latest observation. A career with no observations gets a deterministic baseline. These are mock values, not measured recruitment statistics.

**Architecture:** A pure renderer helper derives preview cells without changing API career/skill arrays. Cells display ordinary numbers, matching the user's preference; internal cell metadata and JSON/CSV exports retain `mock:true` provenance. Current values, ranking, skills, denominators and growth calculations retain observed inputs. Later months remain unavailable for stale samples. Export 78 mock history cells and 13 observed current cells separately from raw and verified data.

- [x] Add model regressions for distinct rising/falling profiles, observed zero preservation, future months, missing-career fallback, stable range selection and input immutability.
- [x] Implement the pure preview helper and ordinary heatmap rendering, with no visible Mock label, in all three languages.
- [x] Export the preview with provenance and record the user-authorized scope and source checks.
- [x] Run targeted regressions and production build; visually verify all 78 history cells, October alignment, November rollover, filters, mobile rendering and unchanged skills.

## Verification

19 Node regressions passed; production build passed with existing asset-resolution, eval and bundle-size warnings. Browser QA verified 78 internally marked Mock history cells, 13 observed October cells, no visible Mock/approximation labels, rising AI and falling Chef profiles, stable range changes and search, unchanged raw API arrays and the 181-description skill denominator, no invented real movers, correct November rollover, mobile horizontal scrolling, and no JavaScript errors. Screenshots/results are in `docs/verification/historical-market-ui/`.

`node src/data/scripts/export-history-preview.mjs` exports 91 rows to `src/data/derived/history-preview/career_history_preview.json` and `.csv`. Each exported row retains its Mock/observed provenance. Examples from April through October: AI 13,16,17,19,24,29,31; Chef 73,63,57,57,55,47,43; Data Analyst 20,20,23,26,26,26,30. These preview trajectories are authored, not measured changes in the Malaysian job market.

## Source checks

- Techmap's public Malaysia statistics provide April–September monthly totals, already verified and saved locally.
- LinkFetch's free 1,000-row sample contains 10 Malaysia records, all first seen in August; none match the project's career classes. Full history is separately offered by the vendor.
- `ryang2/linkedin-job-scrape` April 7 file contains 247 rows from the Seattle area and no Malaysia rows.
- OpenJobData includes public closed-job archives starting May 26 and active jobs first observed since May 24; this does not establish April coverage for the project's 13 careers. A Malaysia query against active shard 0 returned 72 records, with observed months May, June, August, September and October.
- No paid data was purchased. No true historical occupation values were inferred from aggregate totals.
