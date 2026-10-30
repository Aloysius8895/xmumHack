# FDE demand, emerging careers and trend filters

**Goal:** Add FDE as a selectable emerging career with recently collected Malaysia postings; make rising/falling filters agree with the displayed heatmap; expose and reduce concrete sampling biases without claiming population inference.

**Design:** Add FDE to the extra career catalog, reusing existing skills, pet species and mentor replacement. Carry an `emerging` flag into career cards, detail pages and heatmap/ranking names, and render a compact red NEW badge. Collect bounded, recent FDE searches across Malaysia and selected local strata; preserve raw responses, actual dates, unknowns and title-based classification. Keep Singapore-only and closed postings out of active Malaysia demand counts. Refresh the existing processed sample through its manifest verification path.

For trend controls, resolve displayed career values through one pure helper using observed data first and the already authorized preview backfill second. Compute the latest comparison and rising/falling counts from the same displayed values. Preserve provenance internally and keep skill calculations on real usable descriptions.

For bias, distinguish a ranked keyword quota sample from a probability sample. Add coverage diagnostics for platforms, regions, employer concentration, classification and description availability; identify page caps and unknown inclusion probabilities. Extend collection arguments with career, location, date-window and chronological-sort controls. Do not invent sampling weights or national totals without aligned population margins.

- [x] Add FDE catalog, metadata, aliases and classification tests; extend collection controls and collect recent Malaysia postings.
- [x] Implement consistent displayed series and regression tests for rising/falling, zero denominators, missing months and raw-data immutability.
- [x] Add sampling diagnostics and a concise expandable UI with measured coverage and practical next steps.
- [x] Reprocess verified data, export FDE source evidence and audit coverage; add NEW labels in all three languages.
- [x] Run targeted data/server/renderer checks, production build and desktop/mobile browser QA, including FDE career selection and nonempty trend filters.

## Historical scope added by user

The user explicitly requested April–September FDE retrieval. Scanned 314 pinned OpenJobData active/closed archive shards and corrected timestamp schema handling; all shards completed without remaining failures. Recovered four dated Malaysia FDE advertisements: July 1, August 2, September 1. April–June have no verified recovered records and retain user-authorized mock fallback, without visible Mock labels. The original URLs, publication dates, archive paths, revision and checksums are stored separately. Real recovered history overrides generated history. Recovered archive counts and a targeted current sample have different coverage, so FDE is excluded from measured monthly growth comparisons.

## Results and verification

The recent FDE collector completed 20 searches across Malaysia, Kuala Lumpur, Selangor, Penang and Johor, using chronological order and a 30-day posting window. It found 105 unique source records and retrieved 70 usable details under its explicit detail cap. Classification accepted six FDE postings from five employers. The combined processed sample now has 564 ads, 251 usable descriptions and 1,160 skill links, with 14 career categories.

43 targeted Node tests passed, including FDE selection/mentor replacement, catalog linkage, authored SDG explanations, source-history precedence, sampling diagnostics, consistent filters, and zero/missing values. Eight Python collection/processing tests and all 22 real-data offline checks passed. The production build passed with existing asset and bundle warnings. Browser QA verified 14 careers, seven rising and three falling, NEW badges on the FDE row/card/detail, six recent source links, three recovered historical month cells, sampling diagnostics, unchanged observation arrays and skill denominator, date rollover, mobile scrolling and no JavaScript errors.

Reports and source evidence: `src/data/derived/fde-demand/`; raw current collection: `src/data/raw/linkedin-20261024T103111Z/`; verified historical observations: `src/data/historical/fde_2026/`; screenshots: `src/verification/historical-market-ui/`.
