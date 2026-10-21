# Reference Island Implementation Plan

Status: cancelled by the user in favour of restoring and cropping the original map. Do not resume this replacement-island work. See `2026-10-21-cropped-original-map.md`.

> Execute inline in the current session; preserve existing user edits.

**Goal:** Replace the rejected circular island with reference-led terrain rendered in the existing game style.

**Architecture:** Blender generates terrain geometry and a matching regular height grid, masks and placement metadata. A small Island module installs these resources before the existing world starts, retaining the game's rendering and foliage classes. Original mode remains available.

**Tech Stack:** Blender 5.2, existing Three.js WebGPU/TSL, Rapier and Vite.

- [ ] Build reference-shaped terrain with a port bay, volcano peninsula, irregular terraces, headland and reef arcs; save Blender and export GLB/data.
- [ ] Load island data, use existing game materials/grass/trees/water, and install matching terrain collision and career respawns.
- [ ] Update map imagery and NPC locations while retaining original mode.
- [ ] Check native game views and iterate on visual mismatches.
- [ ] Verify build, map modes, collisions and movement; document completed work and remaining limitations.
