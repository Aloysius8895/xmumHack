# bruno-simon.com local reproduction — 2026-10-20

Goal: an exact, locally served copy of https://bruno-simon.com/ (Folio 2025)
in template3, built with the project crawler and the REA reverse-engineering
skill from `skill/Copy/rea`. Same architecture as template1/template2: keep the
original compiled frontend byte-identical and serve it from a stdlib server.

## Evidence

| Question | Source | Finding |
| --- | --- | --- |
| What does the page load at start? | Crawler run `bruno-simon_20261020_093901` | 149 requests: Vite bundle `assets/index-ORr3L4no.js` (4.9 MB, unminified), CSS, Draco + Basis decoders, ~45 compressed GLB/KTX resources, lazy Rapier chunk + WASM, ~40 mp3 files, Google Fonts, Google Analytics. |
| Which paths are built at runtime? | Bundle text, e.g. `` `intro/${a}Label.ktx` ``, `lab/images/${imageMini}` | Not every asset is a literal, so code scanning alone is incomplete. |
| Where do those paths come from? | GitHub API tree of `brunosimon/folio-2025` (MIT) | `static/` is copied verbatim to the site root by Vite; its listing (958 files) gives every servable path. Live `Last-Modified` (2026-04-07) equals the repo's last push. |
| Which servers does the app talk to? | Bundle `class Server`, crawler (`is-server-offline` class) | One WebSocket `wss://srv740865.hstgr.cloud:36255` for whispers, leaderboards and counters; the game has a built-in offline state. No other runtime APIs. |
| Static application facts (REA) | `analysis/rea-app-evidence.json` (`ev_de18efab…`), summary `analysis/rea-summary.json` | 3 files parsed, 0 parse failures, 1,036,832 AST nodes; 54 exact asset routes (all present in the mirror); 10 localStorage keys; 1 worker (`new Worker(this.workerSourceURL)`, Basis/Draco). Coverage gap: the semantic graph reached its 40,000 retained-node capacity and did not extract the WebSocket URL, so that fact rests on the bundle text and crawler observation. |

## Implementation

- `tools/mirror.py`: discovery = crawl requests + index.html refs + JS/CSS
  path literals (iterated so chunk → WASM is followed) + repo static listing.
  Downloads bytes from the live site only, rejects HTML responses for non-HTML
  paths, retries, records URL/sources/size/SHA-256 in `asset-manifest.json`.
  Skips the three uncompressed `.wav` masters (130 MB); the bundle references
  only the mp3 versions.
- `site/index.html` is the only modified original file: analytics removed,
  Google Fonts localized (`vendor/google-fonts/`), `local-runtime.js` added.
  The unmodified copy is `tools/original-index.html`.
- `site/local-runtime.js`: replaces `WebSocket` for the production server host
  only with a socket that never opens. The bundle stays byte-identical and the
  game shows its own offline state; nothing is sent to the author's server.
- `serve.py`: 127.0.0.1 only, correct `application/wasm` and GLB/KTX types,
  query strings (`?cb=1`) ignored by the static handler, no remote fallback.
- `tools/verify.py`: offline Playwright run (all non-local requests aborted and
  reported) at 1440×1000 and 390×844 touch; intro → start → drive → menu → map;
  optional live-site capture for `verification/compare.html`.

## Result

971 files, 73.8 MB, 0 missing. Verification (`verification/results.json`):

| Run | fps | Start | Resources | Blocked external | HTTP errors | Failed | JS errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local desktop | 77.5 | 18.1 s | 189 | 0 | 0 | 0 | 0 |
| local mobile (touch) | 83.5 | 17.8 s | 156 | 0 | 0 | 0 | 0 |
| original desktop | 86 | 18.0 s | 186 | n/a | 0 | 1 (Google Analytics) | 0 |

All steps reached the expected input state (`intro` → `wandering` → `menu` →
`modal`) on both sites. Screenshot colour differs only by the day cycle, whose
phase is `Date.now() / 240 s`.

Notes from verification:
- Playwright's default headless shell renders with SwiftShader at ~1.3 fps,
  which never finishes the reveal in reasonable time; `verify.py` uses
  new-headless Chromium with the GPU instead.
- "Click to start" is a ray-cursor sphere intersect updated on tick, so a
  synthetic instant click is ignored; the test hovers/holds like a user. Arrow
  keys, W/D and Enter also start (`introStart` action).
- In this environment the live site also stayed `is-server-offline`, so
  multiplayer behaviour could not be compared.
