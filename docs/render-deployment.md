# Render demo deployment

The root `render.yaml` runs the existing production Node server and the built
Vite game together as a free web service in Singapore. It deploys the `roadmap`
branch. The repository root is the service root; do not set `rootDir` to
`src/game`, because the server also reads the repository's datasets.

- Build: `npm ci --include=dev && npm --prefix src/game ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/healthz`
- Listen address: `HOST=0.0.0.0`; Render supplies `PORT`.

Create a Blueprint from the repository and select `roadmap`. The demonstration
defaults to `AI_MOCK=1`: AI features use built-in example answers, and no provider
API key is uploaded. To enable real DeepSeek later, explicitly authorize that
change, add `DEEPSEEK_API_KEY` to Render's secret environment variables, set
`AI_MOCK=0`, and redeploy. Never commit `.env` or prefix the key with `VITE_`.

The free demonstration uses the existing single shared save. Progress is
temporary: Render discards filesystem changes on restart, redeploy or idle
spin-down. This is not a durable or isolated multi-user deployment. To persist
progress later, configure `DATABASE_URL` for the existing PostgreSQL backend,
or use a paid instance with a persistent disk and set `SAVE_DIR` to its mount.
No paid database or disk is provisioned by this Blueprint.

The web server does not start the market crawler or Telegram bot. Bundled market
datasets are available; live collection needs a separately configured crawler.
No local player save, private CV or local `.env` is included in the Git source.

After deployment, verify `/healthz`, `/`, `/api/state`, and an example AI request.
HTTP and build checks do not establish that WebGL renders correctly; visually
check the game in a supported hardware-accelerated browser.

References: [Node deployments](https://render.com/docs/deploy-node-express-app),
[Blueprint specification](https://render.com/docs/blueprint-spec),
[free service limitations](https://render.com/docs/free).
