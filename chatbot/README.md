# CareerSphere · chat bot (Replit AI)

> **n8n 接入已补齐**：见 [项目工作流说明](../GamePlat/game/n8n/README.md)。Telegram 可由 n8n 转发到同步接口 `POST /internal/n8n/telegram`（沿用 webhook secret）；消息分类、确认和回复继续由本服务处理。n8n 每天 00:05 调用 `/internal/digest/run?summary_only=true&telegram_user_id=<演示玩家 ID>&date=<昨天>`，只摘录真实汇报，不再增加 mastery。该模式要求 `TELEGRAM_ALLOWED_USER_IDS` 只填一个演示玩家，并关闭本服务的 `DIGEST_SCHEDULE_ENABLED`；下文的 23:30 AI digest 是原有独立运行模式。

Users chat with the CareerSphere companion over **WhatsApp** or **Telegram**. Messages
arrive at this service, get classified (a learning report? small talk? unclear?), and
are routed either to the **CareerSphere game app's integration API** (progress logging)
or to **Replit AI Integrations** (conversation). Replies go back through whichever
channel the user wrote on.

> **Why two channels:** the WhatsApp Business account is pending Meta's company
> verification, so the live demo runs on **Telegram** (bot [@KerjayaKu_bot](https://t.me/KerjayaKu_bot))
> in the meantime. The WhatsApp code stays in place and can be reconnected once
> verification clears - see `app/whatsapp_channel.py`.

```
WhatsApp user ──► Meta           ──► POST /whatsapp/webhook ──┐
Telegram user ──► Telegram Bot API ──► POST /telegram/webhook ──┤ (this service, on Replit)
                                                                │
                                   classify: report / chat / uncertain
                                      │              │               │
                             CareerSphere /chat  Replit AI reply  confirm buttons
                             (saved for digest)  (Claude or GPT)  (then one of the above)
                                                                │
WhatsApp user ◄── Meta           ◄── WhatsApp Cloud API: send reply ──┤
Telegram user ◄── Telegram Bot API ◄── sendMessage: send reply ───────┘

Once a day (23:30 MYT): today's saved reports ──► Replit AI drafts a digest
──► backend clamps delta / drops unknown skillIds ──► POST /api/integrations/digest
```

Channel-specific code (`app/whatsapp_channel.py`, `app/telegram_channel.py`,
`app/whatsapp_api.py`, `app/telegram_api.py`) only handles receiving and sending;
routing, the allowlist, the CareerSphere call, saved reports and the digest are all
shared in `app/handlers.py`.

## What it does

- WhatsApp: verifies Meta's webhook (handshake + `X-Hub-Signature-256` signature).
- Telegram: verifies the webhook secret (`X-Telegram-Bot-Api-Secret-Token`), replies
  200 immediately and processes in the background; `/start` replies with the user's
  numeric Telegram id, for adding to the allowlist.
- Remembers each user's conversation (per channel) so the AI can follow up.
- Ignores duplicate deliveries/updates.
- `重新开始` / `reset` clears the conversation (and any pending confirm button).
- Non-text messages get a polite "text only" reply; if the AI fails, a fallback message is sent.
- AI instructions: short chat-style replies in the user's language, support the user's own decisions, never invent jobs, courses or statistics (competition rule).

## CareerSphere integration

Every text message is first classified by Replit AI as a **learning report**, **chat**,
or **uncertain**:

- **Report** → `POST /api/integrations/chat` (CareerSphere app); its `reply` is sent back
  as-is, and on success the report is saved locally (for the daily digest).
- **Chat** → the existing conversational AI reply.
- **Uncertain** → a confirm-button message ("log this as a study record?") - WhatsApp
  interactive reply buttons, or a Telegram inline keyboard (`callback_query`).
  The tapped answer is looked up against the one pending question per user.

**Whitelist**: with `ALLOWED_WA_IDS` (WhatsApp) / `TELEGRAM_ALLOWED_USER_IDS` (Telegram)
set, only those ids' reports reach `/chat` (and only they get asked to confirm);
everyone else is told this is a demo. Unset = no restriction (local testing). On
Telegram, `/start` replies with your numeric user id to add to the list.

**Errors from the CareerSphere app** never get shown to the user verbatim:
- `401` / `503` → "system misconfigured, try later" (not retried, not saved).
- everything else (`502`, 15s timeout, connection failure, unexpected `400`) →
  "couldn't save, please resend" (not saved - the user should not believe it was logged).

**Daily digest**: once a day (23:30 Asia/Kuala_Lumpur, in-process scheduler, gated by
`DIGEST_SCHEDULE_ENABLED`), or on demand via `POST /internal/digest/run` (header
`X-Cron-Token: <CRON_TOKEN>`, optional `?date=YYYY-MM-DD`), today's saved reports are
handed to Replit AI to draft a summary and per-skill deltas. The backend then only
keeps `skillId`s that actually appeared in that day's reports and clamps every delta to
`-10..+15`, regardless of what the AI proposed, before calling
`POST /api/integrations/digest`. No reports that day → nothing is sent.

⚠️ Replit **Autoscale** deployments sleep when idle, so the in-process scheduler can
silently stop firing. For a reliable daily digest, either deploy on a **Reserved VM**,
or point an external cron (e.g. GitHub Actions, cron-job.org) at
`POST /internal/digest/run` with the `X-Cron-Token` header.

## AI disclosure

The AI runs through Replit AI Integrations. Default model: `claude-haiku-4-5`
(Anthropic) or `gpt-5-mini` (OpenAI), whichever integration is enabled.
Change it with `AI_MODEL`. `GET /health` shows the provider and model in use.

## Setup

### 1. Meta (WhatsApp Cloud API) - optional while verification is pending
1. developers.facebook.com → create an app → add **WhatsApp**. Meta creates a test number.
2. **API Setup**: add up to 5 recipient phone numbers and verify them.
3. Copy the **Phone Number ID** and the access token. The API Setup token expires after 24 hours; before the demo, use a **System User** token.
4. App settings → Basic → copy the **App Secret**.

### 2. Telegram (demo channel)
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` (or reuse the existing bot, [@KerjayaKu_bot](https://t.me/KerjayaKu_bot)) → copy the **bot token**.
2. Pick any random string for `TELEGRAM_WEBHOOK_SECRET` (you choose it; Telegram just echoes it back on every webhook call for you to verify).
3. After deploying (step 4 below), register the webhook:
   ```bash
   cd chatbot
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
     python scripts/set_telegram_webhook.py https://<your-deployment>
   ```
4. Message the bot `/start` to get your numeric Telegram user id, then add it to `TELEGRAM_ALLOWED_USER_IDS`.

### 3. Replit
1. Import `github.com/Aloysius8895/xmumHack`, switch to branch `Whatsapp---Replit-AI`. The root `.replit` runs this folder only.
2. Ask Replit Agent to enable **AI Integrations** (Anthropic or OpenAI) and approve. Replit adds the `AI_INTEGRATIONS_*` variables itself.
3. Add **Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_USER_IDS`,
   `CAREERSPHERE_API_URL`, `INTEGRATION_TOKEN`, `CRON_TOKEN`, `DIGEST_SCHEDULE_ENABLED`, and (once WhatsApp
   verification clears) `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`, `ALLOWED_WA_IDS` (see `.env.example`).
4. **Deploy**. Use the deployment URL, not the editor preview, so webhooks stay online.

### 4. Connect the WhatsApp webhook (once verification clears)
Meta app → WhatsApp → Configuration → Webhook:
- Callback URL: `https://<your-deployment>/whatsapp/webhook` (no trailing slash)
- Verify token: same as `WHATSAPP_VERIFY_TOKEN` → **Verify and save**
- Subscribe to **messages**

Send a WhatsApp message from a verified phone to the test number.

## Local run and tests

```bash
cd chatbot
pip install -r requirements.txt
python run.py          # http://localhost:8000/health
python -m pytest -q    # simulated Meta/Telegram webhooks, AI mocked
```

Without `WHATSAPP_TOKEN` the service runs in dry run: nothing is sent to WhatsApp.
`GET /health` reports which channels have their required settings configured
(`{"channels": {"whatsapp": true|false, "telegram": true|false}}`), without exposing secrets.

## Data

Demo only with teammates' test phones/Telegram accounts, made-up conversations and
synthetic study activity (competition rule: no real personal data, no invented
jobs/courses/stats). Chat history, saved reports and pending confirm-button state are
stored in a local SQLite file (`chatbot/data/chat.db`, git-ignored).

## Limits

| Limit | Handling |
|---|---|
| Test number reaches only 5 verified recipients | Demo on teammates' phones |
| API Setup token expires in 24h | Use a System User token |
| Replies are free only within 24h of the user's last message | It's a chat: the user writes first |
| AI usage costs Replit credits | Short replies, last 20 messages only |
