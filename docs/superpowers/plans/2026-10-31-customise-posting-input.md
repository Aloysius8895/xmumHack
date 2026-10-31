# Customise posting input adjustment

**Goal:** Collect the original posting URL in Careers Customise, keeping Roadmap for monitoring and learning.

**Architecture:** Reuse the existing `postingSourceUrl` draft and target submission API. Remove the duplicate Roadmap form and its UI action. Keep the existing monitor display, revision review, regeneration controls, schedule and backend behavior.

**Scope:** Preserve career score breakdown, SDG contributions and MyCOL timeline. Existing unrelated working changes must remain intact. A source URL remains optional for customisation with text or files.

## Implementation and verification

- [x] Confirm Careers Customise already collects and submits `postingSourceUrl`.
- [x] Remove Roadmap URL entry and hide monitoring when no source is registered.
- [x] Update existing UI regression coverage for status-only Roadmap and Careers input/submission (13 UI/server tests passed).
- [x] Run posting-watch UI/server tests and production build (passed; build reports asset-resolution, dependency eval and bundle-size warnings).
