# Reference island correction

Status: superseded by the user's explicit rollback request. The active design is `2026-10-21-cropped-original-map.md`.

User rejected island-v1 because its silhouette, terracing, roads and separate Blender render did not match either the supplied island reference or the current game. User clarified: the whole island's terrain should follow the reference; keep the current game's art style.

## Accepted direction

Use an irregular mainland with a western town and deep port bay, a southern dormant volcano peninsula, several nonconcentric wooded interior terraces, a tall northeastern rocky headland and offshore islets/reef arcs. Roads follow the reference's town frontage and winding mountain paths. Do not keep the circular island, concentric levels or uniform reef perimeter of v1.

Preserve the game's existing MeshDefaultMaterial, lighting, weather, camera, player, foliage and grass implementation. Add a reference island mode with its own editable Blender source, GLB, sampled height data, terrain masks, vegetation placement, respawns and map picture. Keep the original map available with `?map=original`. Verify the replacement inside the actual game, not only Blender.

Reuse existing tree and flower visuals with new placement references. Old portfolio scene props are map-specific and stay on the original map. Keep career UI, characters, NPC conversations and pets working. Building assets remain separate; do not substitute giant blank labelled pads for buildings.

Prepare click-to-move on the new terrain with walkability and slope checks, keyboard cancellation and no accidental movement when interacting with UI. If runtime movement is not complete, state that explicitly.

## Verification

Build the game. Load both original and island modes. Check actual browser rendering, collisions, spawn/NPC heights, minimap alignment and sampled path reachability. Capture the entire terrain and player-level daylight views. Keep v1 files and all prior user modifications.
