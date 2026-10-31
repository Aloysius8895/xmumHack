# KerjayaKu PDF consistency review

Reviewed: 1 November 2026 (Asia/Kuala_Lumpur).

Source PDF: `C:/Users/User/Downloads/KerjayaKu.pdf`, 17 pages. Page references below are physical PDF pages, not the inconsistent printed slide numbers.

Scope: compare the document with the current local source, generated datasets, committed workflow definitions and selected non-secret provider settings. This is not confirmation of the live Replit deployment, running n8n schedules, database contents, paid subscriptions, user-study results or legal compliance. The original PDF and project implementation were not edited.

## Overall conclusion

The core product description matches: playable career exploration, editable skill profiles, explainable deterministic matching, scenario-based planning, learning resources, Telegram reports, multilingual UI and SDG target associations. The deck needs technical and numerical updates before being presented as an accurate description of the current build.

## Required corrections

| PDF page | Finding | Current project evidence | Suggested correction |
| --- | --- | --- | --- |
| 9, 13 | Score uses 60% skill fit + 40% career outlook. | `src/game/server/scenarios.js` exports `WEIGHTS = {fit: 0.5, outlook: 0.5}` and uses those weights in `forecastCareer`. | Use **50% skill fit + 50% career outlook**. Regenerate the displayed role scores, ordering and improvement gains from the same documented synthetic profile. Do not only change the coefficients on the slide. Holding the displayed 57% fit and 47% outlook fixed gives 52, not 53. |
| 5, 7, 9, 12 | Multiple slides use Fast; page 13 uses Extreme. | Current public presets are Moderate and Extreme. `fast` is only a compatibility alias. | Use **Moderate / Extreme** throughout. Current presets are k=0.6 and k=3, both over three years, with tau=5. |
| 7 | A historical career heatmap is presented under a production-evidence pipeline without identifying simulated historical cells. | `src/game/sources/Career/MockMarketHistory.js` fills missing historical career cells for preview; `src/data/historical/2026-04_onwards/README.md` documents this and excludes these frontend career-history cells from ranking. | Caption the screenshot **Historical demand preview; missing historical cells may be simulated. Collected observations and simulated cells are distinguished internally.** Do not imply that every month shown is observed recruitment evidence or a ranking input. Prefer a current screenshot. |
| 13 | “42 skills mapped” is stale. | `data/ai-exposure/exposure.json` currently has 38 derived observed-data skill rows; `data/mock/ai-exposure.json` supplies 29 imputed rows, covering 67 catalog skills in total. The six recently supplemented skill sets contain 18 synthetic task examples stored separately in `mockTasks`. | **67 catalog skills: 38 with approved AEI-derived values and 29 with labelled imputed values. Synthetic task examples are demonstration data.** Keep observed mapping counts separate from examples. |
| 13 | “Human Review” is stronger than the available review provenance establishes. | Current mapping notes and `src/data/config/wef-mapping.json` record AI review. This audit did not find evidence establishing that every displayed mapping received human sign-off. | Use **Reviewed project mappings (AI-assisted; human sign-off where documented)**, or provide a genuine human review record before keeping the unqualified label. |
| 13, 15, 17 | Hosting and persistence claims mix Node/Vercel, Replit and PostgreSQL as if they were one verified deployment. | Root `.replit` config deploys a Node server through Replit Cloud Run. `src/game/server/persistence.js` supports configured AWS, PostgreSQL and local JSON fallbacks. Local configuration inspected here does not establish an active PostgreSQL deployment. | **Node.js API on Replit; PostgreSQL when configured, with local JSON/SQLite development storage.** If Vercel is genuinely used in production, show its actual deployed role separately. |
| 13, 15 | Page 13 calls the bot DeepSeek Flash, while page 15 calls it Claude Haiku via Replit AI. | Both `src/game/.env` and `src/chatbot/.env` currently select `AI_PROVIDER=deepseek`, `DEEPSEEK_MODEL=deepseek-flash`. The bot supports other providers but that does not mean they are selected. | **DeepSeek Flash for the game and Telegram companion; alternative providers are configurable.** Local settings do not prove remote deployment settings. |
| 13, 15, 17 | Weekly and daily collection statements conflict; the appendix describes a 10-second/75-check n8n polling loop not represented in the current checked-in workflows. | The public-market workflow runs daily 08:00 MYT and calls `/api/integrations/market/collect` directly. The legacy JSearch market-trends workflow is weekly Monday 08:00. Posting-watch is separately weekly Monday 08:00. The checked-in workflows are exported inactive templates. | Distinguish **daily market collection**, **weekly saved-posting checks**, and the **optional legacy weekly JSearch workflow**. Document the workflow actually activated remotely. Remove the 75-check loop unless it exists in the deployed workflow and can be demonstrated. |
| 14, 15 | “67 of 67 starting resources” no longer equals the implementation. | The 67 catalog skill records currently contain 62 starting URLs and 5 AI study prompts; the complete list has 132 URL entries / 131 unique URLs. Link availability is not proof that every third-party course is free. | **67 skill starting points: 62 learning links and 5 AI study prompts.** Verify third-party access separately before claiming every learning resource is free. |
| 10 | Five stages and 203 hours are presented prominently without clearly distinguishing this particular sample from generated plans in general. “Stages unlock in order” also omits early-start support. | Plans vary by profile, posting and scenario. The game supports up to six stages on a walked path and allows a user-confirmed early start of locked stages. | **Example roadmap: 5 stages, 203 estimated study hours. Recommended prerequisite order; learners may explicitly start a later stage early.** The displayed hours sum correctly to 203. |
| 15 | The DeepSeek $0.14/$0.28 input/output rate is stale. | Official pricing checked on 1 Nov 2026 lists `deepseek-flash` as V4.1-Flash-1017. Uncached input is $0.15 off-peak / $0.30 peak per million tokens; output is $0.60 / $1.20. Cached input has different rates. | For the deck's assumed 80k uncached input + 25k output tokens, quote approximately **US$0.027–0.054 per active user/month**, before other usage and infrastructure. Recompute the total cost and “under RM1 even at 5x” claim; describe it as a budget estimate, not measured spend. |

## Content that broadly matches

- Pages 1–6: target audience, playable career companion, editable levels 0–3 and evidence next to extracted skills are consistent with the product. Profile extraction primarily feeds matching with skills/levels; do not imply that personality, interests or experience are all separate numerical scoring inputs.
- Page 9: the role scores are calculated by deterministic application rules rather than written directly by the LLM. Values are scenario estimates, not job predictions.
- Page 11: career/skill links to specific SDG targets exist. Displayed preparation progress is a product measure; it is not a measured change in UN national indicators.
- Pages 12–13: two three-year AI scenarios and AI structured outputs are implemented. Three.js/WebGPU, Rapier, Vite, Node.js and FastAPI are present.
- Page 15: a 30-minute Refresh cooldown and a 30-day market window are implemented. Failed collection preserves the prior valid published data.
- Page 15: “440+ automated tests” is plausible as a test-inventory statement: the current repository has 465 top-level JavaScript test definitions across 83 test files. This review did not run the whole suite, so it does not certify that all currently pass.
- Page 14: the 10-student pilot and time-to-plan reduction are clearly labelled as targets/team estimates, not measured results. Keep those qualifications.
- Page 2: Hays' own 7 March 2025 release supports the historical 56% AI use and 26% training figures. Label them explicitly as **2025 survey figures**, not current adoption measurements.

## Claims that need evidence beyond this repository

- Active production PostgreSQL storage and n8n schedules: inspect the deployed environment. Checked-in workflow files do not prove activation.
- A fixed US$20 Replit plan cost covering all hosting, database, collection and bot usage: verify the actual plan, billing period, credits and usage. The public pricing page alone did not expose enough plan detail to confirm the deck's figure in this audit.
- JSearch free-tier capacity: show the subscribed allowance and collection request budget.
- “Aligned with Malaysia's PDPA”: source code alone cannot establish legal compliance. Describe implemented privacy controls and planned review instead of presenting unverified compliance as a completed result.
- HRD Corp-claimable courses, career-centre partnerships and pilot outcomes: these are future plans unless supported by external records.

## Missing current features worth mentioning

- Careers Customise accepts a specific company's posting and original source URL.
- Selecting Moderate/Extreme now directly generates or adapts the roadmap, preserving existing task progress, points and logs.
- Learning reports show saved task progression and points. The current report-validation flow asks two questions before applying matched-task progress.
- Weekly formative check-ins can propose bounded changes to unstarted tasks.
- Saved posting monitoring preserves the current roadmap and alerts on content revisions.
- The evidence stack also contains JobStreet 2024–2025 comparisons, WEF directional mappings and DOSM weighting. The architecture should distinguish these inputs and explicitly identify imputed/mock data.

## Visual/content completeness issues

- **Page 8 is blank** apart from the background/footer in the supplied PDF. If it was intended for an embedded video or live-demo object, the PDF does not include that content.
- Page 11's SDG 4.4 text ends at “Relevant technical skills for”; complete the sentence.
- Page 15 has visibly crowded/overlapping card subtitles and body text.
- Printed slide numbers do not match physical page order; use one consistent numbering scheme.

## Suggested replacement architecture paragraph

> KerjayaKu combines a Three.js/WebGPU frontend, a Node.js game API and a FastAPI Telegram companion. DeepSeek Flash supports skill extraction and multilingual roadmap generation, while deterministic application rules compute career scores using 50% skill fit and 50% career outlook. The 67-skill catalog combines 38 approved AEI-derived skill values with 29 explicitly imputed values. Storage supports PostgreSQL when configured and local JSON/SQLite for development. Scheduled market collection, saved-posting monitoring and manual Refresh are separate workflows; simulated historical previews are not presented as observed recruitment measurements.

## External checks

- DeepSeek official models/pricing, checked 1 November 2026: https://api-docs.deepseek.com/quick_start/pricing/
- Hays original 2025 survey figures: https://www.hays.com.my/press-release/content/future-of-work-malaysia-technology-ai-impact
- Replit pricing landing page, plan/usage costs not established: https://replit.com/pricing

No live deployment changes, source-code edits or edits to the original PDF were made as part of this review.
