# Restore the first-visit beginner tour

The automatic entry point was removed in commit `5a95466`, while Settings replay and the `tourSeen` completion flag remained. Restore automatic startup only for browsers without `tourSeen=1`, after both character confirmation/world reveal and the initial career API state are ready. Either can complete first. A handled guard prevents repeated startup on live state updates, including when browser storage is unavailable. Skipping or finishing retains the existing completion flag. Settings replay remains available to returning visitors.

Keep the existing Wisp dialogue, spotlight, interactive steps, and guided-tour demo mode. Do not reset player skills, targets, progress, or browser preferences to force a replay.

Validation covers both initialization orders, completed/skipped visits, unavailable storage, normal character confirmation, Settings replay, and mobile spotlight placement. Browser checks intercept all API calls with an isolated fixture and do not submit learning data or call an AI provider.

Narrow-screen guidance keeps the requested menu button reachable above the HUD, allows the menu to scroll horizontally, and wraps the tutorial footer. When guiding a form, Wisp sits at the bottom with reserved scroll space so the input and action button remain clickable. Long instructions can scroll within the dialogue. Panel padding is restored when the tour ends.

During the tour only, narrow-screen textareas use a compact initial height so their first line and the action button fit above Wisp. The browser check verifies both remain unobscured; normal panel sizing returns when the tour closes.

Verified: 159 game/server/career/n8n tests and the production build passed. Browser checks passed for a fresh character-confirmation visit, a real returning-page navigation after Skip, Settings replay, API loading after the world reveal, and 390x844 / 320x568 layouts. Both the profile textarea and extraction button remained reachable, temporary spacing was restored on exit, and there were no page errors. Evidence is in `GamePlat/verification/beginner-tour/`.
