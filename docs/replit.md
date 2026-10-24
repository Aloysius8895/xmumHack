# KerjayaKu on Replit

The main application is the Three.js/Vite game and Node.js API in `src/game`. The root [`.replit`](../.replit) configuration starts this service. Messaging, recruitment sampling and automation run separately when enabled.

## Development

From the repository root:

```sh
npm ci --prefix src/game
npm run dev
```

The Replit **Run** button starts the same component on port **5000**. The existing Replit configuration uses Node.js 22 for the game; use Node.js 24+ when running recruitment sampling or the full root test launcher.

Copy the root [`.env.example`](../.env.example) to `src/game/.env` locally, or add its server variables in Replit Secrets. The configured AI provider is DeepSeek (`AI_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL=deepseek-flash`). Set `AI_MOCK=1` for a walkthrough with canned responses. See the [RunPod guide](../runpod/README.md) for the alternative provider.

## Production

The deployment configuration installs and builds the game inside `src/game`, then runs its `npm run server` script with `HOST=0.0.0.0 PORT=5000`. Root commands `npm run build` and `npm start` provide local entry points; the standalone server defaults to port 8787 unless `PORT` is set.

## Optional services

- Recruitment sampling: install dependencies in `src/crawler`, configure `RAPIDAPI_KEY` where applicable, run `npm run market:setup`, then `npm run market:serve` in a separate terminal. The game keeps its last published sample when the service is offline.
- Messaging: configure `src/chatbot/.env`, then start `python run.py` from `src/chatbot`. See the [companion guide](../src/chatbot/README.md).
- Automation: configure the workflows described in the [n8n guide](../src/game/n8n/README.md).

Provider credentials and integration tokens remain server-side. Game saves are in `src/game/server/data` unless AWS storage is configured. Configure persistent storage for production services.

## Checks

After installing service dependencies, run `npm test`, `npm run test:python` and `npm run build` from the repository root. `GET /api/state` checks the game API. The 3D world needs a browser with WebGPU or WebGL2 support.
