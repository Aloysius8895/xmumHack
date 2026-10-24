# KerjayaKu Project Layout Implementation Plan

**Goal:** Organise the actual repository using `docs`, `runpod`, `src`, `submission` and `tests`, with working startup commands and README links.

**Architecture:** Rename `GamePlat` to `src`, retain its cooperating game, data and collection modules, and place the existing chatbot, AWS backend and character source assets alongside them. Move automated suites to root `tests`; expose the existing RunPod provider and setup guide in `runpod`. Keep production assets, private configuration and sample archives intact.

**Tech Stack:** Node.js 24+, Vite, Python, pytest and the existing Node test runner.

## Constraints

- The user authorised actual directory reorganisation and README updates.
- Preserve credentials and runtime data; do not print or commit private values.
- Verify all filesystem move targets remain inside the workspace.
- Preserve immutable recruitment artifact bytes and manifests.
- Retain browser-only physics checks beside the Vite source, with their location documented.
- No external AI calls, live job sampling, deployment, Git commit or push is required.

## Tasks

- [x] Record the old/new file mapping and hashes for private configuration and recruitment artifacts.
- [x] Stop only this workspace's running Vite process before moving its working directory.
- [x] Move `GamePlat` to `src`, then move `aws`, `chatbot`, `character` and `scripts` into `src`.
- [x] Move the RunPod provider/guide to `runpod`, Node/Python suites to `tests`, and development guides to `docs/development`.
- [x] Rebase imports, file-relative fixtures and documentation links; update Replit, package scripts, pytest paths and the legacy export utility.
- [x] Add root npm entry points, an environment template, aggregated Python requirements and test instructions; rewrite the README tree and commands.
- [x] Run the moved Node/Python suites, production build, integrity checks and a local API smoke check. Fix only migration-related failures.
- [x] Restart the previously running development server from its new location and report the resulting layout.

## Verification

Root commands: `npm test`, `npm run test:python`, `npm run build` and `npm run dev`.
Check README relative links, all rebased JavaScript import targets, ignored private files and preserved data hashes. Python tests use a scratch pytest directory under ignored local data when the host's default temporary directory is unavailable.


## Result

- 3,571 previously tracked files have an existing destination; none became ignored.
- 229 Node tests and 157 Python tests passed after migration.
- Production build passed. The restarted development server serves the page and `/api/state` on port 5000; the state includes all 14 careers.
- 2,008 private configuration/runtime/data files retain their original hashes.
- Main documentation links and relative JavaScript imports resolve.
- With explicit user approval, the remaining idle legacy cmd terminal was closed. The empty `GamePlat/game` and `GamePlat` directories were removed; the root now uses the new categorised layout.
