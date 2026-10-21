# Cropped Original Map Implementation Plan

> Execute inline. This replaces the reference-island plan at the user's request.

**Goal:** Restore the original map, keep only the user's pictured east-side region, and support click movement there.

**Architecture:** A shared MapBounds module governs rendering, terrain mask, original scene placements, character bounds and both map coordinate transforms. Navigation samples the original Rapier static colliders. Original models, shaders and career UI remain the source of the visual style.

**Tech Stack:** Existing Three.js/TSL, Rapier, Vite and headless Chromium verification.

- [x] Restore original world initialization and terrain sources without reverting the user's earlier career changes.
- [x] Apply shared scene bounds; remove off-region foliage and portfolio areas, retaining the natural island.
- [x] Crop large map and minimap with matching coordinates.
- [x] Prepare collider-based click navigation with keyboard/UI/teleport cancellation.
- [x] Verify actual browser output, player boundaries, six NPCs, map alignment and click movement.
- [x] Complete production build and deliver the running game preview and screenshots.
