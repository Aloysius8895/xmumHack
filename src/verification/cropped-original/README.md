# Cropped original map

The replacement-island runtime was rolled back. The current game uses the original map, player, career NPCs, materials, foliage, lighting and water. The retained east-side region follows the user's supplied crop; its shared world bounds are X [-18,96], Z [-52,84]. Change `sources/Game/MapBounds.js` to refine the border.

The scene is clipped at those bounds, off-region foliage/areas are excluded, exterior terrain becomes deep water, and the character is constrained to the retained region. Both map views share the cropped coordinate transform and preserve the original image aspect ratio. Source model files remain available for future editing.

Click movement uses a navigation grid sampled from the original static colliders, including bridges. It rejects sea/out-of-bounds targets and cancels on keyboard movement, UI opening and teleportation. Dynamic moving obstacles are not continuously replanned; a blocked route cancels after a short stall.

Validation: three coordinate tests passed; production build passed; headless Chromium reported no JavaScript page errors. All six career NPCs were grounded. An actual canvas click started a route and moved the player about 5 metres to the selected destination; keyboard cancellation and physical boundary clamping passed. Details: `checks.json`.

`game.png` shows the restored game renderer; `map.png` shows the cropped large map. The captures use the game's own daylight cycle and renderer. No Blender render is used as game validation.

Preview: http://127.0.0.1:5173/

Run checks from the repository root:

```powershell
node --test 'GamePlat/game/world-building/map-bounds.test.mjs'
python 'GamePlat/game/world-building/check_cropped_map.py'
```

Run the build from `GamePlat/game`: `npm run build`.
