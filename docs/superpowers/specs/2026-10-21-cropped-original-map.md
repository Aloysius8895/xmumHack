# Restore and crop the original map

The user cancelled the replacement-island approach and confirmed their supplied cropped map image shows the area to keep. Restore the original scene and art style, retaining the character and career-platform work predating the island experiments. Crop the actual scene as well as the large map and minimap.

The retained east-side natural island is approximated by world X [-18, 96], Z [-52, 84], matched to the supplied image. Keep the original 192-metre coordinates and asset files so NPC and landmark positions stay aligned. Remove off-region foliage/areas from instantiation, clip geometry and lights at the same bounds, use deep water outside, and constrain the character to that region. Crop both map views using the same coordinate transform. All six career leaders remain within the retained area.

The original click-to-move request remains in scope: derive a grid from the original scene's static colliders, avoiding water, tall obstacles and excluded regions. Keep keyboard control and stop the route on UI opening, keyboard movement or teleportation. Do not load the experimental island assets.

Validate the production build, actual game rendering, six NPCs, map coordinates, physical boundary behavior and click navigation. Preserve experiment files separately; do not revert earlier user edits.
