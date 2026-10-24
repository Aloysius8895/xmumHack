# Guild leaderboard parchment

Approved by the user on 2026-10-21. The production asset is `static/leaderboard/guild-parchment.png` (1345 × 1169 RGBA), generated with the built-in image generation tool, not the CLI. The original generated file remains in the Codex image library. This plate intentionally has no sample names or scores; the scene composites live Career API data over it.

Reference: the approved fantasy guild parchment preview from this conversation, `exec-f381dcce-8e25-4a1b-9ed3-43b348ba82e1.png`.

## Exact production generation prompt

Create a production-ready transparent PNG game texture from the APPROVED parchment leaderboard design on the RIGHT of the supplied reference. Extract/recreate ONLY the single parchment document, no presentation background, no scene, no roof, no lantern, no labels. Retain the approved warm golden-ivory handmade paper, softly uneven worn paper edges, little curled top-right corner, two brass pins near upper corners, red wax seal centered at the very top with short ribbon tails, sepia trophy-and-leaf crest, thin double-line ornamental border and tiny corner leaves, extremely faint magic-circle watermark. Cozy anime fantasy adventurers guild, hand-painted and lightly textured, matching the reference precisely. A nearly square landscape sheet, about 1.15:1 width to height, tightly framed with only 3% transparent padding. The title near the upper third must read exactly 'GUILD RANKINGS' in beautiful dark sepia fantasy serif handwriting; trophy and wax seal above it. Header elements confined to the TOP 40% of the texture. The BOTTOM 56% is reserved for dynamically rendered live rankings and MUST BE EMPTY PARCHMENT: remove ALL player names, ALL scores, ALL portraits, ALL rank medals/numbers, ALL stars next to numbers, ALL winner underlines and ALL horizontal rank row separators from the reference. Leave completely clean blank parchment below a single thin header divider at 41% of image height, with just the very faint magic-circle watermark behind it. Keep only the perimeter ornamental border. Do not add placeholder text, imaginary writing, symbols in the rows, sample scores, row boxes, or any other content in this blank region. NO new lettering except the exact title. Actual alpha transparency outside the parchment silhouette and seal. No shadow cast on an external background, no opaque checkerboard. This is the reusable underlying paper artwork; all changing data will be rendered by code.

## Runtime treatment

- `World/GuildLeaderboardArtwork.js`: medals, portraits, names, scores and the little guild notices.
- `World/GuildLeaderboard.js`: one 1024 × 896 canvas texture, four small notice textures, game material with soft warm fill, and attachment derived from the original map mesh's UV corners.
- Data comes from `CareerApi.state.leaderboard`. Unused ranks are localized open slots. Unknown friend portraits use initials; the local player uses the selected character's portrait.
- Regenerate only the paper plate when changing the painted ornamentation; changing data should remain live canvas text.

Verification: `python src/tools/verify_guild_leaderboard.py` uses an isolated API fixture and writes screenshots to `src/verification/guild-leaderboard/`. It does not change a player's save.
