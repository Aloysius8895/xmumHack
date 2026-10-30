# Sampling controls and JSearch activation

**Goal:** Remove the implementation-status block and its user-facing wording; enlarge sampling explanations; place one opt-in Refresh button at the upper right of Sample coverage and bias; activate JSearch with the server-side RAPIDAPI_KEY while retaining the user's three-platform restriction.

**Design:** Use an accessible disclosure button and independent Refresh button in a flex header. Body text is 16px, header 17px, with wrapping on mobile. Preserve expansion and refresh progress across state updates. Remove the unused status renderer and translations. Keep collection internals private.

For JSearch, resolve RAPIDAPI_KEY from the existing game environment on the server. Verify one bounded API request before changing the active data profile. An API transport may retain only records with a verified LinkedIn/Indeed/Ricebowl source link; other returned records are discarded. Shared API requests must not be repeated per platform, and failed API calls must not clear the last good sample.

- [x] Update sampling layout, typography and removal of the status block.
- [x] Check credentials without exposing them; make one provider request and record the actual result.
- [x] Activate the verified provider path with source filtering and regression checks.
- [x] Verify desktop/mobile layout, opt-in refresh behavior and production build; leave the user's Vite service running.

**Results:** Removed the unused status component and all of its translations. Coverage body text is 16px, header 17px, with an independent upper-right Refresh button and preserved disclosure state. JSearch returned HTTP 200 for one real request (10 results, one link within the allowed platforms). The service is running with JSearch enabled and configured. LinkedIn/Indeed views share API results within each run; records without allowed job links or explicit MY country are excluded. All 47 service tests, desktop/mobile refresh QA and production build passed. No full collection was triggered automatically, and the existing 476-record snapshot remains available until the user opts in.
