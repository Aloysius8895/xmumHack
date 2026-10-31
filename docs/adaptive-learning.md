# Adaptive learning and weekly check-ins

The existing `POST /api/roadmap` → `noRegretSkeleton` → `skeletonStages` →
`features.generateRoadmap` → `game.buildRoadmap` pipeline remains the initial
planner. Later changes also call `generateRoadmap`, with an `adjustment` request;
they return a bounded patch of the existing roadmap instead of another roadmap.

## Prompt and evidence

Edit the shared server-side policy in `src/game/server/learning-rules.js`.
It is injected into both the No-Regret layout and ordinary roadmap prompts,
the adjustment prompt, AEI explanation, and formative checkpoint prompts.
Schemas remain beside their feature calls. This is prompt engineering, not
weight training. Provider credentials remain in the existing server AI adapter.
All three weekly prompts (progress, difficulties, and one understanding task)
are generated through that adapter, using DeepSeek when `AI_PROVIDER=deepseek`.
They use studied tasks and recent feedback; no-study check-ins generate only
scheduling/difficulty prompts and never assess understanding. Reopening the same
valid check-in reuses its questions rather than making another provider call.
The explicit refresh button sends `refresh: true` and the current `checkpointId`
to the same checkpoint endpoint. It requests a different question angle. Only a
successful refresh replaces the question and clears browser answer drafts; errors
retain them. Old question submissions and duplicate stale refresh requests are
rejected. Refreshing does not move the weekly due date or modify submitted reviews.

- Public scenarios are `moderate` (温和) and `extreme` (极端). Parameters remain
  k=0.6 and k=1.6 with the original three-year scenario horizon.
- A single AEI snapshot cannot establish development speed. The default is an
  explicitly conservative Moderate planning assumption. The model explains
  task-level evidence; it cannot silently claim it measured industry speed.
- The user's override persists separately from the independent analysis.
- The No-Regret learning skeleton defaults to AEI-only inputs: demand is excluded
  with a neutral factor, not reported as measured flat demand. Career/skill
  requirements remain inputs. Existing market panels and forecast scoring remain
  available separately. `modelAnalysis` labels the skeleton as a project skill
  priority computation, never as AI-trend evidence.
- Zero, missing and thin mappings are not safety guarantees. Notes and task
  coverage are visible in the evidence disclosure.
- Uniform study effort is assumed to be 10 hours/week. Suggested checkpoint
  spacing is 7 days, taking around 5–10 minutes. These are product settings,
  not empirically optimal schedules or user commitments.

## API and confirmation

| Route | Behavior |
| --- | --- |
| `POST /api/roadmap` | Initial roadmap; existing roadmap returns a pending adjustment preview |
| `POST /api/learning/analyze` | Model explanation of supplied AEI mappings |
| `POST /api/learning/scenario` | Save `mode: moderate`, `extreme`, or `null` for default; does not overwrite the roadmap |
| `POST /api/learning/checkpoint` | Create one question grounded in studied material, or a scheduling-only check-in when no study is recorded |
| `POST /api/learning/review` | Submit `checkpointId`, `progress`, `difficulty`, `answer`; stores formative feedback |
| `POST /api/learning/preview` | Generate a small adjustment using the selected mode and latest review |
| `POST /api/learning/apply` | Apply the matching `previewId` after explicit confirmation |
| `POST /api/learning/discard` | Discard pending changes, keeping the formal roadmap |
| `POST /api/roadmap/branch` | Existing branch API now creates a confirmation preview |

The game state exposes `learning` with localized analysis, suggested due time,
question, feedback and pending diff. The private evaluation rubric and raw
checkpoint answers are not included in browser state. No automated external
messages or paid background calls are scheduled; due check-ins appear in the UI.

Review outcomes are `ready`, `needs_practice` or `insufficient_evidence`.
Self-reported hours alone do not establish mastery. A missing answer remains
insufficient evidence. Mock mode intentionally does not certify understanding.

Patches can revise only unstarted tasks on the selected path, or add a task
for a skill already covered by an existing eligible stage. They cannot delete
tasks, rewrite stage/branch definitions or change prerequisites. The chosen
branch can change only at confirmation. Completed and
in-progress tasks retain IDs and progress. Applying a draft never awards points
or changes mastery, pets or target career. Old roadmap snapshots are retained
in bounded internal history.

Confirmation is rejected if the target, profile, roadmap progress, selected mode
or relevant AEI evidence changed after the preview. Checkpoint submissions are
also rejected after their source roadmap changes. Changing a preference alone
does not move the formal branch.

## Compatibility and verification

Save version 7 migrates `fast` to `extreme` in scenario preferences, active and
shelved roadmap branches, `forecastBasis` maps, and stage gain maps. Legacy
`fast` scenario/branch requests remain accepted at API boundaries. There are
only two enumerable presets; no duplicate Fast preset is introduced.

Use `npm test` for regression suites and `npm run build` for the Vite build.
Adaptive tests use temporary saves and synthetic/mock providers; they do not
send real credentials or request paid inference. Browser graphics still need
verification in a supported hardware-accelerated browser (see workspace memory).

## Known follow-up work

This branch contains the working initial adaptive-learning flow, with these
remaining limitations identified during the integration audit:

- Speed classification remains insufficient evidence with a conservative Moderate
  default. Comparable AEI periods and explicit trend criteria are not implemented.
- Checkpoint task selection prefers the first in-progress task, then the first
  completed task, rather than prioritizing the latest week's learning records.
- Additions cannot extend a completed stage. A separate reinforcement mechanism
  is needed when a completed roadmap reveals gaps in understanding.
- Custom-posting initial layout uses posting requirements, but the shared AEI
  evidence and modelAnalysis context still uses the generic career requirements.
- The pre-existing posting-refresh route still rebuilds the roadmap instead of
  merging a preview that preserves task progress. It needs the same safeguards
  as ordinary adaptive updates.
- Weekly due status is displayed in the roadmap panel; external reminders and a
  complete live-provider/gameplay end-to-end acceptance run are not implemented.
