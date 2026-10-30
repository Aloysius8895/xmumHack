# Market history display repair

**Goal:** Make the saved monthly market statistics visible as a table and stop presenting aggregate-only months as missing career observations.

**Architecture:** Keep external historical series under `trends.historical`. Preserve career and skill periods and values exactly as provided by the sample or monthly workflow. Render a monthly source table before the existing historical charts, and explain the current career sample's coverage beside its heatmap.

**Tech stack:** Existing Node.js API, JavaScript renderers, three-language strings, Stylus, Node test runner, Vite.

**Constraints:** Use existing saved observations only. Preserve missing values as null, zero as zero, sources separately, and quarterly values as quarterly. Do not change unrelated in-progress work or the collection pipeline.

- [x] Update the historical response regression test to require unchanged career/skill periods and values; verify the old padding fails it.
- [x] Make `withHistoricalMarket` attach historical context without extending sample periods. Keep non-sample workflow behavior unchanged.
- [x] Add the monthly source table to `MarketHistory.js`, with source links, formatted values, explicit unavailable cells, and accessible table headings. Add three-language coverage text and responsive styles.
- [x] Add renderer tests covering source/month alignment, zero versus missing observations, and safe escaping.
- [x] Run historical, collected-market, renderer, and workflow integration tests and a production build. Verify real saved data and desktop/mobile browser rendering, including career filtering and the skills denominator.

The user requested the display repair; execution continues in this session. No new collection, estimated values, or changes to raw data are required.

## Verification

`node --test server/historical-market.test.mjs server/collected-market.test.mjs sources/Career/MarketHistory.test.mjs server/workflow-integrations.test.mjs`: 10 passed. Production build passed. Existing asset-resolution and bundle-size warnings remain.

The real response has seven external historical months, one career sample month, 13 careers, 462 ads, and 181 usable descriptions. Native Chrome verification at `http://localhost:5000/#skip` confirmed all nine saved monthly observations in the source table, explicit unavailable values, career search returning the data analyst with 30 ads, all 13 careers after clearing search, and the unchanged skills denominator. A 390-pixel responsive preview confirmed both source columns fit within the monthly table and the sample coverage notice and controls wrap correctly. The historical charts keep their existing internal horizontal scrolling.

Available coverage: DOSM April–June; Techmap April–September; current career sample October. No comparable April–September per-career monthly observations exist in the supplied data.
