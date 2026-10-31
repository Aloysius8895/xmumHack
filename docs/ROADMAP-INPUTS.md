# Roadmap inputs

This document describes what the server computes for the roadmap AI and how to use it. Everything here is computed in
code from data files. No language model makes these judgements, and no result is hard-coded. Mock data fills some
gaps; every result that rests on mock data says so (see [Mock data](#mock-data)).

Entry point: `roadmapInputs(save)` in [src/game/server/roadmap-inputs.js](../src/game/server/roadmap-inputs.js). It
returns the data fields of the roadmap prompt's input:

```js
{
  targetCareerId,            // save.target.careerId, or null
  aeiEvidence,               // aeiEvidence(id, { career }) for the career as targeted
  trendClassificationRules,  // { zh, en, ms }: when the pace of AI can be classified
  scenario,                  // scenarioState(save)
  userScenarioOverride,      // 'moderate' | 'extreme' | null
  modelAnalysis: { skillPriority }   // skillPriority(save, { career })
}
```

The roadmap prompt adds the profile, the current roadmap, the learning logs and the review itself.

"The career as targeted" is `game.targetedCareer(save, career)`. When the player customises the target with a
company's job posting, the posting's skill requirements replace the career's default skills. The skeleton, the gaps
and the evidence all use it.

`roadmapCareer(save)` in `game.js` is the career the roadmap prepares for. It is the career as targeted, plus the
reviewed prerequisites of its skills (`withPrerequisites`). For example, a posting that asks for ML frameworks also
brings in Python. An added skill's reason says so, and the skeleton lists it under `added`. Pet affinity and progress
still use `targetedCareer`.

## Scenarios

There are two scenarios: `moderate` and `extreme`. The old name `fast` is still accepted in requests and old saves,
and it is converted to `extreme`.

| Request | Effect |
|---|---|
| `POST /api/scenario { preset: 'moderate' \| 'extreme' }` | The player chooses a scenario (`userOverride`). |
| `POST /api/scenario { preset: null }` | Clears the choice, so the recommended scenario is used again. |
| `POST /api/roadmap/branch { branch }` | Chooses the roadmap branch to follow. |

### `scenarioState(save)` in `scenarios.js`

| Field | Meaning |
|---|---|
| `trendClassification` | `moderate`, `extreme` or `insufficient_evidence`, for the target career |
| `recommendedScenario` | The scenario the evidence supports. It is `moderate` when the evidence is insufficient. |
| `userOverride` | The player's choice, or `null` |
| `effectiveScenario` | `userOverride ?? recommendedScenario` |
| `selectionSource` | `user_override` or `model_default` |
| `reason`, `limitations` | `{ zh, en, ms }` text |
| `change`, `values` | How the automation share changed between the two periods |
| `comparability` | Notes on how comparable the two periods are |
| `mock` | Whether any period is mock data |

A choice by the player never changes the recommendation.

### How the recommendation is made

Source: [data/ai-exposure/periods.json](../data/ai-exposure/periods.json), built by `build_aei_periods.py`, with
[source-periods.json](../data/ai-exposure/source-periods.json).

1. For each of the career's mapped tasks, take the automation share of the five collaboration patterns:
   `(directive + feedback loop) / (all five patterns)`.
2. Do this for two real AEI releases:
   - `release_2025_03_27`: the 11 days after Claude 3.7 Sonnet launched;
   - `release_2025_09_15`: 4 to 11 August 2025.
3. Compare the two periods. A rise of **5 percentage points or more is `extreme`**; anything less is `moderate`. The
   team set this criterion before computing.
4. A career with fewer than 3 tasks present in both releases is `insufficient_evidence`.

Results:

| Career | Change | Classification |
|---|---|---|
| `data-analyst` | +22.2 points | `extreme` |
| `data-scientist` | +27.5 points | `extreme` |
| `backend-developer` | +6.0 points | `extreme` |
| `ui-ux-designer` | −16.8 points | `moderate` |
| `ml-engineer`, `product-manager`, `quantity-surveyor` | mapping not approved | `insufficient_evidence` |
| `chef` | too few tasks | `insufficient_evidence` |

The task mapping was reviewed by AI (ChatGPT, 2026-10-31), not by a person. In
[skill_task_map.json](../data/ai-exposure/skill_task_map.json), `reviewed: true` means "reviewed by AI". The reasons
for each decision are in [review_decisions.json](../data/ai-exposure/review_decisions.json).

Caveat: Anthropic analysed the two releases with different models (Claude 3.7 Sonnet, then Sonnet 4). The
`comparability` field states this.

## `aeiEvidence(careerId, { career })` in `aei-evidence.js`

The output has five parts:

- **`source`**: the dataset name, URL, licence, `downloadedAt` and method. `releases[]` lists each release's files,
  metric, definition, `observationPeriod` and `published` date. The observation period is never the download date.
- **`career`**: `observedExposure`, the number of tasks, `tasksWithoutPenetration` and the O*NET codes.
- **`skills[]`**: per skill, `status`, `automation`, `augmentation`, the O*NET `tasks`, `mappedTaskCount`, `reviewed`,
  `note` and `quality`.
- **`thresholds`**: `{ fewTasks: 3 }`.
- **`limits`**: `{ zh, en, ms }` text on what the data does not show.

### Skill status

| Status | `evidenceId` | Meaning |
|---|---|---|
| `observed` | `aei:skill:<id>` | Reviewed AEI values with their tasks |
| `imputed` | `aei:mock:skill:<id>` | Mock data: the mean of the reviewed skills of the careers needing the skill. `quality.imputed` is `true`. |
| `unknown` | `aei:skill:<id>` | No value at all. Never read it as low risk. |

### Quality flags

| Flag | Meaning |
|---|---|
| `quality.fewTasks` | The value rests on fewer than 3 O*NET tasks (a team assumption), so lower the certainty. |
| `quality.unreviewed` | No person has reviewed the mapping. |
| `quality.noData` | There is no observed value. |

## `skillPriority(save, { career })` in `no-regret.js`

This is the No-Regret skeleton of the target career, computed from AI exposure and hiring demand. That is the default,
`demand: 'momentum'`. Pass `{ demand: 'neutral' }` to get the AI-exposure-only reading for comparison.

| Field | Meaning |
|---|---|
| `core` | Gap skills that rank high under both scenarios. Learn these first. |
| `branches.moderate`, `branches.extreme` | The other gap skills, ordered for each scenario |
| `identical` | `true` when both branches have the same order. In that case there is no fork. |
| `later` | Skills declining under both scenarios. Learn these last. |
| `foundations` | Declining skills that stay out of `later` because a skill still to learn requires them |
| `promoted` | Skills moved into the core because a core skill requires them |
| `approach.moderate`, `approach.extreme` | How to learn each skill under each scenario (see below) |
| `gains`, `values`, `reasons` | Score gain, future value and `{ zh, en, ms }` text per skill |
| `evidenceRefs` | The `aei:skill:` and `aei:mock:skill:` IDs used |
| `assumptions` | Demand handling, the scenario parameters, the learning approach parameters, and `mock: { demand, exposure }` |
| `purpose` | A learning priority computed by the project's model |

**This is not evidence of how fast AI develops.** Only `scenario` carries that judgement.

### Ordering

Every list is ordered so that each skill comes after the skills it requires. The requirements come from the reviewed
entries of [skill-prerequisites.json](../src/data/config/skill-prerequisites.json). A requirement of a core skill
joins the core.

### How to learn: `learningApproach(skillId, scenario)`

Each skill's learning time is split across five activities: `foundation`, `independent_practice`,
`ai_collaboration`, `verification` and `transfer`. The split depends on the skill's automation `a`, its augmentation
`u`, and the scenario's adoption `D`:

- `ai_collaboration` grows with `u·D`.
- `verification` grows with `a·D`.
- `foundation` and `independent_practice` shrink with `a·D`, but never below half of their base weight.

The extreme scenario has a larger `D`, so it moves time to AI collaboration and verification without any change by
hand. The base weights are in `APPROACH` and are team assumptions. A skill without AI data gets the same split under
both scenarios.

`stageApproach(skillIds, scenario)` averages the split over a stage's skills.

## Roadmap generation

`POST /api/roadmap` does the following:

1. Builds the skeleton from AI exposure and hiring demand, for the career as targeted.
2. Gives every stage the learning approach of the **effective scenario**.
3. Passes `scenario: scenarioState(save)` to `generateRoadmap`.

The DeepSeek prompt then:

- states the scenario and each stage's learning approach;
- in customise mode, lists the job posting's requirements (R1, R2...);
- asks every task for a `learningActivity` (one of the five activities), and keeps at least one foundation or
  independent-practice task per stage.

The roadmap stores `scenario`, each stage's `approach`, and each task's `learningActivity`.

`replanSuggested` reasons:

| Reason | When it appears |
|---|---|
| `trend-data` | New data changed the core, a branch or the `later` list. |
| `method-changed` | The roadmap was built with another reading of the data. |
| `scenario-changed` | The effective scenario differs from the one the roadmap was written for, so tasks would be learnt another way. The branch to follow switches at once; regenerating is the player's choice. |

## Mock data

All mock data is generated by scripts. Each result that uses it is marked `mock`, and real data replaces it
automatically as it accumulates.

| Mock | Script | Method |
|---|---|---|
| Hiring-demand months `data/mock/market-months.json` | `src/data/scripts/mock-market-months.mjs` | Five months before the first collected month. Each skill and career moves 10% a year in its big-picture direction, or not at all without one. |
| AI exposure `data/mock/ai-exposure.json` | `src/data/scripts/mock-ai-exposure.mjs` | Mean of the reviewed skills of the careers needing the skill |

Details on the hiring-demand mock months:

- The direction comes from `big-picture.js`, which combines the WEF Future of Jobs Report 2025 (pages 19, 37 and 168)
  with MyCOL emerging roles. Only the reviewed entries of
  [wef-mapping.json](../src/data/config/wef-mapping.json) count.
- They are no longer read once 3 real months compare.
- Momentum `confidence` counts real months only.
- They do not follow the JobStreet 2024→2025 change. Its two years were collected differently, and following it put
  teachers and chefs at the top of the ranking.

Run again after a review:

```
python src/data/scripts/build_ai_exposure.py
node src/data/scripts/mock-ai-exposure.mjs
node src/data/scripts/mock-market-months.mjs
```

To refresh `periods.json`, run `build_aei_periods.py` with the downloaded release file.
