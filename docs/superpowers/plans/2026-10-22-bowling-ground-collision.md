# Bowling shoreline collision repair

**Goal:** Prevent the player from sinking below the visible ground beside the bowling lanes.

**Evidence:** The exported terrain vertices around x=-18 contain Float32 drift, e.g. x=-18.000005722 on a nominal boundary vertex. `Floor.setPhysical()` compares raw exported coordinates to `MAP_BOUNDS` and replaces these in-bounds heights with -1.5. At x=-17.65, z=63 the real Rapier floor is about -1.15 while the visible paved ground is at 0. A settled character consequently has feet below -1.0. Similar drift exists at z=84. Evidence is in `docs/verification/bowling-ground/before-edge-survey.json`, `before-edge-reproduction.json` and `before-edge.png`.

**Architecture:** Keep the existing dynamic capsule, visual synchronization and terrain. Classify heightfield vertices against crop bounds using their canonical regular-grid coordinates (the same rounded indices already used by Rapier's heightfield), instead of imprecise source GLB coordinates. Preserve source heights and truly out-of-bounds seabed. No blanket floor, player offset or forced teleport.

## Steps

- [x] Use canonical grid x/z values for the crop check in `sources/Game/World/Floor.js`.
- [x] Add a real-scene browser regression for supported ground at the bowling edge, settled capsule feet, walking along and away from the edge, jump/landing and boundary containment. Record floor heights, input movement, recovery counters and screenshots without modifying player saves.
- [x] Run the new check, the existing character-physics regression harness, and production build; inspect the before/after screenshot and diff.

No dependency, asset, save, secret, deployment, push or merge changes.

## Validation result

The 21 real-scene ground samples along x=-17.65, -17.1 and -16.5 now agree with the paved surface within 6 cm. The settled character feet are y=-0.00107 at x=-17.6,z=63 (previous boundary probes were about -1.15). Actual keyboard boundary pushing, movement along/away from the edge and jump/landing passed with no recovery relocation. Existing controller regressions: 21 passed. Production build passed. No browser page errors. Original scene assets and player saves were not modified.
