# Career Dropdown Implementation Plan

**Goal:** Replace the legacy upper-right menu and persistent career rail with the approved warm-white dropdown.

**Architecture:** CareerUI owns dropdown state, DOM and input lifecycle; career.styl owns its appearance and responsive animation. Keep existing panel actions and localization.

**Tech Stack:** JavaScript modules, Stylus, Vite, Playwright.

## Constraints

- Upper-right placement confirmed by the user; warm white, dark gray and pink match the references.
- Preserve all seven shortcuts and existing workspace changes; add no dependencies.
- Keep unrelated internal game-menu integrations working.

## Task 1: Menu behavior and integration

- [x] Replace the standalone career rail with a persistent trigger and collapsible list in CareerUI.js; add setMenuOpen(open, restoreFocus) and preserve renderRail() as the item renderer.
- [x] Close on outside pointer press, focus leaving, Escape, panel/dialogue opening and selection. Use inert, aria-expanded and aria-controls; support arrow/Home/End navigation and normal Tab order.
- [x] Include menu state in the existing takeInputs/releaseInputs ownership checks.
- [x] Add menu.title translations for Chinese, English and Malay.
- [x] Remove the old trigger from index.html, remove its listener from Menu.js, and update its SocialArea reference. Route normal gamepad pause through CareerUI in ClosingManager.js; Escape dismisses the new menu without reopening the legacy menu.

## Task 2: Styling and verification

- [x] Replace career-rail positioning with upper-right dropdown styling: #fffbf8 background, #383340 ink, #ff659b accent, rounded corners, subtle shadow and downward reveal.
- [x] Keep mobile placement at the upper right; constrain height and allow list scrolling. Respect reduced motion and hide the trigger while a panel/dialogue covers it.
- [x] Apply the user's follow-up: remove map-trigger markup/listeners and its SocialArea reference, move the circular minimap to the upper left, and nest the HUD under the dropdown so it shifts down on expansion. Verify desktop/mobile corner placement and the minimap's full-map action.
- [x] Run npm run build from src/game.
- [x] Run browser checks on desktop and mobile for closed initial state, toggling, outside dismissal, Escape focus restoration, keyboard navigation, all seven routes, translations and viewport fit. Save screenshots under src/verification/career-dropdown/.

Validation: production build passed. Browser checks passed at 1440x1000, 390x844, 320x568 and 740x390, including all seven routes, dismissals, keyboard navigation, localization, map opening and corner alignment. No browser page errors. Screenshots and results are in src/verification/career-dropdown/.
