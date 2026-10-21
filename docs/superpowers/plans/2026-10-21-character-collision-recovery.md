# Character collision and recovery implementation plan

**Goal:** Fix collision/knock recovery in the existing dynamic Rapier capsule without replacing the engine or hiding the causes with resets.

**Evidence before implementation:** `GamePlat/verification/character-stuck/before-fix-summary.json` preserves the pre-change controller test summaries. A capsule caught between two edges remains `grounded=false`, `knock=air`, at rest after 15 real seconds. The map boundary's post-step translation clamp repeatedly embeds the capsule in an adjacent obstacle. Ordinary wall contact and backing away work. The supplied 2.7-second video only shows the resulting symptom, so its exact unseen trigger is not assumed.

**Architecture:** Keep a dynamic upright capsule, use Rapier CCD and bounded physics substeps, replace post-step map teleport clamps with character-only static boundary colliders. Ground queries inspect non-sensor, collision-compatible upward surfaces and capsule contacts. Physics owns knock recovery deadlines; animations cannot leave input locked. A dedicated recovery helper measures penetration, resolves small overlaps, records verified supported positions and only relocates after persistent geometric failure. Diagnostics are opt-in and record the physics evidence.

## Implementation

- [x] `Physics.js`: character/boundary groups, physics substeps and drain contact events for every substep.
- [x] `PhysicsCharacter.js`: CCD, zero combined friction, boundary colliders, normal/contact ground support, simulation-time knock lifecycle, consistent reset/synchronization.
- [x] `CharacterRecovery.js`: collision-filtered contact queries, bounded depenetration, conservative geometric anomaly clock and validated nearby/history/respawn fallback. Never use held input plus low displacement as the relocation criterion.
- [x] `VisualCharacter.js`: repeatable knock animation starts, ignore stale completion callbacks, synchronize/reset visuals on physical recovery.
- [x] `CharacterDiagnostics.js`: optional capsule wireframe and input/displacement/velocity/ground/knock/recovery trace, enabled with `?characterDebug=1`.

## Validation

- [x] Inspect video frames, controller, capsule scale/offset, ground and foliage collision creation, bomb velocity path, physics and animation ownership.
- [x] Reproduce failures with unmodified controller before implementing fixes.
- [x] Extend the actual Rapier/controller browser harness for walls/sliding/corners, small obstacles/edges, overlap, sensors, bombs/repeated bombs, missing animation callbacks and low frame rates.
- [x] Assert normal wall pushing never relocates the player and fallback targets are unpenetrated and supported.
- [x] Verify real scene colliders and bomb integration with isolated API data; show capsule diagnostics and save input/movement/state traces and screenshots.
- [x] Run syntax checks, the regression harness and production build; inspect results and document remaining limits.

No player saves, dependencies, unrelated scene assets, or engine migrations are part of this repair.
