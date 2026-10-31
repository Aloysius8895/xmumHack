# Character collision / knock recovery repair

Date: 2026-10-21. Player save data was isolated by intercepting the Career API in browser tests.

## Confirmed causes before changing gameplay code

1. `PhysicsCharacter.testGround()` used five short rays, accepted any hit, and ignored contact normals and actual capsule contacts. A capsule held between two obstacle edges can have zero velocity while all five rays miss. `knockState='air'` disabled movement unconditionally, and the only recovery deadline applied to `down`. The actual unmodified controller remained locked in `air`, `grounded=false`, at the same position after 15 real seconds. See `before-fix-summary.json`.
2. `updatePostPhysics()` directly clamped X/Z translation to map bounds after the solver. An obstacle close to the boundary can push the capsule out, then the clamp pushes it back into the obstacle on every frame. This was independently reproduced with the unmodified controller.

Additional confirmed weaknesses: no character CCD, a single physics step as large as 1/15 simulation second with the default time scale, unfiltered sensor/inside-solid ground queries, and animation completions that could release a newer knock while it was airborne. Regression cases now exercise these conditions. The exact unseen trigger preceding the supplied 2.7-second video cannot be established from that recording.

## Controller and collision audit

- Existing engine: Rapier 0.17.3; a dynamic, rotation-locked capsule, not Rapier's kinematic character controller.
- Capsule: radius 0.35, cylinder half-length 0.4, total height 1.5; the model is fitted to height 1.5, its feet are offset 0.75 below the capsule center. Runtime inspection and wireframe screenshots confirm these values for the tested default character.
- `Player` produces desired movement. `PhysicsCharacter` drives velocity before simulation; Rapier resolves collisions; the character/player caches and model follow afterward.
- `Explosions` launches by velocity/impulse, not by moving the player position. Its delayed crate/fireball path was tested in the full game.
- `VisualCharacter` changes animation, tumble and squash, and follows the capsule. It does not drive the rigid body position.
- `Grass`, `Bushes` and `Foliage` rendering does not create grass/leaf collision bodies. Ground is a heightfield; scene props, tree trunks, NPCs and crates have separate real colliders. Not every decorative asset across the full map was manually audited.

## Production files changed

- `sources/Game/Physics/Physics.js`: character-only boundary interaction groups; substeps no longer exceed 1/60 simulation second; drain contact events on each substep; permit four CCD substeps.
- `sources/Game/Physics/PhysicsCharacter.js`: enable capsule CCD and additional solver iterations, use zero minimum combined friction, replace post-step position clamps with four character-only boundary colliders, inspect contact-aware ground support, use simulation-time state transitions, release stationary contact-induced air locks, and give physics an independent recovery deadline. Relocation resets rigid-body forces/velocities, movement cache, jump/knock timers, ground state, navigation and visuals.
- `sources/Game/Physics/CharacterRecovery.js`: collision-compatible, non-sensor, enabled-body queries; normal/foot contact support; bounded depenetration that must reduce measured overlap; record supported safe positions; conservative final relocation.
- `sources/Game/World/VisualCharacter.js`: restart knock clips for repeated blasts, reject stale/non-current completion events, derive the physics deadline from the current knockdown/getUp durations, and synchronize/reset model transforms on recovery.
- `sources/Game/Physics/CharacterDiagnostics.js`: opt-in capsule wireframe, HUD and rolling input/displacement/velocity/ground/knock/recovery records.

## Final recovery rules

Normal held movement against a wall is not a relocation condition. Abnormal geometry must persist for over 2.5 simulation seconds: significant penetration, opposing contacts holding an unsupported capsule, an invalid map position, or a position below the playable world. Small overlap corrections are attempted first and must improve signed contact penetration. Normal physics/knock recovery continues before final relocation.

Relocation candidates are searched nearby, then revalidated recorded safe positions, then the nearest validated respawn. Each requires a full capsule clearance test, map clearance, and at least three supporting downward rays on fixed upward-facing surfaces. Disabled colliders, sensors and moving debris cannot be used as safe supporting ground. If no position passes, no unchecked default teleport occurs. Normal intentional UI/player input locks are preserved.

## Actual verification

`regressions.json` contains 21 passing cases with input, position, actual displacement, rigid-body velocity, grounded, knock and recovery traces:

1. Push a wall for 15 real seconds, slide alongside it, then move away: zero relocations.
2. Push into a right-angle corner, then reverse: zero relocations.
3. Move into/away from a small obstacle.
4. Bomb landing into a narrow edge wedge: exits the air lock; exactly one fallback; its destination passes the clearance/support validator.
5. Shallow overlap: bounded depenetration, zero fallback relocations.
6. Sensor-only geometry is ignored for ground.
7. A ground ray originating inside a wall does not report walkable ground.
8–11. Bomb launch/landing without animation callbacks at simulation deltas 1/60, 1/30, 1/15 and 0.1 second. Original launch velocity is preserved; control returns; zero fallback relocations.
12. Four repeated airborne blasts recover.
13. Ordinary jump, air steering and landing.
14. Knockdown slides off a platform edge and lands again.
15. Extreme-speed launch against a thin wall at a 1/15-second simulation delta: no tunneling through the wall.
16. Sustained map-boundary contact and inward release: zero relocations.
17. Existing obstacle/boundary overlap: validated supported recovery.
18. Floating, overlapping and disabled-support candidates are rejected; an empty safety search returns no position.
19. A fault below the world uses revalidated supported history.
20. Blocked history is rejected and a respawn is clearance/support checked.
21. Stale animation completion does not cancel a fresh airborne blast or a non-current knockdown action.

`scene-results.json` records a separate full-game run:

- Actual keyboard movement and reverse among the social-area props near the video location.
- Actual crate delay → fireball → explosion → flight → landing/getUp → restored control.
- Three consecutive actual fireball explosions, with normal dynamic scene objects/debris enabled.
- About 10 FPS rendering/ticking, followed by another bomb landing and actual keyboard movement. The original ticker's delta clamp remains active; separate regression cases exercise larger simulation deltas.
- Final model X/Z equals the capsule, model feet Y equals capsule Y minus 0.75; player state is default, grounded is true and knock is none.
- 869 diagnostic samples, 11 state events, zero final relocations and zero depenetration corrections during this full-game run. Get-up periods were 10.155, 10.102 and 10.129 simulation seconds, matching the tested clips' combined 10.133 simulation seconds; the independent safety deadline is 10.633 seconds.
- No page errors. Production build and JavaScript syntax checks passed. Build still reports the existing font/UI asset-resolution and large-bundle warnings.

Screenshots: `social-capsule.png`, `social-all-colliders.png`, `crate-airborne.png`, `crate-recovered.png`, `low-fps-recovered.png`.

## Reproduce and inspect

With the existing Vite dev server running:

```powershell
python GamePlat/tools/verify_character_physics.py
python GamePlat/tools/verify_character_scene.py
```

Open `http://127.0.0.1:5173/?characterDebug=1#skip` for the cyan capsule and diagnostic HUD. Without `characterDebug`, they are disabled. Live records are available at `game.physicalVehicle.diagnostics.samples` and `.events`. All-world collider rendering was temporarily enabled for `social-all-colliders.png` and disabled afterward.

## Remaining limits

- The video's exact preceding collision/explosion sequence was not recorded; the two confirmed failures are reproduced representative causes, not a claim to have reconstructed that unseen sequence.
- The full game run used the default character. Every alternate character model, every map object and every slope/bridge/terrain location has not been exhaustively playtested.
- Actual mobile hardware, networked/multiplayer interactions, long unattended sessions, and device-specific CPU/GPU throttling have not been tested. The low-frame-rate integration run used explicit render-loop throttling on desktop Chromium.
- Physics substeps and CCD add work. Their performance on low-end mobile hardware still needs measurement.

Primary API references used alongside the installed 0.17.3 typings: [Rapier rigid bodies / CCD](https://www.rapier.rs/docs/user_guides/javascript/rigid_bodies/), [scene queries](https://www.rapier.rs/docs/user_guides/javascript/scene_queries/), [query filters](https://rapier.rs/docs/user_guides/javascript/scene_queries_filters/).
