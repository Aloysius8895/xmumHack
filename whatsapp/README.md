# CareerSphere · WhatsApp chat (Replit AI)

Users chat with the CareerSphere companion on WhatsApp. Messages arrive at this
service, get classified (a learning report? small talk? unclear?), and are routed
either to the **CareerSphere game app's integration API** (progress logging) or to
**Replit AI Integrations** (conversation). Replies go back through the **official
WhatsApp Cloud API**.

```
WhatsApp user ──► Meta ──► POST /whatsapp/webhook (this service, deployed on Replit)
                                   │
                        classify: report / chat / uncertain
                           │                  │                  │
                  CareerSphere /chat   Replit AI reply   confirm buttons
                  (saved for digest)   (Claude or GPT)   (then one of the above)
                                   │
WhatsApp user ◄── Meta ◄── WhatsApp Cloud API: send reply

Once a day (23:30 MYT): today's saved reports ──► Replit AI drafts a digest
──► backend clamps delta / drops unknown skillIds ──► POST /api/integrations/digest
```

## What it does

- Verifies Meta's webhook (handshake + `X-Hub-Signature-256` signature).
- Remembers each number's conversation so the AI can follow up.
- Ignores duplicate deliveries from Meta.
- `重新开始` / `reset` clears the conversation (and any pending confirm button).
- Non-text messages get a polite "text only" reply; if the AI fails, a fallback message is sent.
- AI instructions: short WhatsApp-style replies in the user's language, support the user's own decisions, never invent jobs, courses or statistics (competition rule).

## CareerSphere integration

Every text message is first classified by Replit AI as a **learning report**, **chat**,
or **uncertain**:

- **Report** → `POST /api/integrations/chat` (CareerSphere app); its `reply` is sent back
  as-is, and on success the report is saved locally (for the daily digest).
- **Chat** → the existing conversational AI reply.
- **Uncertain** → a WhatsApp confirm-button message ("log this as a study record?").
  The tapped answer is looked up against the one pending question per number.

**Whitelist**: with `ALLOWED_WA_IDS` set, only those numbers' reports reach `/chat` (and
only they get asked to confirm); everyone else is told this is a demo. Unset = no
restriction (local testing).

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

### 1. Meta (WhatsApp Cloud API)
1. developers.facebook.com → create an app → add **WhatsApp**. Meta creates a test number.
2. **API Setup**: add up to 5 recipient phone numbers and verify them.
3. Copy the **Phone Number ID** and the access token. The API Setup token expires after 24 hours; before the demo, use a **System User** token.
4. App settings → Basic → copy the **App Secret**.

### 2. Replit
1. Import `github.com/Aloysius8895/xmumHack`, switch to branch `Whatsapp---Replit-AI`. The root `.replit` runs this folder only.
2. Ask Replit Agent to enable **AI Integrations** (Anthropic or OpenAI) and approve. Replit adds the `AI_INTEGRATIONS_*` variables itself.
3. Add **Secrets**: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
   `CAREERSPHERE_API_URL`, `INTEGRATION_TOKEN`, `ALLOWED_WA_IDS`, `CRON_TOKEN`, `DIGEST_SCHEDULE_ENABLED` (see `.env.example`).
4. **Deploy**. Use the deployment URL, not the editor preview, so the webhook stays online.

### 3. Connect the webhook
Meta app → WhatsApp → Configuration → Webhook:
- Callback URL: `https://<your-deployment>/whatsapp/webhook` (no trailing slash)
- Verify token: same as `WHATSAPP_VERIFY_TOKEN` → **Verify and save**
- Subscribe to **messages**

Send a WhatsApp message from a verified phone to the test number.

## Local run and tests

```bash
cd whatsapp
pip install -r requirements.txt
python run.py          # http://localhost:8000/health
python -m pytest -q    # simulated Meta webhooks, AI mocked
```

Without `WHATSAPP_TOKEN` the service runs in dry run: nothing is sent to WhatsApp.

## Data

Demo only with teammates' test phones, made-up conversations and synthetic study
activity (competition rule: no real personal data, no invented jobs/courses/stats).
Chat history, saved reports and pending confirm-button state are stored in a local
SQLite file (`whatsapp/data/chat.db`, git-ignored).

## Limits

| Limit | Handling |
|---|---|
| Test number reaches only 5 verified recipients | Demo on teammates' phones |
| API Setup token expires in 24h | Use a System User token |
| Replies are free only within 24h of the user's last message | It's a chat: the user writes first |
| AI usage costs Replit credits | Short replies, last 20 messages only |
