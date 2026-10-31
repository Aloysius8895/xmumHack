# Chill chill Social Introductions Implementation Plan

**Goal:** Replace original social contacts with the user's team repository and explicit missing-information dialogs.

**Architecture:** Keep the existing eight interaction positions and 3D assets. Send each interaction to a shared social introduction registered in the current modal system; localize at opening using Career i18n.

**Tech Stack:** JavaScript ES modules, existing Three.js interactions, HTML, Stylus, Vite, Playwright.

## Constraints

- Team: `Chill chill`; repository: `https://github.com/Aloysius8895/xmumHack`.
- All unspecified platforms remain with the message `创作者还未提供`, translated with the selected language.
- External navigation requires clicking the repository button inside the dialog.
- Preserve original platform order and icons, other credits, saves and unrelated work.
- Do not push or merge branches; do not read or expose secrets.

## Steps

- [x] Update `sources/data/social.js`: export the team name, replace GitHub's destination, and remove all other destinations.
- [x] Add `sources/Game/SocialIntroduction.js`: render team/platform, description, localized close label and optional repository link with `textContent` and safe link attributes; remove stale link attributes for missing contacts.
- [x] Integrate the presenter with `sources/Game/Modals.js` and call `openSocial(link)` from `sources/Game/World/Areas/SocialArea.js`.
- [x] Replace the original Discord modal in `sources/index.html` with the shared dialog. Add scoped `sources/style/social.styl` and import it from `style/index.styl`.
- [x] Add `social.*` strings to `sources/Career/i18n.js`; use the team name for the world-map social marker in `sources/Game/Map.js`.
- [x] Run `npm run build`. In the running local game, exercise each social interaction; confirm all seven missing platforms have no link, GitHub points to the provided repository, and no popup opens before the explicit button.
- [x] Verify Chinese, English and Malay dialogs, desktop/mobile dimensions, close button and Escape. Inspect screenshots and final diff.

## Validation result

Production build passed. Browser verification exercised all eight actual world interaction callbacks in Chinese, English and Malay (24 cases), plus six mobile layout checks at 390 x 844. GitHub opened only after its button was clicked and used the supplied repository destination. Placeholder dialogs had no external link, including after visiting GitHub. Close-button and Escape checks restored game input. No browser page errors were recorded. Screenshots and results are in `docs/verification/team-social/`.
