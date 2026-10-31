# Restore weekly posting tracking in Roadmap

**Goal:** Restore a visible posting-link input in Roadmap and verify the existing n8n content-change workflow on a weekly schedule.

**Approved scope:** The user requested direct execution without questions. Support the current career target in either general or customise mode; keep existing roadmap, skills and learning progress when registering or checking a source. Restrict sources to the existing supported LinkedIn/Indeed posting URLs. Detect substantive job-content changes without treating fetch failures as changes. Regeneration remains explicit.

**Architecture:** Reuse the existing monitor, hash comparison and authenticated integration endpoint. Expose the form for any selected target and allow changing the tracked link. Use the first successful fetch as baseline, compare subsequent snapshots to it, and display pending-baseline/unchanged/changed/failure states. Preserve the baseline when the same canonical URL is re-saved. Only an explicit accepted revision changes a general goal into a posting-specific goal. Change the generated n8n schedule to Monday 08:00 Asia/Kuala_Lumpur and update the installed workflow if a usable local instance is available.

**Tech stack:** Existing JavaScript UI/API, node:test, generated n8n JSON, local n8n CLI/API.

## Work

- [x] Test and restore the Roadmap form for both target modes, including already generated roadmaps.
- [x] Enable source registration/checks for general targets without resetting their roadmap; test canonical re-save and replacement behavior.
- [x] Set the n8n cron to `0 8 * * 1`, synchronize generated JSON and current setup instructions.
- [x] Inspect local runtime state; update only the posting-watch workflow, retaining its credentials. Verify configuration and execution without sending external messages.
- [x] Run posting-watch/UI/workflow regression tests and the production build. Record any runtime limitation accurately.

## Results

43 targeted tests pass; production build passes with existing asset and bundle-size warnings. Headless rendering verified the actual tracking form at 1200px and 390px without horizontal overflow. The installed workflow retains its ID and credential references, points to the running game API on port 5000, and is published with the weekly cron. The local n8n service was started and its authenticated webhook completed successfully. Runtime evidence is in `docs/verification/market-posting-watch/weekly-restoration.json`.

No posting URLs are currently registered in the live save, so the real execution checked zero targets; content-change behavior was verified with isolated fixtures. Both local services must stay running for scheduled checks. No startup task or external notifications were added.
