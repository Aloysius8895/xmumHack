# Shared Fantasy Exhibit Implementation Plan

> **For agentic workers:** Execute the steps sequentially in this workspace; preserve existing uncommitted integration and AI-data work.

**Goal:** Apply the user-approved illustrated purple board to every shared building screen.

**Architecture:** Keep the existing BuildingVisit lifecycle and CareerUI renderers. Add a decorative asset and scoped stylesheet, and switch BuildingScreen to viewport-fitted HTML presentation with live title, navigation and scrolling content.

**Tech Stack:** Three.js, existing JavaScript modules, Stylus, Vite, generated transparent PNG.

## Global Constraints

- All existing page actions, data, language selection and learning progress remain functional.
- Decorative art must not contain baked-in text or block HTML controls.
- Do not alter the user's AI mapping or other in-progress backend work.

## Tasks

- [x] Copy the generated transparent frame into `src/game/static/interface/`, keeping the original image intact.
- [x] Add a viewport layout helper and integrate it in `BuildingScreen.js`; preserve camera and visit cleanup, and update live room captions.
- [x] Add decorative markup and room controls to the existing panel in `CareerUI.js`.
- [x] Add `fantasyExhibit.styl` after the existing building styles; implement parchment surfaces, purple controls, accessible focus and responsive wrapping.
- [x] Verify desktop and narrow viewport layout with automated tests; all 342 game tests and the production build pass.
- [ ] Live Chrome visual inspection: blocked by the computer-use connection (no screenshot target / foreground process). The user supplied a live screenshot confirming the shared design is displayed; their requested backdrop removal is applied.
