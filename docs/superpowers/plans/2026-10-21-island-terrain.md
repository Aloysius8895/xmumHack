# Island Terrain Implementation Plan

> **For agentic workers:** Execute inline, task by task, preserving all existing project changes.

**Goal:** Deliver an editable Blender island terrain scene and portable model for the user's career game.

**Architecture:** Deterministic Blender Python constructs a sampled island height field and connected circulation from shared route data. A second script reopens the saved project and reimports its exported GLB to validate delivery files.

**Tech Stack:** Installed Blender 5.2.2 LTS, embedded Python, glTF 2.0.

## Global Constraints

- Use metres and Z-up in Blender; let the glTF exporter convert axes.
- Work in `GamePlat/assets/island-v1` and `GamePlat/game/world-building` only, plus these new documents.
- Preserve existing Blender processes and game source modifications.
- Do not claim click-to-move or game collision integration.

### Task 1: Terrain and circulation

**Files:** Create `GamePlat/game/world-building/build_island.py` and `island_geometry.py`.

**Interfaces:** Build script writes `island.blend`, `island.glb`, `navigation.json` and static PNG previews under `GamePlat/assets/island-v1`.

- [x] Create named terrain, route, bridge, stair, site and preview collections.
- [x] Triangulate shoreline and terrain samples; shape terraces, ramps, caldera and beach.
- [x] Build roads and paths using the shared height function; reserve six sites.
- [x] Save the scene and export only game asset collections.
- [x] Render overhead and oblique views, inspect them and fix material/layout issues.

### Task 2: Delivery verification

**Files:** Create `GamePlat/game/world-building/verify_island.py` and `GamePlat/assets/island-v1/README.md`.

**Interfaces:** Verification reads the saved blend, GLB and route JSON; writes `verification.json`.

- [x] Reopen the actual blend, validate route graph, width, gradients and mesh bounds.
- [x] Reimport the actual GLB; confirm mesh/material presence and no external resource dependencies.
- [x] Record counts, checks, file sizes and known limitations in delivery documentation.
- [x] Provide links to the verified editable scene, model and previews.
