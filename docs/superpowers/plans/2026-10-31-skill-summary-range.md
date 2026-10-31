# Skill summary shared range

**Goal:** The skill page summary follows the Market overview range, like its existing skill list.

**Design:** Render rising and declining skills from the resolved skill rows already used by the list. Rank by the endpoint's month-over-month percentage-point change, show the selected range and comparison months, and exclude missing/flat changes. Do not present AI scenario values or cross-scenario learning recommendations as historical changes. Leave the scenario model unchanged.

**Implementation:** Add a small SkillTrendSummary renderer, pass it the existing filtered skill rows and selected dates from CareerUI, and add translations for Chinese, English and Malay. Keep the shared panel range across all tabs.

**Validation:** Execute the real market renderer across tab and date changes; verify summary order, displayed changes, zero/missing values and independence from forecast values. Run scenario-view regressions and the production build.
