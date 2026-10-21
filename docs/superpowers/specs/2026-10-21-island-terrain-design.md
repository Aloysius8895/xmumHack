# Editable island terrain

The user approved the proposed Blender/Lux3D division of work and requested the Blender terrain assets. This delivery is a standalone editable Blender scene, not a change to the running game.

## Scope

Create a stylized tropical island inspired by the supplied six views of one island: a western port and town plain, terraced green interior, eastern beaches and cliffs, and a southern dormant caldera. Provide connected roads, graded paths, a staircase and a pedestrian bridge. Reserve six flat building sites for the existing career gyms. Buildings and detailed vegetation remain separate future assets.

Use metres, Z-up in Blender and standard glTF coordinate conversion on export. Separate named collections for terrain, circulation, building sites, coast details, navigation and preview staging. Save the construction scripts, editable `.blend`, embedded-material `.glb`, static preview renders and navigation metadata. Export the island separately from preview water, lights, cameras and building-site presentation markers. Preserve existing user files and existing running Blender documents.

## Movement preparation

The terrain surface is a triangulated height field with flat terrace tops and road corridors shaped into it. Road/path strips sample that same surface. Primary routes connect all six sites with gradients no steeper than 18 degrees. Stairs have a separate smooth navigation ramp and a bridge has a walkable deck. Export route data and simplified walk surfaces for subsequent integration. This does not implement or certify in-game collision or click-to-move.

## Acceptance

Reopen the saved Blender scene in a fresh background process, check expected collections, finite mesh coordinates, route connectivity, clear width and slope, and export bounds. Reimport the GLB to check it is self-contained and includes terrain and circulation. Render and inspect an oblique and an overhead view. Deliver actual files with limitations stated.
