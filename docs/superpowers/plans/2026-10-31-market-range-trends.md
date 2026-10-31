# Market range trends implementation plan

**Goal:** Make career rankings, sparklines, monthly changes and skill trends follow the selected heatmap date range, as approved in chat.

**Architecture:** Use the chosen months across market tabs. Resolve endpoint counts and previous-calendar-month comparisons from the same observed/archive/mock series; preserve source precedence and archive comparability rules. Keep the data collection timestamp separate from the displayed range.

**Tech stack:** JavaScript modules, node:test, Vite.

## Constraints

- Preserve existing workspace changes and authoritative observed values.
- Keep month-over-month change semantics; a single selected month may compare with the preceding calendar month.
- Missing or incomparable values show no percentage.

## Tasks

- [x] Add regression tests for historical endpoints, changed ranges, single months, missing values and skill series.
- [x] Update MarketSeries.js to use the selected endpoint and share skill-series resolution.
- [x] Update CareerUI.js so every tab uses the chosen range, including movers, and shows the selected dates and comparison month.
- [x] Run the market source tests and production build; review the diff for unrelated edits.

Validation: 22 targeted tests pass, including executing the actual panel renderer across tabs and date changes. Production build passes with existing asset-resolution and bundle-size warnings. Existing edits outside the market renderer are preserved.

Implementation proceeds inline using the user's approved behavior. No additional dependencies or commits are required.
