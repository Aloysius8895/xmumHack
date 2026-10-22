# Running this import on Replit

The main web application is the existing Three.js/Vite game in `GamePlat/game`.
The separate Python service in `chatbot/` is not started by the game workflow.

## Development

- Runtime: Node.js 22.
- Install the existing locked dependencies: `cd GamePlat/game && npm ci`.
- Click **Run**, or run `cd GamePlat/game && npm run dev`.
- Vite listens on `0.0.0.0:5000` and serves both the game and its `/api` endpoints.
- The `Start application` workflow uses this command. No separate backend process is needed.
- Check the backend with `GET /api/state`.

## Optional services

The game and non-AI API routes run without external credentials. Live career AI
features require `ANTHROPIC_API_KEY` (or the existing code's supported Anthropic
authentication), configured through Replit Secrets. No mock AI mode is enabled
by this setup. The guided tour has its own pre-existing canned responses.
External automation endpoints require `INTEGRATION_TOKEN`; they remain disabled
without it. Telegram and WhatsApp credentials belong to the separate chatbot
service and are not needed to run the game.

Game saves use the existing JSON-file storage in `GamePlat/game/server/data/`.
Do not treat workspace files as a shared, durable production database.

## Existing production commands

From `GamePlat/game`, run `npm run build`, then
`HOST=0.0.0.0 PORT=5000 npm run server` to serve the built game and API.
The import's deployment configuration is preserved; publishing and external
service configuration are separate from this development setup.

## Verification and browser requirements

- `npm run build` succeeds.
- `node --test server/*.test.mjs` runs the existing backend tests.
- The game needs a browser with working WebGPU or WebGL2.
- During import setup, the workspace headless Chromium GPU process crashed
  while initializing WebGL, so gameplay could not be visually verified there.
  The HTTP server and `/api/state` were verified independently. A blank game
  canvas in this test environment is not a successful gameplay check.
