# Guild Parchment Leaderboard Implementation Plan

**Goal:** Put the approved fantasy guild parchment leaderboard onto the existing landing kiosk.

**Approved design:** The user approved the parchment preview on 2026-10-21: warm ivory paper, brass pins, red wax seal, trophy crest, sepia ink, faint magic circle, three medal rows, and small side notices.

**Architecture:** A canvas combines generated parchment artwork with the existing Career API leaderboard. A small scene component positions the canvas and side notices using the removed map mesh's UV corners and transform. It participates in the landing area's frustum visibility and uses the existing scene material and interaction.

**Tech stack:** Existing Three.js WebGPU/TSL, Canvas 2D, CareerApi events, Playwright.

## Constraints

- Keep the kiosk model, colliders, and existing leaderboard interaction.
- Show the real first three rows from `state.leaderboard`; leave unused ranks open.
- Never insert preview/example scores into a player save.
- Keep changing names and scores separate from the generated paper artwork.
- Draw updates on state, portrait, and font changes, not every frame.
- Keep all production artwork in `GamePlat/game/static/`.
- Preserve existing unrelated working changes.

## Task 1: Parchment artwork and live scene component

Files:
- Create `GamePlat/game/static/leaderboard/guild-parchment.png` from the approved image using the built-in image generator.
- Create `GamePlat/game/sources/Game/World/GuildLeaderboardArtwork.js` for canvas medals, portraits, names, points, and small quest notices.
- Create `GamePlat/game/sources/Game/World/GuildLeaderboard.js` for mesh placement, textures, image loading, and API binding.
- Modify `GamePlat/game/sources/Game/World/Areas/LandingArea.js` to retain the removed map's transform as the placement reference and create the component.
- Modify `GamePlat/game/sources/Game/Game.js` to bind it after Career is initialized.
- Modify `GamePlat/game/sources/Game/CharacterSelect.js` to refresh the local player's board portrait on selection.
- Modify `GamePlat/game/sources/Career/i18n.js` for the empty rank label.

Interfaces:
- `new GuildLeaderboard(area, surface)` consumes the landing Area and the detached original map mesh.
- `bind(api)` consumes the existing CareerApi and subscribes to `state` events.
- `setPlayerCharacter(id)` updates the local player's portrait.
- `draw()` composites cached images and the first three rows onto one canvas texture.

- [x] Generate and inspect a clean parchment plate with an empty ranking area.
- [x] Implement artwork composition and scene placement.
- [x] Bind actual leaderboard events and character portraits.

## Task 2: Verify appearance and behavior

- [x] Use an isolated browser API fixture to check three ranked players, score/name updates, empty slots, long Unicode names, and character portraits.
- [x] Check the physical board in daylight and nighttime, and after frustum visibility changes.
- [x] Confirm the original interaction opens the full leaderboard and the M map still opens.
- [x] Inspect game screenshots and the composited paper texture.
- [x] Run syntax checks, `npm.cmd run build`, and `git diff --check` for affected code.

No user save writes, generated example leaderboard entries, or new dependencies are needed.
