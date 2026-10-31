# Render game and Telegram services

These are two separate web services. Closing a local terminal has no effect on
either Render process. The root `npm start` starts only the game, not Python.

| Service | Repository root directory | Build | Start | Health |
| --- | --- | --- | --- | --- |
| `kerjayaku-demo` | repository root | `npm ci --include=dev && npm --prefix src/game ci --include=dev && npm run build` | `npm start` | `/health` or `/healthz` |
| `kerjayaku-telegram` | `src/chatbot` | `pip install -r requirements.txt` | `python run.py` | `/health` |

Both deploy GitHub `main`. Node uses `HOST=0.0.0.0` and Render's `PORT`; `run.py`
already binds `0.0.0.0` and reads `PORT`. The game stays at repository root
because it reads datasets outside `src/game`.

## Required configuration

Never commit `.env` or put secrets in `VITE_` variables, logs or URLs. The
Blueprint shares the game integration token and DeepSeek key with the chatbot
through `fromService`. For manual deployment, set matching values on both.

- Game: `INTEGRATION_TOKEN`, `AI_PROVIDER=deepseek`, `AI_MOCK=0`,
  `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL=deepseek-flash`, `HOST=0.0.0.0`.
- Chatbot: `CAREERSPHERE_API_URL=https://kerjayaku-demo.onrender.com`, the same
  `INTEGRATION_TOKEN`, `AI_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`,
  `DEEPSEEK_MODEL=deepseek-flash`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_WEBHOOK_SECRET`, exactly one numeric `TELEGRAM_ALLOWED_USER_IDS`.
- Leave `DIGEST_SCHEDULE_ENABLED=false` unless an always-on instance is chosen
  and the daily digest is intentionally enabled. WhatsApp keys are not required.

Render startup checks reject missing Telegram credentials, localhost game URLs,
an unbound owner and missing DeepSeek credentials. The public chatbot health
endpoint reports configuration status but never returns credentials.

## Free versus persistent deployment

`render.yaml` uses two **free** instances and does not provision durable storage.
Both game saves and chatbot SQLite are temporary. Render spins down idle free
services; filesystem changes disappear on restart, redeploy or spin-down. A cold
chatbot delays Telegram delivery; a cold game can make report/expert requests
time out. This plan is neither always-on nor durable. Do not use synthetic
keep-alive traffic to bypass plan limits.

`render.persistent.yaml` is a separately approved **paid opt-in**, not applied by
preparing it. Both services use Starter, each with a separate 1 GB persistent
disk at `/var/data`:

- Game: `SAVE_DIR=/var/data/game` covers save and market documents. The bundled
  public collected dataset is read from the repository separately.
- Chatbot: `DB_PATH=/var/data/chat/chat.db` covers history, deduplication receipts,
  pending confirmations and expert sessions.
- `REQUIRE_PERSISTENT_STORAGE=1` rejects paths outside the configured directory.
  This path check is not proof that a disk is attached. Confirm the real Render
  disk and perform a restart persistence test before claiming durability.
- The game alternatively supports PostgreSQL via `DATABASE_URL`; chatbot storage
  supports its AWS backend. Setting `DATABASE_URL` on the Python service alone
  does **not** switch SQLite to PostgreSQL.

Back up existing state privately before changing storage. Attaching a disk does
not migrate old local data. Never put player saves or chat databases in Git.
Files on a free instance may already be unrecoverable after it restarts.

## Webhook cutover and verification

1. Deploy both services and wait for healthy public `/health` responses.
2. Probe game `GET /api/integrations/health` with its integration bearer.
   Incorrect bearer must fail; correct bearer returns `ok: true` without AI calls.
3. Probe chatbot `GET /internal/health/game` with
   `X-Telegram-Bot-Api-Secret-Token`. It makes a real authenticated read-only
   request from Render Python to Render Node. Do not submit fake learning records.
4. With chatbot secrets in the process environment, run
   `python scripts/set_telegram_webhook.py https://<chatbot>.onrender.com`.
   It explicitly sends `drop_pending_updates=false`, registers the secret header,
   retains message/callback updates and verifies the resulting URL. Run after
   deployment, not on every startup or health check.
5. Check Telegram `getWebhookInfo`: fixed Render URL, pending count, error date.
   Old last-error entries may remain after cutover; compare timestamps after a
   real delivery rather than treating any historical error as current failure.
6. Owner sends `/start`, a learning report and `/expert`. First select a target
   career in the web game. Check the quiz, saved log, progress and expert reply.
   A 200 webhook response alone does not establish processing success.

The existing webhook acknowledges before background processing. An in-flight
task can be interrupted on restart; persistent SQLite is not a durable job
queue. Do not claim exactly-once processing or replay of acknowledged in-flight
work. Backlog preservation refers to Telegram's still-pending updates.

## Checks

Run `npm --prefix src/game test` and, with Python requirements installed,
`python -m pytest tests/chatbot` with `PYTHONPATH=src/chatbot`. They cover
authentication, cloud URL guards, database reopening, backlog preservation and
token-free errors. Cloud restart persistence and the owner's Telegram commands
remain separate acceptance checks. HTTP checks do not verify WebGL rendering.

References: [Blueprints](https://render.com/docs/blueprint-spec),
[free service limits](https://render.com/docs/free),
[persistent disks](https://render.com/docs/disks),
[Telegram webhook API](https://core.telegram.org/bots/api#setwebhook).
