# Branch integration audit, 2026-10-25

Remote: `https://github.com/Aloysius8895/xmumHack.git`

All six remote branches were fetched and inspected before publishing the market dashboard work.

| Branch | Audited tip | Result |
| --- | --- | --- |
| main | `4813ea7` | Integrate five commits for RunPod support, rendering quality, configuration, and chatbot tests. |
| database-model | `32b2ecf` | Already an ancestor of main; starting point for local market work. |
| feature/career-platform | `7c2588c` | Already included in main. |
| feature/sdg-mapping | `46268ba` | Already included in main. |
| n8n-market-trends | `f582b55` | Already included in main. |
| Whatsapp---Replit-AI | `1c047f5` | Inspect nine branch-only commits; retain the `.deps/` chatbot ignore rule selectively. |

The WhatsApp branch's other changes synchronize older GamePlat/chatbot versions and switch the repository deployment entry point to the standalone Python bot. Main already contains the later application changes and the current game deployment entry point. Its root Python dependency files were added and then removed within that branch. The old `Lightnings.js` file was intentionally removed on main in `f8123a2`. Merging the entire branch would restore obsolete code or deployment settings, so those changes are not applied.

The FDE recent-postings detail card is removed from both market and career detail views. The FDE career, heatmap row, and NEW badge remain available.

Publication excludes local environment files, browser profiles, runtime databases, intermediate data runs, the standalone cloudflared executable, and unrelated untracked skill libraries.

Validation after merging main:

- Game/server, career UI logic, and n8n: 147 tests passed, including RunPod tests.
- Collection service: 47 tests passed.
- Chatbot: 109 tests passed using the repository `.venv` and a fresh temporary test directory.
- Data processing: eight unit tests and 22 offline integrity/replay checks passed.
- Desktop/mobile browser checks passed: no FDE detail card in either view, retained FDE career and NEW badge, refresh only in market overview, and no page errors. Refresh responses were intercepted; no test sample was published.
- Production Vite build passed. Existing asset-resolution, dependency eval, and bundle-size warnings remain.
- Staged project files contained no configured secret values or local environment/database/browser-profile paths.
